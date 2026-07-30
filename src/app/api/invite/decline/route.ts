import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server'

// Decline a pending group invite: always convert the seat to a guest rather
// than deleting the row (user_id -> NULL, status -> 'active'). Splits keep
// pointing at the same group_members row either way, so this is simpler than
// branching on financial history for no real benefit. The on_group_member_updated
// trigger (see 20260729000000_wire_group_invite_notifications.sql) notifies
// the inviter.
export async function POST(request: Request) {
  const { groupId } = await request.json()
  if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Session client on purpose: the caller must be able to see this row
  // themselves (own-row SELECT policy) — proves it's their own membership.
  const { data: membership, error: memberErr } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .single()

  if (memberErr || !membership) {
    return NextResponse.json({ error: 'No pending membership found' }, { status: 404 })
  }

  const admin = createServiceRoleClient()
  const { error } = await admin
    .from('group_members')
    .update({ user_id: null, status: 'active', invited_by: null })
    .eq('id', membership.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
