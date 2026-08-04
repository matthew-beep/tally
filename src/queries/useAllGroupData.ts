'use client'

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useMyGroupIds } from './useMyGroupIds'
import { expensesQueryOptions } from './useExpenses'
import { settlementsQueryOptions } from './useSettlements'
import { groupMembersQueryOptions } from './useGroups'
import type { Expense, Settlement, GroupMember } from '@/types'

export interface AllGroupData {
  groupIds: string[]
  expensesByGroup: Record<string, Expense[]>
  settlementsByGroup: Record<string, Settlement[]>
  membersByGroup: Record<string, GroupMember[]>
  isLoading: boolean
}

// Fan-out over the canonical per-group caches. Uses the same query options
// (keys + fetchers) as the single-group hooks, so cross-group screens and
// the group detail page read and warm the same cache entries: navigating
// dashboard → group finds the group's data already loaded, and vice versa.
export function useAllGroupData(): AllGroupData {
  const { data: groupIds, isLoading: idsLoading } = useMyGroupIds()
  const ids = groupIds ?? []

  const expenseResults    = useQueries({ queries: ids.map(gid => expensesQueryOptions(gid)) })
  const settlementResults = useQueries({ queries: ids.map(gid => settlementsQueryOptions(gid)) })
  const memberResults     = useQueries({ queries: ids.map(gid => groupMembersQueryOptions(gid)) })

  const isLoading =
    idsLoading ||
    expenseResults.some(r => r.isLoading) ||
    settlementResults.some(r => r.isLoading) ||
    memberResults.some(r => r.isLoading)

  // This return value is a useMemo dependency of both useGlobalBalances and
  // useAllActivity. Rebuilding it every render gave it a new identity every
  // render, so neither of those memos ever hit and all the cross-group balance
  // and activity math re-ran on every parent render. Key on dataUpdatedAt —
  // it bumps exactly when a query's data changes, and keeps the dep array a
  // fixed length (spreading the per-group results would not).
  const idsKey = ids.join(',')
  const dataVersion = [
    ...expenseResults.map(r => r.dataUpdatedAt),
    ...settlementResults.map(r => r.dataUpdatedAt),
    ...memberResults.map(r => r.dataUpdatedAt),
  ].join(',')

  return useMemo<AllGroupData>(() => {
    const expensesByGroup: Record<string, Expense[]> = {}
    const settlementsByGroup: Record<string, Settlement[]> = {}
    const membersByGroup: Record<string, GroupMember[]> = {}
    ids.forEach((gid, i) => {
      expensesByGroup[gid]    = expenseResults[i]?.data ?? []
      settlementsByGroup[gid] = settlementResults[i]?.data ?? []
      membersByGroup[gid]     = memberResults[i]?.data ?? []
    })
    return { groupIds: ids, expensesByGroup, settlementsByGroup, membersByGroup, isLoading }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, dataVersion, isLoading])
}
