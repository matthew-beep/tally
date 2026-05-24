import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { T, FH } from '@/design/tokens'

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect(`/login?redirect=/invite/${token}`)
  }

  const { data: group } = await supabase
    .from('groups')
    .select('id, name, emoji')
    .eq('invite_token', token)
    .single()

  if (!group) {
    return (
      <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', color: T.inkMuted }}>Invalid invite link.</div>
      </div>
    )
  }

  await supabase
    .from('group_members')
    .upsert({ group_id: group.id, user_id: session.user.id })

  redirect(`/groups/${group.id}`)
}
