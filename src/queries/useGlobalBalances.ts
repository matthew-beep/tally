'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { simplifyDebts } from '@/lib/balance'
import type { Profile, DebtTransfer } from '@/types'

export interface GlobalBalances {
  myId: string
  net: Record<string, number>
  profileMap: Record<string, Profile>
  transfers: DebtTransfer[]
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
        .eq('status', 'active')

      const groupIds = memberships?.map(m => m.group_id) ?? []
      if (groupIds.length === 0) {
        return { myId: user.id, net: {}, profileMap: {}, transfers: [] }
      }

      const [expRes, settleRes, memberRes] = await Promise.all([
        supabase
          .from('expenses')
          .select('paid_by, splits:expense_splits(user_id, owed_amount)')
          .in('group_id', groupIds)
          .is('deleted_at', null),
        supabase
          .from('settlements')
          .select('from_user, to_user, amount')
          .in('group_id', groupIds),
        supabase
          .from('group_members')
          .select('user_id, profile:profiles(*)')
          .in('group_id', groupIds)
          .eq('status', 'active'),
      ])

      const profileMap: Record<string, Profile> = {}
      const memberIds = [...new Set(memberRes.data?.map(m => m.user_id) ?? [])]
      for (const m of memberRes.data ?? []) {
        if (m.profile) profileMap[m.user_id] = m.profile as unknown as Profile
      }

      const net: Record<string, number> = Object.fromEntries(memberIds.map(id => [id, 0]))
      for (const e of expRes.data ?? []) {
        for (const s of (e.splits as any[]) ?? []) {
          if (s.user_id === e.paid_by) continue
          net[e.paid_by] = (net[e.paid_by] ?? 0) + Number(s.owed_amount)
          net[s.user_id] = (net[s.user_id] ?? 0) - Number(s.owed_amount)
        }
      }
      for (const s of settleRes.data ?? []) {
        net[s.from_user] = (net[s.from_user] ?? 0) + Number(s.amount)
        net[s.to_user]   = (net[s.to_user]   ?? 0) - Number(s.amount)
      }

      const rounded = Object.fromEntries(
        Object.entries(net).map(([k, v]) => [k, Math.round(v * 100) / 100])
      )

      return {
        myId: user.id,
        net: rounded,
        profileMap,
        transfers: simplifyDebts(rounded),
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
