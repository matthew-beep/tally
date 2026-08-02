'use client'

import { useMemo } from 'react'
import { mergeFeed } from '@/lib/feed'
import { displayName } from '@/lib/memberDisplay'
import { useAllGroupData } from './useAllGroupData'
import { useGroups } from './useGroups'
import type { ActivityItem, GroupMember } from '@/types'

// Derivation over the per-group caches: one flat timeline, newest first.
// No cache key of its own — mutations invalidate the per-group keys and
// this recomputes automatically. Optional `limit` slices after the sort
// (home recent rail); omit for the full /activity feed.
export function useAllActivity(limit?: number): { data: ActivityItem[]; isLoading: boolean } {
  const all = useAllGroupData()
  const { data: groups, isLoading: groupsLoading } = useGroups()

  const isLoading = all.isLoading || groupsLoading

  const data = useMemo<ActivityItem[]>(() => {
    if (isLoading) return []

    const groupMeta: Record<string, { id: string; name: string; emoji: string }> = {}
    for (const g of groups ?? []) groupMeta[g.id] = { id: g.id, name: g.name, emoji: g.emoji }

    const memberById: Record<string, GroupMember> = {}
    for (const gid of all.groupIds) {
      for (const m of all.membersByGroup[gid] ?? []) memberById[m.id] = m
    }
    const name = (seatId: string) => {
      const m = memberById[seatId]
      return m ? displayName(m) : '…'
    }

    const expenses = all.groupIds.flatMap(gid => all.expensesByGroup[gid] ?? [])
    const settlements = all.groupIds.flatMap(gid => all.settlementsByGroup[gid] ?? [])

    const items: ActivityItem[] = mergeFeed(expenses, settlements).map(f => {
      const gid = f.data.group_id
      const meta = groupMeta[gid] ?? { id: gid, name: '', emoji: '💸' }

      return f.type === 'expense'
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
            date: f.data.settled_date,
            createdAt: f.data.created_at,
            groupId: gid,
            groupName: meta.name,
            groupEmoji: meta.emoji,
          }
    })

    return limit != null ? items.slice(0, limit) : items
  }, [all, groups, isLoading, limit])

  return { data, isLoading }
}
