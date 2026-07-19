'use client'

import { useMemo } from 'react'
import { calcNetBalances, calcPairwiseNets, summarizeBalances } from '@/lib/balance'
import { useAllGroupData } from './useAllGroupData'
import { useCurrentProfile } from './useProfile'
import { useGroups } from './useGroups'
import type { Profile, GroupMember } from '@/types'

export interface GlobalBalances {
  myId: string
  net: Record<string, number>
  netPerGroup: Record<string, Record<string, number>>
  profileMap: Record<string, Profile>
  membersPerGroup: Record<string, GroupMember[]>
  grossOwedToMe: number
  grossIOwe: number
  pairwisePerGroup: Record<string, Record<string, number>>
  groupMap: Record<string, { id: string; name: string; emoji: string }>
}

// Derivation, not a query: folds the per-group caches (useAllGroupData)
// into cross-group aggregates. It has no cache key of its own — mutations
// invalidate the per-group keys and this recomputes automatically.
//
// Identity model: money data is seat-keyed (group_members.id). The pure
// per-group math runs in seat space; seats are translated to profile ids
// here, at the merge, so real users aggregate across groups while guests
// (no profile) stay seat-scoped.
export function useGlobalBalances(): { data: GlobalBalances | null; isLoading: boolean } {
  const { data: profile, isLoading: profileLoading } = useCurrentProfile()
  const { data: groups, isLoading: groupsLoading } = useGroups()
  const all = useAllGroupData()

  const isLoading = all.isLoading || profileLoading || groupsLoading

  const data = useMemo<GlobalBalances | null>(() => {
    if (!profile || all.isLoading) return null
    const myId = profile.id
    const { groupIds, expensesByGroup, settlementsByGroup, membersByGroup } = all

    // Seat id → profile id for real users; guests keep their seat id.
    const gmMap: Record<string, string> = {}
    for (const members of Object.values(membersByGroup))
      for (const m of members) gmMap[m.id] = m.user_id ?? m.id
    const effectiveId = (gmId: string) => gmMap[gmId] ?? gmId

    const net: Record<string, number> = {}
    const netPerGroup: Record<string, Record<string, number>> = {}
    const pairwisePerGroup: Record<string, Record<string, number>> = {}

    for (const gid of groupIds) {
      const members = membersByGroup[gid] ?? []
      const expenses = expensesByGroup[gid] ?? []
      const settlements = settlementsByGroup[gid] ?? []

      const seatNet = calcNetBalances(gid, expenses, settlements, members.map(m => m.id))
      netPerGroup[gid] = {}
      for (const [seat, v] of Object.entries(seatNet)) {
        const pid = effectiveId(seat)
        netPerGroup[gid][pid] = Math.round(((netPerGroup[gid][pid] ?? 0) + v) * 100) / 100
        net[pid] = (net[pid] ?? 0) + v
      }

      const mySeat = members.find(m => m.user_id === myId)?.id
      if (mySeat) {
        const pairwise = calcPairwiseNets(mySeat, expenses, settlements)
        for (const [seat, amt] of Object.entries(pairwise)) {
          const pid = effectiveId(seat)
          if (!pairwisePerGroup[pid]) pairwisePerGroup[pid] = {}
          pairwisePerGroup[pid][gid] = Math.round(((pairwisePerGroup[pid][gid] ?? 0) + amt) * 100) / 100
        }
      }
    }

    for (const k of Object.keys(net)) net[k] = Math.round(net[k] * 100) / 100

    // Hero grosses: summarize my merged pairwise map. No Math.max(0) floors —
    // an overshooting settlement flips to the other column, so the hero
    // always equals the sum of the person rows.
    const mergedPairwise: Record<string, number> = {}
    for (const [pid, byGid] of Object.entries(pairwisePerGroup)) {
      if (pid === myId) continue
      mergedPairwise[pid] = Math.round(Object.values(byGid).reduce((s, v) => s + v, 0) * 100) / 100
    }
    const { owedToMe, iOwe } = summarizeBalances(mergedPairwise)

    // The members join carries full profile rows — no separate profiles query.
    const profileMap: Record<string, Profile> = {}
    for (const members of Object.values(membersByGroup))
      for (const m of members)
        if (m.user_id && m.profile) profileMap[m.user_id] = m.profile

    const groupMap: Record<string, { id: string; name: string; emoji: string }> = {}
    for (const g of groups ?? []) groupMap[g.id] = { id: g.id, name: g.name, emoji: g.emoji }

    return {
      myId,
      net,
      netPerGroup,
      profileMap,
      membersPerGroup: membersByGroup,
      grossOwedToMe: owedToMe,
      grossIOwe: iOwe,
      pairwisePerGroup,
      groupMap,
    }
  }, [profile, groups, all])

  return { data, isLoading }
}
