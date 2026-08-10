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
    mutationFn: async ({ settlementIds, groupIds, notificationIds }: {
      settlementIds: string[]
      groupIds: string[]
      notificationIds: string[]
    }) => {
      // Deny deletes the settlement outright, which cascades into notifications
      // (settlement_id REFERENCES settlements ON DELETE CASCADE) — no explicit
      // read-marking needed there. Confirm only updates status, so the row
      // survives and the original settlement_confirm notification must be
      // marked read explicitly, same pattern as useAcceptGroupInvite.
      //
      // `.in`, not `.eq`: one payment can allocate across several groups, and
      // confirm/deny act on the whole batch (item 5 (d)) — you cannot
      // half-receive a transfer. Each is still a single statement.
      //
      // Sequential, not Promise.all: marking the requests read is only correct
      // if the settlements actually got confirmed. Run in parallel, a rejected
      // UPDATE (RLS allows the payee only) still retires the card, leaving the
      // settlements pending with nothing left in the UI to act on them.
      const { error: confirmError } = await supabase
        .from('settlements').update({ status: 'confirmed' }).in('id', settlementIds)
      if (confirmError) throw confirmError

      const { error: readError } = await supabase
        .from('notifications').update({ read: true }).in('id', notificationIds)
      if (readError) throw readError

      return { groupIds }
    },
    onSuccess: ({ groupIds }) => {
      for (const groupId of groupIds) {
        qc.invalidateQueries({ queryKey: ['settlements', groupId] })
      }
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useDenySettlement() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ settlementIds, groupIds }: { settlementIds: string[]; groupIds: string[] }) => {
      // Deletes the whole batch, including any offsetting rows — the offset
      // only ever existed as part of that netting, so denying the payment
      // denies all of it (item 5 (a′)).
      //
      // Checked, not fire-and-forget: this DELETE failed on every attempt from
      // the day it was written until 20260805010000 (the trigger's FK
      // violation), and nothing noticed precisely because the error was
      // dropped here — PostgREST returns it in `error` rather than throwing.
      const { error } = await supabase.from('settlements').delete().in('id', settlementIds)
      if (error) throw error
      return { groupIds }
    },
    onSuccess: ({ groupIds }) => {
      for (const groupId of groupIds) {
        qc.invalidateQueries({ queryKey: ['settlements', groupId] })
      }
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
