'use client'

import { useEffect, useState } from 'react'
import { T, F, FH, FMONO } from '@/design/tokens'
import { ModalOrSheet } from '@/components/modal'
import { Btn } from '@/components/Btn'
import { Card } from '@/components/Card'
import { Avatar } from '@/components/Avatar'
import { avatarProfile, displayName, firstName } from '@/lib/memberDisplay'
import { formatAmount } from '@/lib/money'
import { copyToClipboard } from '@/lib/clipboard'
import { useUIStore } from '@/store/ui'
import { useSearchProfiles } from '@/queries/useProfile'
import type { ProfileSnippet } from '@/queries/useProfile'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useInviteGuestToSeat } from '@/queries/useGroups'
import type { GroupMember } from '@/types'

interface Props {
  member: GroupMember | null
  groupId: string
  members: GroupMember[]
  balance: number
  slot: 0 | 1 | 2 | 3
  canRemove: boolean
  removing: boolean
  onRemove: (memberId: string) => void
  onClose: () => void
}

interface Display {
  member: GroupMember
  groupId: string
  balance: number
  slot: 0 | 1 | 2 | 3
  canRemove: boolean
}

// Guest rows get a dedicated two-path flow (search + confirmation-required
// invite, or a self-serve claim link) instead of the plain "Remove" sheet
// real members get. Both paths key off the guest's own group_members row —
// no new row is ever inserted, so expense_splits/settlements continuity
// holds regardless of which path is taken.
type GuestView = 'action' | 'search' | 'confirm' | 'sent' | 'claim'

