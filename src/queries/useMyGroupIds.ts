'use client'

import { useQuery } from '@tanstack/react-query'
import { groupsQueryOptions } from './useGroups'
import type { Group } from '@/types'

// Named interface for "which groups am I an active member of?" — implemented
// as a select view over the ['groups'] cache, not a query of its own, so the
// id list and the group metadata can never disagree. Structural sharing keeps
// the ids array referentially stable across metadata-only refetches (e.g. a
// rename), so the useAllGroupData fan-out doesn't churn. If the groups query
// ever gets heavy, swap this back to a dedicated skinny query without
// touching consumers.
export function useMyGroupIds() {
  return useQuery({
    ...groupsQueryOptions(),
    select: (groups: Group[]) => groups.map(g => g.id),
  })
}
