'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient, getAuthUser } from '@/lib/supabase'
import type { ActivityItem, ActivityGroup } from '@/types'

export function useAllActivity() {
  const supabase = createClient()
  return useQuery<ActivityGroup[]>({
    queryKey: ['all-activity'],
    queryFn: async () => {
      const user = await getAuthUser(supabase)

      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id, group:groups(id, name, emoji)')
        .eq('user_id', user.id)
        .eq('status', 'active')

      const groupIds = memberships?.map(m => m.group_id) ?? []
      if (groupIds.length === 0) return []

      const groupMap = Object.fromEntries(
        (memberships ?? []).map(m => [m.group_id, (m as any).group])
      )

      const [expRes, settleRes] = await Promise.all([
        supabase
          .from('expenses')
          .select('id, description, category, amount, expense_date, created_at, group_id, payer:profiles!paid_by(name, display_name)')
          .in('group_id', groupIds)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('settlements')
          .select('id, amount, status, created_at, group_id, from_profile:profiles!from_user(name, display_name), to_profile:profiles!to_user(name, display_name)')
          .in('group_id', groupIds)
          .order('created_at', { ascending: false }),
      ])

      const byGroup: Record<string, ActivityItem[]> = {}
      for (const gid of groupIds) byGroup[gid] = []

      for (const e of expRes.data ?? []) {
        const payer = (e as any).payer
        byGroup[e.group_id]?.push({
          type: 'expense',
          id: e.id,
          description: e.description,
          category: e.category,
          amount: Number(e.amount),
          date: e.expense_date,
          createdAt: e.created_at,
          payerName: payer?.display_name ?? payer?.name ?? '…',
          groupId: e.group_id,
          groupName: groupMap[e.group_id]?.name ?? '',
          groupEmoji: groupMap[e.group_id]?.emoji ?? '💸',
        })
      }

      for (const s of settleRes.data ?? []) {
        const gid = (s as any).group_id
        const from = (s as any).from_profile
        const to = (s as any).to_profile
        byGroup[gid]?.push({
          type: 'settlement',
          id: s.id,
          amount: Number(s.amount),
          status: s.status as 'pending' | 'confirmed',
          fromName: from?.display_name ?? from?.name ?? '…',
          toName: to?.display_name ?? to?.name ?? '…',
          createdAt: s.created_at,
          groupId: gid,
          groupName: groupMap[gid]?.name ?? '',
          groupEmoji: groupMap[gid]?.emoji ?? '💸',
        })
      }

      return groupIds
        .map(gid => ({
          group: groupMap[gid] as ActivityGroup['group'],
          items: byGroup[gid].sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ),
        }))
        .filter(g => g.group && g.items.length > 0)
    },
  })
}
