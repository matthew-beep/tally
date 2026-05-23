import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { T, FH } from '@/design/tokens'

export default async function AddByCodePage({ params }: { params: Promise<{ add_code: string }> }) {
  const { add_code } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect(`/login?redirect=/add/${add_code}`)
  }

  const { data: target } = await supabase
    .from('profiles')
    .select('id, name, display_name, avatar_url')
    .eq('add_code', add_code.toUpperCase())
    .single()

  if (!target) {
    return (
      <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: T.inkMuted }}>User not found for code <strong>{add_code}</strong>.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>👤</div>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: FH, marginBottom: 8 }}>
          Add {target.display_name ?? target.name} to a group
        </div>
        <div style={{ fontSize: 13, color: T.inkMuted, marginBottom: 24 }}>
          Go to a group and add this person as a member.
        </div>
        <a
          href="/groups"
          style={{ display: 'inline-block', background: T.ink, color: T.bg, borderRadius: T.r.md, padding: '12px 24px', fontSize: 14, fontWeight: 600, fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', textDecoration: 'none' }}
        >
          Go to Groups
        </a>
      </div>
    </div>
  )
}
