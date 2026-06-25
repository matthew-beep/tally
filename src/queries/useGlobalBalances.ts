'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient, getAuthUser } from '@/lib/supabase'
import { simplifyDebts } from '@/lib/balance'
import type { Profile, GroupMember, DebtTransfer } from '@/types'

export interface GlobalBalances {
  myId: string
  net: Record<string, number>
  netPerGroup: Record<string, Record<string, number>>
  profileMap: Record<string, Profile>
  membersPerGroup: Record<string, GroupMember[]>
  transfers: DebtTransfer[]
  grossOwedToMe: number
  grossIOwe: number
  grossOwedToMeByPerson: Record<string, number>
  grossIOweByPerson: Record<string, number>
  pairwisePerGroup: Record<string, Record<string, number>>
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
        .eq('status', 'active')

      const groupIds = memberships?.map(m => m.group_id) ?? []
      if (groupIds.length === 0) {
        return { myId: user.id, net: {}, netPerGroup: {}, profileMap: {}, membersPerGroup: {}, transfers: [], grossOwedToMe: 0, grossIOwe: 0, grossOwedToMeByPerson: {}, grossIOweByPerson: {}, pairwisePerGroup: {}, groupMap: {} }
      }

      const [expRes, settleRes, memberRes, groupsRes] = await Promise.all([
        supabase
          .from('expenses')
          .select('group_id, paid_by, splits:expense_splits(group_member_id, owed_amount)')
          .in('group_id', groupIds)
          .is('deleted_at', null),
        supabase
          .from('settlements')
          .select('group_id, from_member_id, to_member_id, amount')
          .in('group_id', groupIds),
        supabase
          .from('group_members')
          .select('id, group_id, user_id, name, status, profile:profiles!group_members_user_id_fkey(id, name, display_name, avatar_url, handle, add_code)')
          .in('group_id', groupIds)
          .in('status', ['active', 'pending']),
        supabase
          .from('groups')
          .select('id, name, emoji')
          .in('id', groupIds),
      ])

      // Map group_member_id → user_id (profile id) for real users, group_member_id for guests
      // This is the cross-group identity resolution: real users aggregate by profile id
      const gmMap: Record<string, string> = {}
      for (const m of memberRes.data ?? []) {
        gmMap[m.id] = m.user_id ?? m.id
      }
      const effectiveId = (gmId: string) => gmMap[gmId] ?? gmId

      const myId = user.id
      const memberIds = [...new Set(Object.values(gmMap))]

      const net: Record<string, number> = Object.fromEntries(memberIds.map(id => [id, 0]))
      const netPerGroup: Record<string, Record<string, number>> = {}
      for (const gid of groupIds) netPerGroup[gid] = {}

      for (const e of expRes.data ?? []) {
        const gid = (e as any).group_id as string
        const payerId = effectiveId(e.paid_by)
        for (const s of (e.splits as any[]) ?? []) {
          const splitId = effectiveId(s.group_member_id)
          if (splitId === payerId) continue
          net[payerId] = (net[payerId] ?? 0) + Number(s.owed_amount)
          net[splitId] = (net[splitId] ?? 0) - Number(s.owed_amount)
          if (gid) {
            netPerGroup[gid][payerId] = (netPerGroup[gid][payerId] ?? 0) + Number(s.owed_amount)
            netPerGroup[gid][splitId] = (netPerGroup[gid][splitId] ?? 0) - Number(s.owed_amount)
          }
        }
      }