export function MemberActionSheet({ member, groupId, members, balance, slot, canRemove, removing, onRemove, onClose }: Props) {
  // Sticky copy of the last non-null props — ModalOrSheet stays mounted and
  // animates out based on `open`, not on `member` going null, so content
  // must keep rendering from something that doesn't disappear on close.
  const [display, setDisplay] = useState<Display | null>(member ? { member, groupId, balance, slot, canRemove } : null)
  useEffect(() => {
    if (member) setDisplay({ member, groupId, balance, slot, canRemove })
  }, [member, groupId, balance, slot, canRemove])

  const [guestView, setGuestView] = useState<GuestView>('action')
  const [pick, setPick] = useState<ProfileSnippet | null>(null)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query.trim(), 250)
  const { data: results = [] } = useSearchProfiles(debouncedQuery)
  const [claimCopied, setClaimCopied] = useState(false)
  const pushToast = useUIStore(s => s.pushToast)
  const inviteToSeat = useInviteGuestToSeat()

  // Profiles already seated in this group — filtered out of search so a
  // pick never walks the user to "confirm" only to hit the route's 409.
  const existingProfileIds = new Set(members.map(m => m.user_id).filter((id): id is string => !!id))
  const pickableResults = results.filter(u => !existingProfileIds.has(u.id))

  // Reset the guest sub-flow whenever a *different* member opens — keyed on
  // id, not object identity. `members` (and so `member`) gets a new array/
  // object identity on every refetch of ['group_members', groupId] —
  // including the refetch triggered by this sheet's own successful mutation
  // — so keying on the object itself reset guestView back to 'action' right
  // after landing on 'sent', and wiped in-progress search state on any
  // window-focus refetch too.
  useEffect(() => {
    if (member) { setGuestView('action'); setPick(null); setQuery(''); setClaimCopied(false) }
  }, [member?.id])

  if (!display) return null

  // Once a guest seat gets linked (Path B), the underlying member row
  // flips user_id from null to set on the next refetch — but guestView may
  // still be 'confirm' or 'sent' from the flow that caused it. Keep
  // rendering the guest views through those terminal-ish states rather than
  // snapping back to the plain member sheet under the user's feet.
  const isGuest = !display.member.user_id || guestView === 'confirm' || guestView === 'sent'
  const settled   = Math.abs(display.balance) < 0.01
  const removable = display.canRemove && settled
  const name = displayName(display.member)

  function handleSendInvite() {
    if (!pick) return
    inviteToSeat.mutate(
      { groupId: display!.groupId, memberId: display!.member.id, profileId: pick.id },
      { onSuccess: () => setGuestView('sent'), onError: () => pushToast('Could not send that invite — try again') }
    )
  }

  async function handleCopyClaimLink() {
    const link = `${window.location.origin}/claim/${display!.member.seat_token}`
    const ok = await copyToClipboard(link)
    if (ok) { setClaimCopied(true); pushToast('Claim link copied') }
    else pushToast('Could not copy link')
  }

  return (
    <ModalOrSheet open={!!member} onClose={onClose} title={displayName(display.member)} maxWidth={400}>
      <div style={{ padding: '10px 22px 30px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {isGuest && guestView !== 'action' && (
          <button
            onClick={() => setGuestView('action')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', background: 'none', border: 0, cursor: 'pointer', padding: 0, color: T.inkMuted, font: 'inherit', fontSize: 13, fontWeight: 600 }}
          >
            <svg width="14" height="14" viewBox="0 0 20 20"><path d="M12 4l-6 6 6 6" stroke={T.inkMuted} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back
          </button>
        )}

        {(!isGuest || guestView === 'action') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar profile={avatarProfile(display.member)} slot={display.slot} size={52} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 700, letterSpacing: -0.3, color: T.ink }}>{name}</div>
              {display.member.profile?.handle && (
                <div style={{ fontSize: 12, color: T.inkFaint, fontFamily: FMONO, marginTop: 2 }}>@{display.member.profile.handle}</div>
              )}
              {isGuest && <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 2 }}>Guest · no account</div>}
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: T.r.pill, background: settled ? T.mintSoft : display.balance > 0 ? T.mintSoft : T.coralSoft, color: settled ? T.mintInk : display.balance > 0 ? T.mintInk : T.coralInk }}>
              {settled ? 'Settled ✓' : formatAmount(display.balance, { sign: true })}
            </span>
          </div>
        )}

        {isGuest && guestView === 'action' && (
          <>
            <button
              onClick={() => setGuestView('search')}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderRadius: T.r.lg, border: `0.5px solid ${T.line}`, background: T.surface, boxShadow: T.shadowSm, cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 12, background: T.sunSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: T.sunInk }}>
                <svg width="20" height="20" viewBox="0 0 18 18" fill="none"><path d="M7.5 10.5a3 3 0 004.24 0l2.5-2.5a3 3 0 00-4.24-4.24l-.9.9M10.5 7.5a3 3 0 00-4.24 0l-2.5 2.5a3 3 0 004.24 4.24l.9-.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>Link to a Tally account</div>
                <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 2, lineHeight: 1.4 }}>Send {firstName(name)} an invite to confirm they're this person.</div>
              </div>
            </button>

            <button
              onClick={() => setGuestView('claim')}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderRadius: T.r.lg, border: `0.5px solid ${T.line}`, background: T.surface, boxShadow: T.shadowSm, cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 12, background: T.lavSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: T.lavInk }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 8l6 4 6-4M4 6h12v9H4z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>Invite {firstName(name)} to claim this spot</div>
                <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 2, lineHeight: 1.4 }}>Send a link — they sign up and take it over themselves.</div>
              </div>
            </button>
          </>
        )}

        {isGuest && guestView === 'search' && (
          <>
            <div style={{ background: T.surfaceAlt, borderRadius: T.r.md, padding: '10px 13px', display: 'flex', alignItems: 'center', gap: 9 }}>
              <svg width="14" height="14" viewBox="0 0 18 18" fill="none" style={{ opacity: 0.4, flexShrink: 0 }}><circle cx="8" cy="8" r="5.5" stroke={T.ink} strokeWidth="1.7"/><path d="M12.5 12.5L16 16" stroke={T.ink} strokeWidth="1.7" strokeLinecap="round"/></svg>
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search name, @handle, or add code"
                style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', font: 'inherit', fontSize: 14, fontWeight: 500, color: T.ink }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
              {debouncedQuery.length < 2 && (
                <div style={{ fontSize: 12.5, color: T.inkFaint, padding: '4px 4px' }}>Keep typing to search Tally users.</div>
              )}
              {debouncedQuery.length >= 2 && pickableResults.length === 0 && (
                <div style={{ fontSize: 12.5, color: T.inkFaint, padding: '4px 4px' }}>No users found for &ldquo;{debouncedQuery}&rdquo;</div>
              )}
              {pickableResults.map(u => (
                <button
                  key={u.id}
                  onClick={() => { setPick(u); setGuestView('confirm') }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: T.r.md, background: T.surfaceAlt, border: 0, cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
                >
                  <Avatar profile={u} slot={0} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{u.display_name ?? u.name}</div>
                    {u.handle && <div style={{ fontSize: 11, color: T.inkFaint, fontFamily: FMONO, marginTop: 1 }}>@{u.handle}</div>}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {isGuest && guestView === 'confirm' && pick && (
          <>
            <div style={{ fontSize: 13, color: T.inkMuted, lineHeight: 1.5 }}>
              We&rsquo;ll ask <strong style={{ color: T.ink }}>{pick.display_name ?? pick.name}</strong> to confirm before anything changes. Nothing moves until they accept.
            </div>
            <div style={{ background: T.surfaceAlt, borderRadius: T.r.md, padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 9 }}>
              {[
                ['Guest seat', firstName(name)],
                ['Linking to', pick.display_name ?? pick.name],
                ['Balance carried over', formatAmount(display.balance, { sign: true })],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                  <span style={{ color: T.inkMuted }}>{k}</span>
                  <span style={{ fontWeight: 700, color: T.ink }}>{v}</span>
                </div>
              ))}
            </div>
            <Btn
              onClick={handleSendInvite} disabled={inviteToSeat.isPending} variant="primary" size="lg" fullWidth
              style={{ padding: '15px', borderRadius: T.r.lg, background: T.sun, color: T.sunOn, fontFamily: FH, fontSize: 15, fontWeight: 600, opacity: inviteToSeat.isPending ? 0.7 : 1 }}
            >
              {inviteToSeat.isPending ? 'Sending…' : 'Send invite'}
            </Btn>
          </>
        )}

        {isGuest && guestView === 'sent' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ width: 60, height: 60, borderRadius: 20, background: T.mintSoft, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M4 8l8 5 8-5M4 6h16v12H4z" stroke={T.mintInk} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{ fontFamily: FH, fontSize: 19, fontWeight: 700, color: T.ink }}>Invite sent</div>
            <div style={{ fontSize: 13, color: T.inkMuted, marginTop: 8, lineHeight: 1.5 }}>
              We&rsquo;ll let you know when {pick?.display_name ?? pick?.name} confirms.
            </div>
          </div>
        )}

        {isGuest && guestView === 'claim' && (
          <>
            <div style={{ fontSize: 13, color: T.inkMuted, lineHeight: 1.5 }}>
              Send this to {firstName(name)}. When they sign up, this spot and its history move to their account automatically.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0, background: T.surfaceAlt, border: `1px solid ${T.line}`, borderRadius: T.r.md, padding: '11px 13px', fontFamily: FMONO, fontSize: 12.5, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {typeof window !== 'undefined' ? `${window.location.host}/claim/${display.member.seat_token}` : ''}
              </div>
              <button
                onClick={handleCopyClaimLink}
                style={{ flexShrink: 0, height: 40, padding: '0 16px', borderRadius: T.r.md, border: 0, cursor: 'pointer', background: claimCopied ? T.mint : T.sun, color: claimCopied ? 'white' : T.sunOn, fontFamily: FH, fontSize: 14, fontWeight: 700 }}
              >
                {claimCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </>
        )}

        {(!isGuest || guestView === 'action') && display.canRemove && (
          <Card tone="surface" style={{ border: `0.5px solid ${T.line}`, borderRadius: T.r.card, overflow: 'hidden' }}>
            {!settled && (
              <div style={{ padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 8, background: T.coralSoft }}>
                <span style={{ fontSize: 12, color: T.coralInk, fontWeight: 600 }}>
                  Settle {formatAmount(display.balance)} first before removing
                </span>
              </div>
            )}
            <button
              onClick={() => removable && !removing && onRemove(display.member.id)}
              disabled={!removable || removing}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: 'none', border: 0, borderTop: !settled ? `0.5px solid ${T.line}` : 'none', cursor: removable ? 'pointer' : 'default', font: 'inherit', fontFamily: F, textAlign: 'left', opacity: removable ? 1 : 0.4 }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: T.coralInk }}>
                {removing ? 'Removing…' : 'Remove from group'}
              </span>
            </button>
          </Card>
        )}

        <Btn
          onClick={onClose} variant="soft" size="lg" fullWidth
          style={{ padding: '15px', borderRadius: T.r.lg, fontFamily: FH, fontSize: 15, fontWeight: 600 }}
        >
          {guestView === 'sent' || guestView === 'claim' ? 'Done' : 'Cancel'}
        </Btn>
      </div>
    </ModalOrSheet>
  )
}
