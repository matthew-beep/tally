'use client'

import { useGroup, useGroupMembers } from './useGroups'
import { useExpenses } from './useExpenses'
import { useSettlements } from './useSettlements'
import { useCurrentProfile } from './useProfile'

// Thin composite over the per-resource hooks below — not a merged query.
// Each nested hook keeps its own queryKey, so mutation invalidation and
// useAllGroupData's fan-out (which reads/writes those same keys for the
// dashboard's global balances) are unaffected. Callers that only need a
// subset of this bundle (e.g. AddExpenseForm) should keep using the
// individual hooks directly rather than fetching resources they don't read.
export function useGroupDetail(groupId: string) {
  const groupQ       = useGroup(groupId)
  const membersQ      = useGroupMembers(groupId)
  const expensesQ       = useExpenses(groupId)
  const settlementsQ      = useSettlements(groupId)
  const profileQ             = useCurrentProfile()

  return {
    group: groupQ.data,
    loadingGroup: groupQ.isLoading,
    members: membersQ.data ?? [],
    loadingMembers: membersQ.isLoading,
    expenses: expensesQ.data ?? [],
    settlements: settlementsQ.data ?? [],
    profile: profileQ.data,
  }
}
