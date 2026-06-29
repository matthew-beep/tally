import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

type MemberEntry =
  | { type: 'user'; profileId: string; name: string }
  | { type: 'guest'; name: string }

export async function POST(request: Request) {
  const { groupId, members } = await request.json()
  if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 })
  if (!Array.isArray(members) || members.length === 0)
    return NextResponse.json({ error: 'members required' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const invitedBy = session.user.id

  const errors: string[] = []

  for (const entry of members as MemberEntry[]) {
    if (entry.type === 'user') {
      const { error } = await supabase
        .from('group_members')
        .upsert({
          group_id: groupId,
          user_id: entry.profileId,
          name: entry.name,
          status: 'pending',
          invited_by: invitedBy,
        })
      if (error) errors.push(`user ${entry.profileId}: ${error.message}`)
    } else {
      // Guests are group_members rows with user_id = null — no profile needed until Phase 2
      const { error } = await supabase
        .from('group_members')
        .insert({ group_id: groupId, user_id: null, name: entry.name, status: 'active' })
      if (error) errors.push(`guest ${entry.name}: ${error.message}`)
    }
  }

  if (errors.length === members.length) {
    return NextResponse.json({ error: 'All members failed to add', details: errors }, { status: 500 })
  }

  return NextResponse.json({ ok: true, errors: errors.length ? errors : undefined })
}
