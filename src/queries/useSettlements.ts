'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { buildSettlementBatch, type SettlementAllocation } from '@/lib/settlements'
import type { Settlement } from '@/types'

// Shared by useSettlements (single group) and useAllGroupData (fan-out) so
// both read and write the same ['settlements', groupId] cache entry.
export function settlementsQueryOptions(groupId: string) {
  const supabase = createClient()
  return {
    queryKey: ['settlements', groupId] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settlements')
        .select('*, from_member:group_members!from_member_id(id, name, user_id, profile:profiles!group_members_user_id_fkey(avatar_url, display_name)), to_member:group_members!to_member_id(id, name, user_id, profile:profiles!group_members_user_id_fkey(avatar_url, display_name))')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Settlement[]
    },
    enabled: !!groupId,
  }
}

export function useSettlements(groupId: string) {
  return useQuery(settlementsQueryOptions(groupId))
}

/**
 * One payment, written as N settlement rows sharing a `batch_id` and one
 * status. Group-unbound: a batch can span groups, so scoping lives on each
 * allocation rather than on the hook.
 *
 * There is no singular variant. A one-group settle is a batch of one and takes
 * this same path — the status rule (item 5 (a′)) is subtle enough that having
 * it in two places is how the two drift apart.
 */
export function useCreateSettlements() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ allocations, note, settledDate }: {
      allocations: SettlementAllocation[]
      note?: string
      settledDate?: string
    }) => {
      // Generated here, not left to the column default: the default is
      // per-row, so relying on it would give every row in a batch a different
      // uuid and silently split one payment into N batches of one.
      const rows = buildSettlementBatch(allocations, {
        batchId: crypto.randomUUID(), note, settledDate,
      })
      if (rows.length === 0) throw new Error('Nothing to settle.')

      // A multi-row insert compiles to one atomic SQL INSERT — all rows or
      // none — so a batch can never land half-written.
      const { data, error } = await supabase.from('settlements').insert(rows).select()
      if (error) throw error
      return data as Settlement[]
    },
    onSuccess: rows => {
      // Activity, the home rail and global balances all derive from the
      // per-group settlement caches with no keys of their own, so invalidating
      // each affected group covers every surface.
      for (const groupId of new Set(rows.map(r => r.group_id))) {
        qc.invalidateQueries({ queryKey: ['settlements', groupId] })
      }
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useConfirmSettlement() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, groupId, notificationId }: { id: string; groupId: string; notificationId: string }) => {
      // Deny deletes the settlement outright, which cascades into notifications
      // (settlement_id REFERENCES settlements ON DELETE CASCADE) — no explicit
      // read-marking needed there. Confirm only updates status, so the row
      // survives and the original settlement_confirm notification must be
      // marked read explicitly, same pattern as useAcceptGroupInvite.
      //
      // Sequential, not Promise.all: marking the request read is only correct
      // if the settlement actually got confirmed. Run in parallel, a rejected
      // UPDATE (RLS allows the payee only) still retires the card, leaving the
      // settlement pending with nothing left in the UI to act on it.
      const { error: confirmError } = await supabase
        .from('settlements').update({ status: 'confirmed' }).eq('id', id)
      if (confirmError) throw confirmError

      const { error: readError } = await supabase
        .from('notifications').update({ read: true }).eq('id', notificationId)
      if (readError) throw readError

      return { id, groupId }
    },
    onSuccess: ({ groupId }) => {
      qc.invalidateQueries({ queryKey: ['settlements', groupId] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useDenySettlement() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, groupId }: { id: string; groupId: string }) => {
      // Checked, not fire-and-forget: this DELETE failed on every attempt from
      // the day it was written until 20260805010000 (the trigger's FK
      // violation), and nothing noticed precisely because the error was
      // dropped here — PostgREST returns it in `error` rather than throwing.
      const { error } = await supabase.from('settlements').delete().eq('id', id)
      if (error) throw error
      return { id, groupId }
    },
    onSuccess: ({ groupId }) => {
      qc.invalidateQueries({ queryKey: ['settlements', groupId] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
