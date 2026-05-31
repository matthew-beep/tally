'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { simplifyDebts } from '@/lib/balance'
import type { Profile, DebtTransfer } from '@/types'

export interface GlobalBalances {
  myId: string
  net: Record<string, number>
  // Per-group net balance for each user — used by GroupCard badges without extra queries.
  netPerGroup: Record<string, Record<string, number>>
  profileMap: Record<string, Profile>
  transfers: DebtTransfer[]
  // Gross amounts before pairwise netting — used for the "Owed to you" / "You owe"
  // dashboard cards. Net balance can be -$12 while you still have $88 owed to you
  // and $100 you owe; showing only the net hides both sides of the relationship.
  grossOwedToMe: number
  grossIOwe: number
}

export function useGlobalBalances() {
  const supabase = createClient()
  return useQuery<GlobalBalances | null>({
    queryKey: ['global-balances'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) return null

      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)
        // Balances only consider groups where the user is fully active
        .eq('status', 'active')

      const groupIds = memberships?.map(m => m.group_id) ?? []
      if (groupIds.length === 0) {
        return { myId: user.id, net: {}, netPerGroup: {}, profileMap: {}, transfers: [], grossOwedToMe: 0, grossIOwe: 0 }
      }

      const [expRes, settleRes, memberRes] = await Promise.all([
        supabase
          .from('expenses')
          .select('group_id, paid_by, splits:expense_splits(user_id, owed_amount)')
          .in('group_id', groupIds)
          // Soft-delete invariant: deleted expenses excluded from all balance math
          .is('deleted_at', null),
        supabase
          .from('settlements')
          .select('group_id, from_user, to_user, amount')
          .in('group_id', groupIds),
        supabase
          .from('group_members')
          // profiles join is unambiguous here (no invited_by join), but keep explicit
          // for consistency with useGroupMembers which requires the FK hint.
          .select('user_id, profile:profiles(*)')
          .in('group_id', groupIds)
          .eq('status', 'active'),
      ])

      const profileMap: Record<string, Profile> = {}
      const memberIds = [...new Set(memberRes.data?.map(m => m.user_id) ?? [])]
      for (const m of memberRes.data ?? []) {
        if (m.profile) profileMap[m.user_id] = m.profile as unknown as Profile
      }

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

      for (const e of expRes.data ?? []) {
        for (const s of (e.splits as any[]) ?? []) {
          if (s.user_id === e.paid_by) continue
          if (e.paid_by === myId) grossOwedToMe += Number(s.owed_amount)
          if (s.user_id === myId) grossIOwe     += Number(s.owed_amount)
        }
      }
      for (const s of settleRes.data ?? []) {
        if (s.to_user   === myId) grossOwedToMe = Math.max(0, grossOwedToMe - Number(s.amount))
        if (s.from_user === myId) grossIOwe     = Math.max(0, grossIOwe     - Number(s.amount))
      }

      return {
        myId,
        net: rounded,
        netPerGroup: roundedNetPerGroup,
        profileMap,
        transfers: simplifyDebts(rounded),
        grossOwedToMe: Math.round(grossOwedToMe * 100) / 100,
        grossIOwe:     Math.round(grossIOwe     * 100) / 100,
      }
    },
  })
}

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
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) return []

      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)
        .eq('status', 'active')

      const groupIds = memberships?.map(m => m.group_id) ?? []
      if (groupIds.length === 0) return []

      const { data, error } = await supabase
        .from('expenses')
        // FK hint on payer: expenses has paid_by → profiles (explicit to match pattern)
        .select('id, description, category, amount, expense_date, created_at, group_id, group:groups(name, emoji), payer:profiles!paid_by(name, display_name)')
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
        payerName: e.payer?.display_name ?? e.payer?.name ?? '…',
      }))
    },
  })
}
