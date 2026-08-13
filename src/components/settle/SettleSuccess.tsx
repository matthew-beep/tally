'use client'

import { Avatar } from '@/components/Avatar'
import { ModalContent } from '@/components/modal'
import { Btn } from '@/components/Btn'
import { formatAmount } from '@/lib/money'
import { firstName as getFirstName } from '@/lib/memberDisplay'
import { T, FH, FMONO } from '@/design/tokens'
import type { Profile } from '@/types'

interface SettleSuccessProps {
  name: string
  // The same narrow shape Avatar takes, so both callers can hand over what
  // they already hold — BalanceSheet a full Profile, SettleUpSheet a
  // Transfer's avatar — with no cast at either site.
  profile?: Pick<Profile, 'name' | 'display_name' | 'avatar_url'>
  slot: 0 | 1 | 2 | 3
  /** The net that actually moved — matches the figure on the review screen. */
  amount: number
  /** Taken from the inserted rows, so it is the database's answer, not a re-derivation. */
  status: 'pending' | 'confirmed'
  /** Rows written. >1 means several groups were zeroed by one payment. */
  groupCount: number
  onDone: () => void
}

/**
 * Acknowledgment shown after a settlement is written, shared by every creation
 * path (group-page settle, dashboard settle-all, dashboard single-group).
 *
 * Contained in the sheet as another screen rather than the full-bleed overlay
 * the design draws — `SFPaymentSent` renders at `position: absolute; inset: 0`
 * over the whole phone frame, which does not translate to a modal system that
 * already owns its own chrome.
 *
 * Three readings, because the design only wrote the first: a payment I made is
 * awaiting the other side, a payment I recorded as received is already
 * settled, and a batch zeroed several groups at once.
 */
export function SettleSuccess({
  name, profile, slot, amount, status, groupCount, onDone,
}: SettleSuccessProps) {
  const first = getFirstName(name)
  const awaiting = status === 'pending'
  const batched = groupCount > 1

  const headline = batched
    ? `Settled with ${first}`
    : awaiting
    ? 'Payment recorded'
    : 'Marked as settled'

  // The confirmation expectation is the whole point of the sentence: a pending
  // payment is not done until the other side says so, a confirmed one is.
  const body = awaiting
    ? <>{first} will confirm {formatAmount(amount)} when it arrives.</>
    : <>{first} has been notified. Nothing to confirm.</>

  const whole = Math.floor(Math.abs(amount)).toLocaleString()
  const cents = (Math.abs(amount) % 1).toFixed(2).slice(1)

  return (
    <ModalContent style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, textAlign: 'center', padding: '28px 24px 24px' }}>
      <div style={{
        width: 68, height: 68, borderRadius: 22, background: T.mintSoft,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
      }}>
        <svg width="32" height="32" viewBox="0 0 38 38" fill="none" aria-hidden>
          <path d="M9 19l6 6 14-14" stroke={T.mintInk} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 700, letterSpacing: -0.6, color: T.ink }}>
        {headline}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 1, lineHeight: 1, marginTop: 10 }}>
        <span style={{ fontFamily: FH, fontSize: 20, fontWeight: 500, color: T.ink, opacity: 0.55 }}>$</span>
        <span style={{ fontFamily: FH, fontSize: 40, fontWeight: 700, letterSpacing: -1.4, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{whole}</span>
        <span style={{ fontFamily: FMONO, fontSize: 17, fontWeight: 600, color: T.ink, opacity: 0.55 }}>{cents}</span>
      </div>

      {/* Only worth saying when it's true — a single settle already names its
          group everywhere the user just came from. */}
      {batched && (
        <div style={{ fontSize: 12.5, fontWeight: 600, color: T.inkMuted, marginTop: 6 }}>
          across {groupCount} groups
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, padding: '11px 16px', borderRadius: 14, background: T.surfaceAlt, maxWidth: 320 }}>
        <Avatar profile={profile} slot={slot} size={34} />
        <div style={{ textAlign: 'left', minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{first}</div>
          <div style={{ fontSize: 11.5, color: awaiting ? T.sunInk : T.mintInk, fontWeight: 600, marginTop: 1 }}>
            {awaiting ? '⏳ Awaiting confirmation' : '✓ Confirmed'}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12.5, lineHeight: 1.55, color: T.inkMuted, margin: '16px 0 0', maxWidth: 290 }}>
        {body}
      </p>

      <Btn
        onClick={onDone} variant="dark" size="lg" fullWidth
        style={{ maxWidth: 320, marginTop: 22, padding: 15, borderRadius: 16, fontSize: 16, letterSpacing: -0.2 }}
      >
        Done
      </Btn>
    </ModalContent>
  )
}
