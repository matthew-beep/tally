'use client'

import { useMemo } from 'react'
import { mergeFeed } from '@/lib/feed'
import { displayName } from '@/lib/memberDisplay'
import { useAllGroupData } from './useAllGroupData'
import { useGroups } from './useGroups'
import type { ActivityItem, ActivityGroup, GroupMember } from '@/types'

// Derivation over the per-group caches: mergeFeed per group, shaped into
// display items, bucketed by group. No cache key of its own — mutations
// invalidate the per-group keys and this recomputes automatically.
export function useAllActivity(): { data: ActivityGroup[]; isLoading: boolean } {
  const all = useAllGroupData()
  const { data: groups, isLoading: groupsLoading } = useGroups()

  const isLoading = all.isLoading || groupsLoading

  const data = useMemo<ActivityGroup[]>(() => {
    if (isLoading) return []

    const groupMeta: Record<string, { id: string; name: string; emoji: string }> = {}
    for (const g of groups ?? []) groupMeta[g.id] = { id: g.id, name: g.name, emoji: g.emoji }

    return all.groupIds
      .map(gid => {
        const meta = groupMeta[gid] ?? { id: gid, name: '', emoji: '💸' }
        const memberById: Record<string, GroupMember> = {}
        for (const m of all.membersByGroup[gid] ?? []) memberById[m.id] = m
        const name = (seatId: string) => {
          const m = memberById[seatId]
          return m ? displayName(m) : '…'
        }

        const items: ActivityItem[] = mergeFeed(
          all.expensesByGroup[gid] ?? [],
          all.settlementsByGroup[gid] ?? [],
        ).map(f =>
          f.type === 'expense'
            ? {
                type: 'expense' as const,
                id: f.data.id,
                description: f.data.description,
                category: f.data.category,
                amount: Number(f.data.amount),
                date: f.data.expense_date,
                createdAt: f.data.created_at,
                updatedAt: f.data.updated_at,
                payerName: name(f.data.paid_by),
                groupId: gid,
                groupName: meta.name,
                groupEmoji: meta.emoji,
              }
            : {
                type: 'settlement' as const,
                id: f.data.id,
                amount: Number(f.data.amount),
                status: f.data.status,
                fromName: name(f.data.from_member_id),
                toName: name(f.data.to_member_id),
                createdAt: f.data.created_at,
                groupId: gid,
                groupName: meta.name,
                groupEmoji: meta.emoji,
              }
        )

        return { group: meta, items }
      })
      .filter(g => g.items.length > 0)
  }, [all, groups, isLoading])

  return { data, isLoading }
}
