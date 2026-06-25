import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

type MemberEntry =
  | { type: 'user'; profileId: string; name: string }
  | { type: 'guest'; name: string }

export async function POST(request: Request) {
  const { name, emoji, creatorName, members } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (!creatorName?.trim()) return NextResponse.json({ error: 'creatorName required' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({ name: name.trim(), emoji: emoji ?? '💸', created_by: userId })
    .select()
    .single()

  if (groupError || !group) {
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })
  }

  const memberRows = [
    { group_id: group.id, user_id: userId, name: creatorName, status: 'active' },
    ...(members ?? [] as MemberEntry[]).map((entry: MemberEntry) =>
      entry.type === 'user'
        ? { group_id: group.id, user_id: entry.profileId, name: entry.name, status: 'pending', invited_by: userId }
        : { group_id: group.id, user_id: null, name: entry.name, status: 'active' }
    ),
  ]

  const { error: membersError } = await supabase.from('group_members').insert(memberRows)

  return NextResponse.json({
    id: group.id,
    membersError: membersError ? 'Some members could not be added' : null,
  })
}
