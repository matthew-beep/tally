import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  const { groupId } = await request.json()
  if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 })

  // Verify the caller is authenticated
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  // Fetch the caller's profile
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, name, display_name')
    .eq('id', userId)
    .single()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Confirm a pending membership exists for this user in this group
  const { data: membership, error: memberErr } = await supabase
    .from('group_members')
    .select('status, invited_by')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .single()

  if (memberErr || !membership) {
    return NextResponse.json({ error: 'No pending membership found' }, { status: 404 })
  }

  // Use service role from here — needs to bypass RLS for expense_splits transfer
  const admin = createServiceRoleClient()

  // Create a guest profile to hold this person's expense slot
  const guestName = profile.display_name ?? profile.name ?? 'Guest'
  const { data: guestProfile, error: guestErr } = await admin
    .from('profiles')
    .insert({ name: guestName, status: 'guest' })
    .select('id')
    .single()

  if (guestErr || !guestProfile) {
    return NextResponse.json({ error: 'Failed to create guest profile' }, { status: 500 })
  }

  // Fetch all expense IDs in this group
  const { data: expenses } = await admin
    .from('expenses')
    .select('id')
    .eq('group_id', groupId)
    .is('deleted_at', null)

  const expenseIds = (expenses ?? []).map((e: { id: string }) => e.id)

  // Transfer expense splits from real user → guest profile
  if (expenseIds.length > 0) {
    await admin
      .from('expense_splits')
      .update({ user_id: guestProfile.id })
      .eq('user_id', userId)
      .in('expense_id', expenseIds)
  }

  // Delete pending row — fires notify_group_invite_declined trigger
  await admin
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('status', 'pending')

  // Insert guest as active member so their slot persists in the group
  await admin
    .from('group_members')
    .insert({ group_id: groupId, user_id: guestProfile.id, status: 'active' })

  return NextResponse.json({ ok: true })
}
