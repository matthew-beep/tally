import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server'
import { calcNetBalances } from '@/lib/balance'
import type { Expense, Settlement } from '@/types'

export async function POST(request: Request) {
  const { groupId, memberId } = await request.json()
  if (!groupId || !memberId)
    return NextResponse.json({ error: 'groupId and memberId required' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceRoleClient()

  // Removing another member is admin-only — checked against the service-role
  // client so the answer never depends on the caller's RLS view.
  const { data: group } = await admin
    .from('groups')
    .select('id, created_by')
    .eq('id', groupId)
    .maybeSingle()
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  if (group.created_by !== user.id)
    return NextResponse.json({ error: 'Only the group creator can remove members' }, { status: 403 })

  const { data: target } = await admin
    .from('group_members')
    .select('id, status')
    .eq('id', memberId)
    .eq('group_id', groupId)
    .maybeSingle()
  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (target.status !== 'active')
    return NextResponse.json({ error: 'Member is not active' }, { status: 400 })

  // Recompute the balance server-side — never trust a client-supplied "it's
  // settled" claim for a destructive action.
  const { data: memberRows } = await admin
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .in('status', ['pending', 'active'])
  const memberIds = (memberRows ?? []).map((m: { id: string }) => m.id)

  const { data: expenses } = await admin
    .from('expenses')
    .select('*, splits:expense_splits(id, group_member_id, owed_amount)')
    .eq('group_id', groupId)
    .is('deleted_at', null)
  const { data: settlements } = await admin
    .from('settlements')
    .select('*')
    .eq('group_id', groupId)

  const net = calcNetBalances(groupId, (expenses ?? []) as Expense[], (settlements ?? []) as Settlement[], memberIds)
  if (Math.abs(net[memberId] ?? 0) >= 0.01)
    return NextResponse.json({ error: 'Member has an unsettled balance' }, { status: 400 })

  // Never DELETE — money tables FK to group_members.id and financial history
  // must survive. Same 'left' status the self-leave path uses.
  const { error } = await admin.from('group_members').update({ status: 'left' }).eq('id', memberId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
