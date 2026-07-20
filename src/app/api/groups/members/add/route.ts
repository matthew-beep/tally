import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server'
import { isOverLimit, HOUR } from '@/lib/rateLimit'

type MemberEntry =
  | { type: 'user'; profileId: string; name: string }
  | { type: 'guest'; name: string }

export async function POST(request: Request) {
  const { groupId, members } = await request.json()
  if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 })
  if (!Array.isArray(members) || members.length === 0)
    return NextResponse.json({ error: 'members required' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const invitedBy = user.id
  const admin = createServiceRoleClient()

  // Only active members may add people. Checked against the service-role
  // client so the answer never depends on the caller's RLS view.
  const { data: caller } = await admin
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', invitedBy)
    .eq('status', 'active')
    .maybeSingle()
  if (!caller) return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })

  // invited_by is set on guest rows too, so the limit covers the whole
  // insert surface (guests used to slip past it with invited_by NULL).
  const rateLimited = await isOverLimit(
    admin,
    { table: 'group_members', userCol: 'invited_by', timeCol: 'joined_at' },
    invitedBy, 30, HOUR
  )
  if (rateLimited) {
    return NextResponse.json(
      { error: 'Too many invites sent — try again later' },
      { status: 429, headers: { 'Retry-After': String(HOUR / 1000) } }
    )
  }

  const errors: string[] = []

  // Writes go through the service role: the client-facing INSERT policy is
  // self-join only (20260719120000), so privileged inserts happen here —
  // after the membership check above.
  for (const entry of members as MemberEntry[]) {
    if (entry.type === 'user') {
      // ignoreDuplicates: re-adding an existing member (pending or active)
      // is a no-op — never a demotion back to pending, never an error.
      const { error } = await admin
        .from('group_members')
        .upsert({
          group_id: groupId,
          user_id: entry.profileId,
          name: entry.name,
          status: 'pending',
          invited_by: invitedBy,
        }, { onConflict: 'group_id,user_id', ignoreDuplicates: true })
      if (error) errors.push(`user ${entry.profileId}: ${error.message}`)
    } else {
      // Guests are group_members rows with user_id = null — no profile
      // needed until Phase 2. Active immediately: no account, nobody to ask.
      const { error } = await admin
        .from('group_members')
        .insert({ group_id: groupId, user_id: null, name: entry.name, status: 'active', invited_by: invitedBy })
      if (error) errors.push(`guest ${entry.name}: ${error.message}`)
    }
  }

  if (errors.length === members.length) {
    return NextResponse.json({ error: 'All members failed to add', details: errors }, { status: 500 })
  }

  return NextResponse.json({ ok: true, errors: errors.length ? errors : undefined })
}
