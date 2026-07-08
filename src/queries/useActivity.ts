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

      // paid_by / from_member_id / to_member_id reference group_members, whose
      // display name lives on the row itself (guests) or its linked profile.
      const memberSelect = '(name, user_id, profile:profiles!group_members_user_id_fkey(name, display_name))'
      const [expRes, settleRes] = await Promise.all([
        supabase
          .from('expenses')
          .select(`id, description, category, amount, expense_date, created_at, updated_at, group_id, payer:group_members!paid_by${memberSelect}`)
          .in('group_id', groupIds)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('settlements')
          .select(`id, amount, status, created_at, group_id, from_member:group_members!from_member_id${memberSelect}, to_member:group_members!to_member_id${memberSelect}`)
          .in('group_id', groupIds)
          .order('created_at', { ascending: false }),
      ])

      const memberName = (m: any) =>
        m?.profile?.display_name ?? m?.profile?.name ?? m?.name ?? '…'

      const byGroup: Record<string, ActivityItem[]> = {}
      for (const gid of groupIds) byGroup[gid] = []

      for (const e of expRes.data ?? []) {
        byGroup[e.group_id]?.push({
          type: 'expense',
          id: e.id,
          description: e.description,
          category: e.category,
          amount: Number(e.amount),
          date: e.expense_date,
          createdAt: e.created_at,
          updatedAt: e.updated_at,
          payerName: memberName((e as any).payer),
          groupId: e.group_id,
          groupName: groupMap[e.group_id]?.name ?? '',
          groupEmoji: groupMap[e.group_id]?.emoji ?? '💸',
        })
      }

      for (const s of settleRes.data ?? []) {
        const gid = (s as any).group_id
        byGroup[gid]?.push({
          type: 'settlement',
          id: s.id,
          amount: Number(s.amount),
          status: s.status as 'pending' | 'confirmed',
          fromName: memberName((s as any).from_member),
          toName: memberName((s as any).to_member),
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
