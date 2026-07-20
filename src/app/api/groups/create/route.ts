import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server'
import { isOverLimit, HOUR } from '@/lib/rateLimit'

type MemberEntry =
  | { type: 'user'; profileId: string; name: string }
  | { type: 'guest'; name: string }

export async function POST(request: Request) {
  const { name, emoji, creatorName, members } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (!creatorName?.trim()) return NextResponse.json({ error: 'creatorName required' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = user.id

  const admin = createServiceRoleClient()
  const rateLimited = await isOverLimit(
    admin,
    { table: 'groups', userCol: 'created_by', timeCol: 'created_at' },
    userId, 10, HOUR
  )
  if (rateLimited) {
    return NextResponse.json(
      { error: 'Too many groups created — try again later' },
      { status: 429, headers: { 'Retry-After': String(HOUR / 1000) } }
    )
  }

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({ name: name.trim(), emoji: emoji ?? '💸', created_by: userId })
    .select()
    .single()

  if (groupError || !group) {
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })
  }

  // Creator first, alone: if this fails the group must not exist — an
  // invitee row must never be able to poison the creator's membership
  // (they used to share one batch; one bad profileId orphaned the group).
  const { error: creatorError } = await admin
    .from('group_members')
    .insert({ group_id: group.id, user_id: userId, name: creatorName, status: 'active' })
  if (creatorError) {
    await admin.from('groups').delete().eq('id', group.id)
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })
  }

  // Invitees + guests separately; failure here leaves a valid group and is
  // reported, not swallowed. Service role: the client-facing INSERT policy
  // is self-join only (20260719120000).
  let membersError: string | null = null
  const inviteeRows = ((members ?? []) as MemberEntry[]).map(entry =>
    entry.type === 'user'
      ? { group_id: group.id, user_id: entry.profileId, name: entry.name, status: 'pending', invited_by: userId }
      : { group_id: group.id, user_id: null, name: entry.name, status: 'active', invited_by: userId }
  )
  if (inviteeRows.length > 0) {
    const { error } = await admin.from('group_members').insert(inviteeRows)
    membersError = error ? 'Some members could not be added' : null
  }

  return NextResponse.json({ id: group.id, membersError })
}
