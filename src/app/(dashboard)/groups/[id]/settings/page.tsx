'use client'

import { useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { T, F, FH, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { MemberCombobox } from '@/components/MemberCombobox'
import type { MemberEntry } from '@/components/MemberCombobox'
import { EmojiPicker } from '@/components/EmojiPicker'
import { GROUP_EMOJI } from '@/lib/emoji'
import { MemberActionSheet } from '@/components/MemberActionSheet'
import { InviteGroupSheet } from '@/components/InviteGroupSheet'
import { DeleteGroupSheet } from '@/components/DeleteGroupSheet'
import { useUpdateGroup, useLeaveGroup, useRemoveMember } from '@/queries/useGroups'
import { useGroupDetail } from '@/queries/useGroupDetail'
import { calcNetBalances } from '@/lib/balance'
import { postJson } from '@/lib/api'
import { avatarProfile, displayName, firstName, slotFor } from '@/lib/memberDisplay'
import { SectionLabel } from '@/components/SectionLabel'
import { Btn } from '@/components/Btn'
import { Card } from '@/components/Card'
import { formatAmount } from '@/lib/money'
import { PlusIcon } from 'lucide-react'

export default function GroupSettingsPage() {
  const params  = useParams()
  const groupId = params.id as string
  const router  = useRouter()
  const qc      = useQueryClient()

  const [editingName,  setEditingName]  = useState(false)
  const [draftName,    setDraftName]    = useState('')
  const [emojiOpen,    setEmojiOpen]    = useState(false)
  const emojiBtnRef = useRef<HTMLButtonElement | null>(null)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [pendingMembers, setPendingMembers] = useState<MemberEntry[]>([])
  const [adding,        setAdding]        = useState(false)
  const [addError,      setAddError]      = useState<string | null>(null)
  const [memberSheetId, setMemberSheetId] = useState<string | null>(null)
  const [deleteOpen,    setDeleteOpen]    = useState(false)
  const [leaveConfirm,  setLeaveConfirm]  = useState(false)
  const [inviteOpen,    setInviteOpen]    = useState(false)

  const { group, loadingGroup, members, loadingMembers, expenses, settlements, profile } = useGroupDetail(groupId)

  const updateGroup = useUpdateGroup()
  const leaveGroup   = useLeaveGroup()
  const removeMember = useRemoveMember()

  const memberIds = members.map(m => m.id)
  const net = calcNetBalances(groupId, expenses, settlements, memberIds)

  const activeMembers  = members.filter(m => m.status === 'active')
  const pendingInvites = members.filter(m => m.status === 'pending')
  const myMember = members.find(m => m.user_id === profile?.id)
  const others   = activeMembers.filter(m => m.id !== myMember?.id)
  const isAdmin  = !!group && !!profile && group.created_by === profile.id

  async function handleAddMembers() {
    if (!pendingMembers.length) return
    setAdding(true)
    setAddError(null)
    try {
      const payload = pendingMembers.map(entry =>
        entry.type === 'user'
          ? { type: 'user' as const, profileId: entry.profile.id, name: entry.profile.display_name ?? entry.profile.name }
          : { type: 'guest' as const, name: entry.name }
      )
      await postJson('/api/groups/members/add', { groupId, members: payload })
      qc.invalidateQueries({ queryKey: ['group_members', groupId] })
      setPendingMembers([])
      setAddMemberOpen(false)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add members')
    } finally {
      setAdding(false)
    }
  }

  function cancelAddMember() {
    setAddMemberOpen(false)
    setPendingMembers([])
    setAddError(null)
  }

  function startEditName() {
    if (!group) return
    setDraftName(group.name)
    setEditingName(true)
  }

  function commitName() {
    setEditingName(false)
    const trimmed = draftName.trim()
    if (!group || !trimmed || trimmed === group.name) return
    updateGroup.mutate({ groupId, name: trimmed, emoji: group.emoji })
  }

  function pickEmoji(emoji: string) {
    if (!group) return
    updateGroup.mutate({ groupId, name: group.name, emoji })
  }

  function handleLeave() {
    if (!myMember) return
    if (!leaveConfirm) { setLeaveConfirm(true); return }
    leaveGroup.mutate({ groupId, memberId: myMember.id }, {
      onSuccess: () => router.push('/groups'),
    })
  }

  const sheetMember = members.find(m => m.id === memberSheetId) ?? null

  if (loadingGroup || loadingMembers) {
    return <div style={{ padding: 28, fontFamily: F, color: T.inkMuted, fontSize: 14 }}>Loading…</div>
  }

  if (!group) {
    return (
      <div style={{ padding: 28, fontFamily: F, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 300 }}>
        <div style={{ fontSize: 40 }}>💸</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: T.ink }}>Group not found</div>
        <Btn onClick={() => router.push('/groups')} variant="dark" size="md" style={{ marginTop: 4, padding: '10px 20px', fontSize: 14 }}>
          Back to groups
        </Btn>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, minHeight: 0, height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', fontFamily: F, color: T.ink }}>

      {/* ── Header ── */}
      <header style={{ padding: '10px 16px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <button
          onClick={() => router.push(`/groups/${groupId}`)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, border: 0, background: 'transparent', cursor: 'pointer', font: 'inherit', color: T.sunInk, fontWeight: 700, fontSize: 15, padding: 0 }}
        >
          <svg width="9" height="15" viewBox="0 0 9 15" fill="none">
            <path d="M7.5 1.5L1.5 7.5L7.5 13.5" stroke={T.sunInk} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
        <span style={{ fontFamily: FH, fontSize: 17, fontWeight: 700, letterSpacing: -0.3, color: T.ink }}>Group Settings</span>
        <div style={{ width: 48 }} />
      </header>

      <div style={{ flex: 1, padding: '4px 16px 40px', maxWidth: 520, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {/* ── Group identity ── */}
        <SectionLabel style={{ padding: '14px 0 6px' }}>Group identity</SectionLabel>
        <Card tone="surface" style={{ border: `0.5px solid ${T.line}`, borderRadius: T.r.card, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            ref={emojiBtnRef}
            onClick={() => isAdmin && setEmojiOpen(o => !o)}
            disabled={!isAdmin}
            style={{ position: 'relative', width: 54, height: 54, borderRadius: T.r.card, fontSize: 28, border: `1.5px solid ${T.line}`, background: T.surfaceAlt, cursor: isAdmin ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            {group.emoji}
            {isAdmin && (
              <span style={{ position: 'absolute', bottom: -3, right: -3, width: 18, height: 18, borderRadius: '50%', background: T.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                  <path d="M8 1.5l2.5 2.5-6 6H2v-2.5l6-6z" stroke={T.bg} strokeWidth="1.4" strokeLinejoin="round"/>
                </svg>
              </span>
            )}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editingName ? (
              <input
                autoFocus
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                onBlur={commitName}
                onKeyDown={e => e.key === 'Enter' && commitName()}
                style={{ width: '100%', border: 0, borderBottom: `2px solid ${T.sun}`, outline: 'none', background: 'transparent', fontFamily: FH, fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: T.ink, padding: '2px 0 4px', boxSizing: 'border-box' }}
              />
            ) : (
              <div
                onClick={startEditName}
                style={{ fontFamily: FH, fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: T.ink, cursor: isAdmin ? 'text' : 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {group.name}
              </div>
            )}
            <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 2 }}>
              {!isAdmin ? 'Only the creator can rename' : editingName ? 'Press Enter to save' : 'Tap to rename'}
            </div>
          </div>
        </Card>

        <button
          onClick={() => setInviteOpen(true)}
          style={{ width: '100%', marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: T.r.card, border: `0.5px solid ${T.line}`, background: T.surface, boxShadow: T.shadowSm, cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
        >
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M7.5 10.5a3 3 0 004.24 0l2.5-2.5a3 3 0 00-4.24-4.24l-.9.9M10.5 7.5a3 3 0 00-4.24 0l-2.5 2.5a3 3 0 004.24 4.24l.9-.9" stroke={T.inkMuted} strokeWidth="1.5" strokeLinecap="round"/></svg>
          <span style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>Invite to group</span>
        </button>

        {/* ── Members ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 0 6px' }}>
          <SectionLabel>Members · {members.length}</SectionLabel>
          <button
            onClick={() => setAddMemberOpen(o => !o)}
            style={{ width: 26, height: 26, borderRadius: '50%', border: `1.5px solid ${T.sun}`, background: addMemberOpen ? T.sun : T.sunSoft, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: addMemberOpen ? T.sunOn : T.sunInk, fontSize: 16, lineHeight: 1, padding: 0, textAlign: 'center' }}
          >
            <PlusIcon size={16} />
          </button>
        </div>

        {addMemberOpen && (
          <Card tone="surface" style={{ marginBottom: 10, borderRadius: T.r.lg, padding: 14, border: `0.5px solid ${T.line}` }}>
            <MemberCombobox
              value={pendingMembers}
              onChange={setPendingMembers}
              excludeIds={members.filter(m => m.user_id).map(m => m.user_id!)}
              autoFocus
            />
            {addError && <div style={{ fontSize: 12, color: T.coralInk, marginTop: 8 }}>{addError}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={cancelAddMember}
                style={{ padding: '8px 14px', borderRadius: T.r.md, background: 'transparent', color: T.inkMuted, border: 0, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: F }}
              >
                Cancel
              </button>
              <Btn
                onClick={handleAddMembers}
                disabled={!pendingMembers.length || adding}
                variant="dark" size="md"
                style={{
                  padding: '8px 16px', fontSize: 13,
                }}
              >
                {adding ? 'Adding…' : pendingMembers.length ? `Add ${pendingMembers.length} to group` : 'Add to group'}
              </Btn>
            </div>
          </Card>
        )}

        <Card tone="surface" style={{ border: `0.5px solid ${T.line}`, borderRadius: T.r.card, overflow: 'hidden' }}>
          {myMember && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px' }}>
              <Avatar profile={avatarProfile(myMember)} slot={slotFor(members, myMember.id)} size={36} isYou />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>You</div>
                {profile?.handle && <div style={{ fontSize: 11, color: T.inkFaint, fontFamily: FMONO, marginTop: 1 }}>@{profile.handle}</div>}
              </div>
              {isAdmin && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: T.r.pill, background: T.sunSoft, color: T.sunInk }}>Admin</span>
              )}
            </div>
          )}

          {others.map((m, i) => {
            const name = displayName(m)
            const bal  = net[m.id] ?? 0
            const balColor = Math.abs(bal) < 0.01 ? T.inkFaint : bal > 0 ? T.mintInk : T.coralInk
            const balStr   = Math.abs(bal) < 0.01 ? 'Settled' : formatAmount(bal, { sign: true })
            return (
              <button
                key={m.id}
                onClick={() => setMemberSheetId(m.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: 'none', border: 0, borderTop: (myMember || i > 0) ? `0.5px solid ${T.line}` : 'none', cursor: 'pointer', font: 'inherit', fontFamily: F, textAlign: 'left' }}
              >
                <Avatar profile={avatarProfile(m)} slot={slotFor(members, m.id)} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{firstName(name)}</div>
                  <div style={{ fontSize: 11, color: balColor, marginTop: 1, fontWeight: 600 }}>{balStr}</div>
                </div>
                <svg width="7" height="12" viewBox="0 0 7 12" fill="none" style={{ flexShrink: 0, opacity: 0.25 }}>
                  <path d="M1 1l5 5-5 5" stroke={T.ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )
          })}

          {pendingInvites.length > 0 && (
            <>
              <SectionLabel size="sm" style={{ padding: '8px 14px 4px', borderTop: `0.5px solid ${T.line}` }}>
                Pending invite
              </SectionLabel>
              {pendingInvites.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', opacity: 0.6 }}>
                  <Avatar profile={avatarProfile(m)} slot={slotFor(members, m.id)} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.inkMuted }}>{displayName(m)}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: T.r.pill, background: T.surfaceAlt, color: T.inkFaint }}>⏳ Invited</span>
                </div>
              ))}
            </>
          )}
        </Card>

        {/* ── Danger zone ── */}
        <SectionLabel color={T.coralInk} style={{ opacity: 0.75, padding: '20px 0 6px' }}>Danger zone</SectionLabel>

        {isAdmin ? (
          <div style={{ background: T.coralSoft, border: `1px solid ${T.coral}`, borderRadius: T.r.card, padding: '13px 14px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.coralInk }}>Delete group</div>
            <div style={{ fontSize: 11.5, color: T.coralInk, opacity: 0.75, marginTop: 2, marginBottom: 12 }}>
              Permanently removes the group, its expenses, and settlements for everyone.
            </div>
            <Btn
              onClick={() => setDeleteOpen(true)} variant="dangerOutline" size="lg" fullWidth
              style={{ height: 44, borderRadius: T.r.md, fontFamily: FH, fontSize: 15, fontWeight: 600 }}
            >
              Delete group
            </Btn>
          </div>
        ) : (
          <div style={{ background: T.coralSoft, border: `1px solid ${T.coral}`, borderRadius: T.r.card, padding: '13px 14px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.coralInk }}>Leave group</div>
            <div style={{ fontSize: 11.5, color: T.coralInk, opacity: 0.75, marginTop: 2, marginBottom: 12 }}>
              {leaveConfirm ? 'Tap again to confirm — you\'ll stop seeing this group.' : 'You can rejoin later with an invite link.'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {leaveConfirm && (
                <Btn
                  onClick={() => setLeaveConfirm(false)} variant="outline" size="lg"
                  style={{ flex: 1, height: 44, borderRadius: T.r.md, fontFamily: FH, fontSize: 15, fontWeight: 600 }}
                >
                  Cancel
                </Btn>
              )}
              <Btn
                onClick={handleLeave}
                disabled={leaveGroup.isPending}
                variant={leaveConfirm ? 'danger' : 'dangerOutline'}
                size="lg"
                // boxShadow only in the confirm state, to drop `danger`'s coral glow inside the coralSoft panel.
                // Unconditionally would also wipe `dangerOutline`'s inset outline, which is its only border.
                style={{ flex: 1, height: 44, borderRadius: T.r.md, fontFamily: FH, fontSize: 15, fontWeight: 600, opacity: leaveGroup.isPending ? 0.6 : 1, ...(leaveConfirm ? { boxShadow: 'none' } : {}) }}
              >
                {leaveGroup.isPending ? 'Leaving…' : leaveConfirm ? 'Confirm leave' : 'Leave group'}
              </Btn>
            </div>
          </div>
        )}

      </div>

      <EmojiPicker
        open={emojiOpen}
        emojis={GROUP_EMOJI}
        selected={[group.emoji]}
        anchorRef={emojiBtnRef}
        onClose={() => setEmojiOpen(false)}
        onPick={pickEmoji}
      />

      <MemberActionSheet
        member={sheetMember}
        groupId={groupId}
        members={members}
        balance={sheetMember ? (net[sheetMember.id] ?? 0) : 0}
        slot={sheetMember ? slotFor(members, sheetMember.id) : 0}
        canRemove={isAdmin}
        removing={removeMember.isPending && removeMember.variables?.memberId === memberSheetId}
        onRemove={memberId => removeMember.mutate({ groupId, memberId }, { onSuccess: () => setMemberSheetId(null) })}
        onClose={() => setMemberSheetId(null)}
      />

      <InviteGroupSheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        groupName={group.name}
        groupEmoji={group.emoji}
        inviteToken={group.invite_token}
      />

      <DeleteGroupSheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        group={group}
        expenses={expenses}
        settlements={settlements}
        members={members}
        groupId={groupId}
      />

    </div>
  )
}
