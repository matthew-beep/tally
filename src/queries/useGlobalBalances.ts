'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient, getAuthUser } from '@/lib/supabase'
import { simplifyDebts } from '@/lib/balance'
import type { Profile, DebtTransfer } from '@/types'

export interface GlobalBalances {
  myId: string
  net: Record<string, number>
  // Per-group net balance for each user — used by GroupCard badges without extra queries.
  netPerGroup: Record<string, Record<string, number>>
  profileMap: Record<string, Profile>
  membersPerGroup: Record<string, Array<{ user_id: string; profile: Profile }>>
  transfers: DebtTransfer[]
  // Gross amounts before pairwise netting — used for the "Owed to you" / "You owe"
  // dashboard cards. Net balance can be -$12 while you still have $88 owed to you
  // and $100 you owe; showing only the net hides both sides of the relationship.
  grossOwedToMe: number
  grossIOwe: number
  // Per-person gross amounts — used by the breakdown modals.
  // Keyed by profile ID, value is the gross amount after applying settlements.
  grossOwedToMeByPerson: Record<string, number>
  grossIOweByPerson: Record<string, number>
  // Pairwise balance between the current user and each other person, broken down by group.
  // pairwisePerGroup[personId][groupId]: positive = person owes me, negative = I owe person.
  pairwisePerGroup: Record<string, Record<string, number>>
  // Group metadata needed for per-group balance breakdown UI.
  groupMap: Record<string, { id: string; name: string; emoji: string }>
}

