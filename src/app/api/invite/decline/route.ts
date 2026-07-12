import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server'

// Decline a pending group invite.
//
// If the invitee was never included in any financial records, the pending row
// is deleted (DELETE trigger notifies the inviter). If they already appear in
// splits/expenses/settlements, deleting the row would cascade-delete their
// expense_splits and corrupt balances — instead the seat converts to a guest:
// user_id → NULL, status → 'active'. Splits keep pointing at the same
// group_members row, so history and balances are untouched. The UPDATE trigger
// (see 20260711000000_decline_to_guest.sql) notifies the inviter.
export async function POST(request: Request) {
  const { groupId } = await request.json()
  if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership, error: memberErr } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', session.user.id)
    .eq('status', 'pending')
    .single()

  if (memberErr || !membership) {
    return NextResponse.json({ error: 'No pending membership found' }, { status: 404 })
  }

  const admin = createServiceRoleClient()

  // Any financial reference to this seat? Include soft-deleted expenses —
  // their splits must survive too.
  const [splits, paid, settled] = await Promise.all([
    admin.from('expense_splits').select('id').eq('group_member_id', membership.id).limit(1),
    admin.from('expenses').select('id').eq('paid_by', membership.id).limit(1),
    admin.from('settlements').select('id')
      .or(`from_member_id.eq.${membership.id},to_member_id.eq.${membership.id}`)
      .limit(1),
  ])
  const hasHistory =
    (splits.data?.length ?? 0) > 0 ||
    (paid.data?.length ?? 0) > 0 ||
    (settled.data?.length ?? 0) > 0

  if (hasHistory) {
    const { error } = await admin
      .from('group_members')
      .update({ user_id: null, status: 'active', invited_by: null })
      .eq('id', membership.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await admin
      .from('group_members')
      .delete()
      .eq('id', membership.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, convertedToGuest: hasHistory })
}
