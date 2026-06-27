'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, F } from '@/design/tokens'
import { Modal } from '@/components/modal'
import { Btn } from '@/components/Btn'
import { MemberCombobox } from '@/components/MemberCombobox'
import type { MemberEntry } from '@/components/MemberCombobox'
import { useCreateGroup } from '@/queries/useGroups'
import { useCurrentProfile } from '@/queries/useProfile'
import { useUIStore } from '@/store/ui'

const EMOJIS = ['💸', '🏖️', '🍕', '✈️', '🏠', '🎉', '🛒', '🚗', '🍽️', '💪', '🎮', '❤️']

export function NewGroupModal() {
  const router = useRouter()
  const open = useUIStore(s => s.newGroupOpen)
  const setOpen = useUIStore(s => s.setNewGroupOpen)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('💸')
  const [members, setMembers] = useState<MemberEntry[]>([])
  const createGroup = useCreateGroup()
  const { data: profile } = useCurrentProfile()

  useEffect(() => {
    if (!open) {
      setName('')
      setEmoji('💸')
      setMembers([])
    }
  }, [open])

  function handleClose() {
    if (createGroup.isPending) return
    setOpen(false)
  }

  async function handleCreate() {
    if (!name.trim() || createGroup.isPending) return
    try {
      const creatorName = profile?.display_name ?? profile?.name ?? 'Unknown'
      const mappedMembers = members.map(entry =>
        entry.type === 'user'
          ? { type: 'user' as const, profileId: entry.profile.id, name: entry.profile.display_name ?? entry.profile.name }
          : { type: 'guest' as const, name: entry.name }
      )
      const { id } = await createGroup.mutateAsync({ name: name.trim(), emoji, creatorName, members: mappedMembers })
      setOpen(false)
      router.push(`/groups/${id}`)
    } catch {
      // keep modal open on error
    }
  }

  const labelStyle = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.07em',
    textTransform: 'uppercase' as const,
    color: T.inkMuted,
  }

  return (
    <>
      <Modal open={open} onClose={handleClose}>
        <Modal.Header title="New group" />
        <Modal.Content>
          <div style={{ ...labelStyle, marginBottom: 10 }}>Choose an emoji</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {EMOJIS.map(e => (
              <button
                key={e}
                type="button"
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

          <div style={{ ...labelStyle, marginBottom: 8 }}>Group name</div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Big Sur Trip, Apartment, etc."
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus={open}
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

          {/* Members */}
          <div style={{ ...labelStyle, marginTop: 20, marginBottom: 8 }}>Members</div>
          <MemberCombobox value={members} onChange={setMembers} />
        </Modal.Content>
        <Modal.Footer>
          <Btn variant="ghost" onClick={handleClose} disabled={createGroup.isPending}>
            Cancel
          </Btn>
          <Btn onClick={handleCreate} disabled={!name.trim() || createGroup.isPending}>
            {createGroup.isPending
              ? 'Creating…'
              : `Create ${emoji} ${name.trim() || 'group'}${members.length > 0 ? ` · ${members.length + 1}` : ''}`}
          </Btn>
        </Modal.Footer>
      </Modal>

    </>
  )
}