export function useGlobalBalances() {
  const supabase = createClient()
  return useQuery<GlobalBalances | null>({
    queryKey: ['global-balances'],
    queryFn: async () => {
      const user = await getAuthUser(supabase)

      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)
        // Balances only consider groups where the user is fully active
        .eq('status', 'active')

      const groupIds = memberships?.map(m => m.group_id) ?? []
      if (groupIds.length === 0) {
        return { myId: user.id, net: {}, netPerGroup: {}, profileMap: {}, membersPerGroup: {}, transfers: [], grossOwedToMe: 0, grossIOwe: 0, grossOwedToMeByPerson: {}, grossIOweByPerson: {}, pairwisePerGroup: {}, groupMap: {} }
      }

      const [expRes, settleRes, memberRes, groupsRes] = await Promise.all([
        supabase // expRes
          .from('expenses')
          .select('group_id, paid_by, splits:expense_splits(user_id, owed_amount)')
          .in('group_id', groupIds)
          // Soft-delete invariant: deleted expenses excluded from all balance math
          .is('deleted_at', null),
        supabase // settleRes
          .from('settlements')
          .select('group_id, from_user, to_user, amount')
          .in('group_id', groupIds),
        supabase // memberRes TODO: add flag for active vs pending
          .from('group_members')
          .select('group_id, user_id')
          .in('group_id', groupIds),
        supabase
          .from('groups')
          .select('id, name, emoji')
          .in('id', groupIds),
      ])
      const memberIds = [...new Set(memberRes.data?.map(m => m.user_id) ?? [])]

      // Balances are always computed from raw splits + settlements — never stored.
      const net: Record<string, number> = Object.fromEntries(memberIds.map(id => [id, 0]))
      const netPerGroup: Record<string, Record<string, number>> = {}
      for (const gid of groupIds) netPerGroup[gid] = {}

      for (const e of expRes.data ?? []) {
        const gid = (e as any).group_id as string
        for (const s of (e.splits as any[]) ?? []) {
          if (s.user_id === e.paid_by) continue
          net[e.paid_by] = (net[e.paid_by] ?? 0) + Number(s.owed_amount)
          net[s.user_id] = (net[s.user_id] ?? 0) - Number(s.owed_amount)
          if (gid) {
            netPerGroup[gid][e.paid_by] = (netPerGroup[gid][e.paid_by] ?? 0) + Number(s.owed_amount)
            netPerGroup[gid][s.user_id] = (netPerGroup[gid][s.user_id] ?? 0) - Number(s.owed_amount)
          }
        }
      }
      for (const s of settleRes.data ?? []) {
        const gid = (s as any).group_id as string
        net[s.from_user] = (net[s.from_user] ?? 0) + Number(s.amount)
        net[s.to_user]   = (net[s.to_user]   ?? 0) - Number(s.amount)
        if (gid) {
          netPerGroup[gid][s.from_user] = (netPerGroup[gid][s.from_user] ?? 0) + Number(s.amount)
          netPerGroup[gid][s.to_user]   = (netPerGroup[gid][s.to_user]   ?? 0) - Number(s.amount)
        }
      }

      const rounded = Object.fromEntries(
        Object.entries(net).map(([k, v]) => [k, Math.round(v * 100) / 100])
      )
      const roundedNetPerGroup: Record<string, Record<string, number>> = {}
      for (const [gid, balances] of Object.entries(netPerGroup)) {
        roundedNetPerGroup[gid] = Object.fromEntries(
          Object.entries(balances).map(([k, v]) => [k, Math.round(v * 100) / 100])
        )
      }

      // Gross amounts: walk splits and settlements independently for the current user.
      // Settlements are applied directionally — a settlement FROM someone reduces what
      // they owe me; a settlement BY me reduces what I owe someone else.
      let grossOwedToMe = 0
      let grossIOwe = 0
      const myId = user.id
      const grossOwedToMeByPerson: Record<string, number> = {}
      const grossIOweByPerson: Record<string, number> = {}

      for (const e of expRes.data ?? []) {
        for (const s of (e.splits as any[]) ?? []) {
          if (s.user_id === e.paid_by) continue
          if (e.paid_by === myId) {
            grossOwedToMe += Number(s.owed_amount)
            grossOwedToMeByPerson[s.user_id] = (grossOwedToMeByPerson[s.user_id] ?? 0) + Number(s.owed_amount)
          }
          if (s.user_id === myId) {
            grossIOwe += Number(s.owed_amount)
            grossIOweByPerson[e.paid_by] = (grossIOweByPerson[e.paid_by] ?? 0) + Number(s.owed_amount)
          }
        }
      }
      for (const s of settleRes.data ?? []) {
        if (s.to_user === myId) {
          grossOwedToMe = Math.max(0, grossOwedToMe - Number(s.amount))
          grossOwedToMeByPerson[s.from_user] = Math.max(0, (grossOwedToMeByPerson[s.from_user] ?? 0) - Number(s.amount))
        }
        if (s.from_user === myId) {
          grossIOwe = Math.max(0, grossIOwe - Number(s.amount))
          grossIOweByPerson[s.to_user] = Math.max(0, (grossIOweByPerson[s.to_user] ?? 0) - Number(s.amount))
        }
      }

      const roundGross = (r: Record<string, number>) =>
        Object.fromEntries(
          Object.entries(r)
            .filter(([, v]) => v > 0.005)
            .map(([k, v]) => [k, Math.round(v * 100) / 100])
        )

      const personIds = [...new Set([
        ...memberIds,
        ...Object.keys(grossOwedToMeByPerson),
        ...Object.keys(grossIOweByPerson),
      ])]

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', personIds)

      const profileMap: Record<string, Profile> = {}
      for (const p of profilesData ?? []) {
        profileMap[p.id] = p as Profile
      }

      const membersPerGroup: Record<string, Array<{ user_id: string; profile: Profile }>> = {}
      for (const m of memberRes.data ?? []) {
        const gid = (m as any).group_id as string
        if (!membersPerGroup[gid]) membersPerGroup[gid] = []
        const profile = profileMap[m.user_id]
        if (profile) membersPerGroup[gid].push({ user_id: m.user_id, profile })
      }

      const groupMap: Record<string, { id: string; name: string; emoji: string }> = {}
      for (const g of groupsRes.data ?? []) {
        groupMap[g.id] = { id: g.id, name: g.name, emoji: g.emoji }
      }

      // Pairwise balance between me and each other person, per group.
      const pairwisePerGroup: Record<string, Record<string, number>> = {}
      for (const e of expRes.data ?? []) {
        const gid = (e as any).group_id as string
        for (const s of (e.splits as any[]) ?? []) {
          if (s.user_id === e.paid_by) continue
          if (e.paid_by === myId) {
            if (!pairwisePerGroup[s.user_id]) pairwisePerGroup[s.user_id] = {}
            pairwisePerGroup[s.user_id][gid] = (pairwisePerGroup[s.user_id][gid] ?? 0) + Number(s.owed_amount)
          }
          if (s.user_id === myId) {
            if (!pairwisePerGroup[e.paid_by]) pairwisePerGroup[e.paid_by] = {}
            pairwisePerGroup[e.paid_by][gid] = (pairwisePerGroup[e.paid_by][gid] ?? 0) - Number(s.owed_amount)
          }
        }
      }
      for (const s of settleRes.data ?? []) {
        const gid = (s as any).group_id as string
        if (s.to_user === myId) {
          if (!pairwisePerGroup[s.from_user]) pairwisePerGroup[s.from_user] = {}
          pairwisePerGroup[s.from_user][gid] = (pairwisePerGroup[s.from_user][gid] ?? 0) - Number(s.amount)
        }
        if (s.from_user === myId) {
          if (!pairwisePerGroup[s.to_user]) pairwisePerGroup[s.to_user] = {}
          pairwisePerGroup[s.to_user][gid] = (pairwisePerGroup[s.to_user][gid] ?? 0) + Number(s.amount)
        }
      }
      for (const [pid, groups] of Object.entries(pairwisePerGroup)) {
        for (const [gid, amt] of Object.entries(groups)) {
          pairwisePerGroup[pid][gid] = Math.round(amt * 100) / 100
        }
      }

      return {
        myId,
        net: rounded,
        netPerGroup: roundedNetPerGroup,
        profileMap,
        membersPerGroup,
        transfers: simplifyDebts(rounded),
        grossOwedToMe:         Math.round(grossOwedToMe * 100) / 100,
        grossIOwe:             Math.round(grossIOwe     * 100) / 100,
        grossOwedToMeByPerson: roundGross(grossOwedToMeByPerson),
        grossIOweByPerson:     roundGross(grossIOweByPerson),
        pairwisePerGroup,
        groupMap,
      }
    },
  })
}

