'use client'

import { T, FH, F } from '@/design/tokens'
import { DashboardPage } from '@/components/dashboard/DashboardPage'
import { Card } from '@/components/Card'
import { Btn } from '@/components/Btn'
import { useCreateGroup } from '@/queries/useGroups'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const EMOJIS = ['💸', '🏖️', '🍕', '✈️', '🏠', '🎉', '🛒', '🚗', '🍽️', '💪', '🎮', '❤️']

export default function NewGroupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('💸')
  const createGroup = useCreateGroup()

  async function handleCreate() {
    if (!name.trim()) return
    const group = await createGroup.mutateAsync({ name: name.trim(), emoji })
    router.push(`/groups/${group.id}`)
  }

  return (
    <DashboardPage>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: T.inkMuted, padding: 0 }}
          >
            ←
          </button>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: FH }}>New group</div>
        </div>

        <Card style={{ padding: 20 }}>
          {/* Emoji picker */}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 10 }}>
            Choose an emoji
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {EMOJIS.map(e => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: T.r.md,
                  fontSize: 22,
                  border: `2px solid ${emoji === e ? T.ink : T.line}`,
                  background: emoji === e ? T.surfaceAlt : T.bg,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {e}
              </button>
            ))}
          </div>

          {/* Name */}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 8 }}>
            Group name
          </div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Big Sur Trip, Apartment, etc."
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: T.r.md,
              border: `1.5px solid ${T.lineStrong}`,
              background: T.surfaceAlt,
              fontSize: 15,
              fontFamily: F,
              color: T.ink,
              outline: 'none',
            }}
          />

          <Btn
            fullWidth
            size="lg"
            onClick={handleCreate}
            disabled={!name.trim() || createGroup.isPending}
            style={{ marginTop: 20 }}
          >
            {createGroup.isPending ? 'Creating…' : `Create ${emoji} ${name || 'group'}`}
          </Btn>
        </Card>
    </DashboardPage>
  )
}
