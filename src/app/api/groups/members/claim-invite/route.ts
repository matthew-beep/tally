import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server'

// Path B — an active member attaches a specific known Tally user to a guest
// seat. Unlike Path A (self-claim, an RLS-governed client UPDATE), the actor
// here isn't the one whose identity is being attached, so this requires the
// same confirmation the search-invite flow already requires: the seat moves
// to 'pending' with invited_by set, not straight to 'active'. The target
// must accept via the normal group_invite notification flow before it counts.
export async function POST(request: Request) {
  const { groupId, memberId, profileId } = await request.json()
  if (!groupId || !memberId || !profileId)
    return NextResponse.json({ error: 'groupId, memberId, and profileId required' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceRoleClient()

  // Only active members may attach someone to a guest seat — checked against
  // the service-role client so the answer never depends on the caller's RLS view.
  const { data: caller } = await admin
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()
  if (!caller) return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })

  // Pre-check turns the UNIQUE (group_id, user_id) constraint's raw 23505
  // into a friendly message instead of a generic 500.
  const { data: existing } = await admin
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', profileId)
    .maybeSingle()
  if (existing) return NextResponse.json({ error: 'This person is already in the group' }, { status: 409 })

  // Name comes from the target's own profile, not the client — the caller
  // only picked which profile to attach, not what to call it.
  const { data: targetProfile } = await admin
    .from('profiles')
    .select('name, display_name')
    .eq('id', profileId)
    .maybeSingle()
  if (!targetProfile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  const name = targetProfile.display_name ?? targetProfile.name

  const { data: updated, error } = await admin
    .from('group_members')
    .update({ user_id: profileId, status: 'pending', invited_by: user.id, name })
    .eq('id', memberId)
    .eq('group_id', groupId)
    .is('user_id', null)
    .eq('status', 'active')
    .select('id')
    .maybeSingle()

  if (error?.code === '23505')
    return NextResponse.json({ error: 'This person is already in the group' }, { status: 409 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated) return NextResponse.json({ error: 'This seat is no longer available' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
