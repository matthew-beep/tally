'use client'

import { useMemo } from 'react'
import { mergeFeed } from '@/lib/feed'
import { displayName } from '@/lib/memberDisplay'
import { round2 } from '@/lib/money'
import { useAllGroupData } from './useAllGroupData'
import { useGroups } from './useGroups'
import { useCurrentProfile } from './useProfile'
import type { ActivityItem, GroupMember } from '@/types'

// Derivation over the per-group caches: one flat timeline, newest first.
// No cache key of its own — mutations invalidate the per-group keys and
// this recomputes automatically. Optional `limit` slices after the sort
// (home recent rail); omit for the full /activity feed.
export function useAllActivity(limit?: number): { data: ActivityItem[]; isLoading: boolean } {
  const all = useAllGroupData()
  const { data: groups, isLoading: groupsLoading } = useGroups()
  const { data: profile, isLoading: profileLoading } = useCurrentProfile()

  const isLoading = all.isLoading || groupsLoading || profileLoading

  const data = useMemo<ActivityItem[]>(() => {
    if (isLoading || !profile) return []
    const myId = profile.id

    const groupMeta: Record<string, { id: string; name: string; emoji: string }> = {}
    for (const g of groups ?? []) groupMeta[g.id] = { id: g.id, name: g.name, emoji: g.emoji }

    const memberById: Record<string, GroupMember> = {}
    // My seat differs per group — money tables are seat-keyed, not profile-keyed.
    const mySeatByGroup: Record<string, string | undefined> = {}
    for (const gid of all.groupIds) {
      const members = all.membersByGroup[gid] ?? []
      for (const m of members) memberById[m.id] = m
      mySeatByGroup[gid] = members.find(m => m.user_id === myId)?.id
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
      const mySeatId = mySeatByGroup[gid]

      if (f.type === 'expense') {
        const splits = f.data.splits ?? []
        const youPaid = f.data.paid_by === mySeatId
        const mySplit = splits.find(s => s.group_member_id === mySeatId)
        // Same rule as toGroupFeedCard: as payer your stake is what everyone
        // *else* owes you — your own split row nets to nothing.
        const myShare = youPaid
          ? round2(splits.filter(s => s.group_member_id !== f.data.paid_by).reduce((sum, s) => sum + Number(s.owed_amount), 0))
          : mySplit
            ? -round2(Number(mySplit.owed_amount))
            : null

        return {
          type: 'expense' as const,
          id: f.data.id,
          description: f.data.description,
          category: f.data.category,
          amount: Number(f.data.amount),
          date: f.data.expense_date,
          createdAt: f.data.created_at,
          updatedAt: f.data.updated_at,
          payerName: name(f.data.paid_by),
          youPaid,
          myShare,
          groupId: gid,
          groupName: meta.name,
          groupEmoji: meta.emoji,
        }
      }

      return {
        type: 'settlement' as const,
        id: f.data.id,
        amount: Number(f.data.amount),
        status: f.data.status,
        fromName: name(f.data.from_member_id),
        toName: name(f.data.to_member_id),
        youFrom: f.data.from_member_id === mySeatId,
        youTo: f.data.to_member_id === mySeatId,
        date: f.data.settled_date,
        createdAt: f.data.created_at,
        groupId: gid,
        groupName: meta.name,
        groupEmoji: meta.emoji,
      }
    })

    return limit != null ? items.slice(0, limit) : items
  }, [all, groups, profile, isLoading, limit])

  return { data, isLoading }
}