/** Flattened expense row for the home screen "Recent activity" panel. */
export interface RecentExpense {
  id: string
  description: string
  category: string | null
  amount: number
  expense_date: string
  created_at: string
  group_id: string
  groupName: string
  groupEmoji: string
  payerName: string
}

/**
 * Latest expenses across all of the user's active groups.
 * Home ActivityPanel only — expenses only (no settlements), no per-user share math.
 * Two round-trips: memberships → expenses with group + payer joins.
 */
export function useRecentActivity() {
  const supabase = createClient()
  return useQuery<RecentExpense[]>({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const user = await getAuthUser(supabase)

      // Scope to groups the user belongs to (same active-only filter as balances).
      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)
        .eq('status', 'active')

      const groupIds = memberships?.map(m => m.group_id) ?? []
      if (groupIds.length === 0) return []

      const { data, error } = await supabase
        .from('expenses')
        // Join group (name/emoji) and payer profile in one query.
        // FK hint on payer: expenses.paid_by → profiles (explicit when multiple FKs exist).
        .select('id, description, category, amount, expense_date, created_at, group_id, group:groups(name, emoji), payer:profiles!paid_by(name, display_name)')
        .in('group_id', groupIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }) // sort by when recorded, not expense_date
        .limit(15)

      if (error) throw error

      // Flatten nested Supabase joins into UI-friendly fields.
      return (data ?? []).map((e: any) => ({
        id: e.id,
        description: e.description,
        category: e.category,
        amount: Number(e.amount), // Postgres numeric may arrive as string
        expense_date: e.expense_date,
        created_at: e.created_at,
        group_id: e.group_id,
        groupName: e.group?.name ?? '',
        groupEmoji: e.group?.emoji ?? '💸',
        payerName: e.payer?.display_name ?? e.payer?.name ?? '…',
      }))
    },
  })
}