      for (const s of settleRes.data ?? []) {
        const gid = (s as any).group_id as string
        const fromId = effectiveId(s.from_member_id)
        const toId   = effectiveId(s.to_member_id)
        net[fromId] = (net[fromId] ?? 0) + Number(s.amount)
        net[toId]   = (net[toId]   ?? 0) - Number(s.amount)
        if (gid) {
          netPerGroup[gid][fromId] = (netPerGroup[gid][fromId] ?? 0) + Number(s.amount)
          netPerGroup[gid][toId]   = (netPerGroup[gid][toId]   ?? 0) - Number(s.amount)
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

      let grossOwedToMe = 0
      let grossIOwe = 0
      const grossOwedToMeByPerson: Record<string, number> = {}
      const grossIOweByPerson: Record<string, number> = {}

      for (const e of expRes.data ?? []) {
        const payerId = effectiveId(e.paid_by)
        for (const s of (e.splits as any[]) ?? []) {
          const splitId = effectiveId(s.group_member_id)
          if (splitId === payerId) continue
          if (payerId === myId) {
            grossOwedToMe += Number(s.owed_amount)
            grossOwedToMeByPerson[splitId] = (grossOwedToMeByPerson[splitId] ?? 0) + Number(s.owed_amount)
          }
          if (splitId === myId) {
            grossIOwe += Number(s.owed_amount)
            grossIOweByPerson[payerId] = (grossIOweByPerson[payerId] ?? 0) + Number(s.owed_amount)
          }
        }
      }
      for (const s of settleRes.data ?? []) {
        const fromId = effectiveId(s.from_member_id)
        const toId   = effectiveId(s.to_member_id)
        if (toId === myId) {
          grossOwedToMe = Math.max(0, grossOwedToMe - Number(s.amount))
          grossOwedToMeByPerson[fromId] = Math.max(0, (grossOwedToMeByPerson[fromId] ?? 0) - Number(s.amount))
        }
        if (fromId === myId) {
          grossIOwe = Math.max(0, grossIOwe - Number(s.amount))
          grossIOweByPerson[toId] = Math.max(0, (grossIOweByPerson[toId] ?? 0) - Number(s.amount))
        }
      }

      const roundGross = (r: Record<string, number>) =>
        Object.fromEntries(
          Object.entries(r)
            .filter(([, v]) => v > 0.005)
            .map(([k, v]) => [k, Math.round(v * 100) / 100])
        )

      // Fetch profiles for real users only (guests have no profile)
      const profileIds = memberIds.filter(id =>
        (memberRes.data ?? []).some(m => m.user_id === id)
      )
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', profileIds)

      const profileMap: Record<string, Profile> = {}
      for (const p of profilesData ?? []) {
        profileMap[p.id] = p as Profile
      }

      // membersPerGroup: GroupMember[] per group
      const membersPerGroup: Record<string, GroupMember[]> = {}
      for (const m of memberRes.data ?? []) {
        const gid = (m as any).group_id as string
        if (!membersPerGroup[gid]) membersPerGroup[gid] = []
        membersPerGroup[gid].push(m as unknown as GroupMember)
      }

      const groupMap: Record<string, { id: string; name: string; emoji: string }> = {}
      for (const g of groupsRes.data ?? []) {
        groupMap[g.id] = { id: g.id, name: g.name, emoji: g.emoji }
      }

      // Pairwise balance between me and each other person, per group
      const pairwisePerGroup: Record<string, Record<string, number>> = {}
      for (const e of expRes.data ?? []) {
        const gid = (e as any).group_id as string
        const payerId = effectiveId(e.paid_by)
        for (const s of (e.splits as any[]) ?? []) {
          const splitId = effectiveId(s.group_member_id)
          if (splitId === payerId) continue
          if (payerId === myId) {
            if (!pairwisePerGroup[splitId]) pairwisePerGroup[splitId] = {}
            pairwisePerGroup[splitId][gid] = (pairwisePerGroup[splitId][gid] ?? 0) + Number(s.owed_amount)
          }
          if (splitId === myId) {
            if (!pairwisePerGroup[payerId]) pairwisePerGroup[payerId] = {}
            pairwisePerGroup[payerId][gid] = (pairwisePerGroup[payerId][gid] ?? 0) - Number(s.owed_amount)
          }
        }
      }
      for (const s of settleRes.data ?? []) {
        const gid    = (s as any).group_id as string
        const fromId = effectiveId(s.from_member_id)
        const toId   = effectiveId(s.to_member_id)
        if (toId === myId) {
          if (!pairwisePerGroup[fromId]) pairwisePerGroup[fromId] = {}
          pairwisePerGroup[fromId][gid] = (pairwisePerGroup[fromId][gid] ?? 0) - Number(s.amount)
        }
        if (fromId === myId) {
          if (!pairwisePerGroup[toId]) pairwisePerGroup[toId] = {}
          pairwisePerGroup[toId][gid] = (pairwisePerGroup[toId][gid] ?? 0) + Number(s.amount)
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

export function useRecentActivity() {
  const supabase = createClient()
  return useQuery<RecentExpense[]>({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const user = await getAuthUser(supabase)

      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)
        .eq('status', 'active')

      const groupIds = memberships?.map(m => m.group_id) ?? []
      if (groupIds.length === 0) return []

      const { data, error } = await supabase
        .from('expenses')
        .select('id, description, category, amount, expense_date, created_at, group_id, group:groups(name, emoji), payer:group_members!paid_by(name, user_id, profile:profiles!group_members_user_id_fkey(name, display_name))')
        .in('group_id', groupIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(15)

      if (error) throw error

      return (data ?? []).map((e: any) => ({
        id: e.id,
        description: e.description,
        category: e.category,
        amount: Number(e.amount),
        expense_date: e.expense_date,
        created_at: e.created_at,
        group_id: e.group_id,
        groupName: e.group?.name ?? '',
        groupEmoji: e.group?.emoji ?? '💸',
        payerName: e.payer?.profile?.display_name ?? e.payer?.profile?.name ?? e.payer?.name ?? '…',
      }))
    },
  })
}
