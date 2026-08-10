'use client'

import type { ReactNode } from 'react'
import { T, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { EmojiTile } from '@/components/EmojiTile'
import { formatAmount } from '@/lib/money'
import type { FeedCardModel } from '@/types'

interface Props {
  model: FeedCardModel
  /** `compact` is the cross-group Activity size; `full` is group detail. */
  size?: 'compact' | 'full'
  /** Extra content below the row — the group feed passes ReactionPills here. */
  footer?: ReactNode
  /** Wrapper class, for the hover-reveal the reaction button hooks into. */
  className?: string
}

const SIZES = {
  compact: { pad: '11px 14px', tile: 34, tileFont: 17, tileRadius: T.r.sm, title: 13, sub: 11, amount: 13 },
  full:    { pad: '12px 14px', tile: 40, tileFont: 19, tileRadius: T.r.md, title: 14, sub: 11.5, amount: 13 },
} as const

const TONE = {
  neutral:  T.ink,
  positive: T.mintInk,
  negative: T.coralInk,
} as const

/**
 * One feed entry, in either feed. Takes a fully-resolved `FeedCardModel` and
 * derives nothing — all the "is this mine / what do I owe / who paid" work
 * happens in src/lib/feedCards.ts, where it can be tested.
 *
 * Both the Activity tab and group detail render this so the two are provably
 * the same object at two scopes rather than two lookalikes maintained apart.
 */
export function FeedCard({ model, size = 'full', footer, className }: Props) {
  const s = SIZES[size]
  const clickable = !!model.onClick

  return (
    <div
      className={className}
      onClick={model.onClick}
      style={{
        background: T.surface,
        borderRadius: T.r.md,
        padding: s.pad,
        boxShadow: T.shadowSm,
        cursor: clickable ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {model.icon.kind === 'emoji' ? (
          <EmojiTile emoji={model.icon.emoji} size={s.tile} fontSize={s.tileFont} radius={s.tileRadius} background={T.bg} />
        ) : (
          <SettlementIcon size={s.tile} radius={s.tileRadius} confirmed={model.icon.confirmed} />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: s.title, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {model.title}
            {model.titleTag && <span style={{ fontSize: 10.5, color: T.inkFaint, marginLeft: 5 }}>{model.titleTag}</span>}
          </div>

          <div style={{ fontSize: s.sub, color: T.inkMuted, marginTop: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            {model.statusTag && <StatusTag status={model.statusTag} />}
            {model.subtitle && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model.subtitle}</span>}

            {/* Desktop only — who the expense is split among */}
            {!!model.participants?.length && (
              <span className="feed-card-participants">
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: T.inkFaint }} />
                <span>split {model.participants.length} ways</span>
                <span style={{ display: 'inline-flex', marginLeft: 2 }}>
                  {model.participants.slice(0, 4).map((p, i) => (
                    <span key={p.id} style={{ marginLeft: i > 0 ? -6 : 0, borderRadius: '50%', border: `1.5px solid ${T.surface}`, display: 'inline-flex' }}>
                      <Avatar profile={p.avatar} slot={p.slot} size={16} isYou={p.isYou} />
                    </span>
                  ))}
                </span>
              </span>
            )}
          </div>
        </div>

        {model.amountTone && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: FMONO, fontSize: s.amount, fontWeight: 700, color: TONE[model.amountTone] }}>
              {model.amountCaption
                ? formatAmount(model.amountTone === 'negative' ? -model.amount : model.amount, { sign: true })
                : formatAmount(model.amount)}
            </div>
            {model.amountCaption && (
              <div style={{ fontSize: 10, color: T.inkFaint, marginTop: 1 }}>{model.amountCaption}</div>
            )}
          </div>
        )}
      </div>

      {footer}
    </div>
  )
}

function SettlementIcon({ size, radius, confirmed }: { size: number; radius: number; confirmed: boolean }) {
  const px = Math.round(size * 0.43)
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: confirmed ? T.mintInk : T.inkMuted, flexShrink: 0 }}>
      {confirmed ? (
        <svg width={px} height={px} viewBox="0 0 16 16" fill="none">
          <path d="M3 8.5l3.2 3.2L13 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width={px} height={px} viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 5v3.2l2.2 1.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}

function StatusTag({ status }: { status: 'pending' | 'confirmed' }) {
  const confirmed = status === 'confirmed'
  return (
    <span style={{ fontFamily: FMONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: confirmed ? T.mintInk : T.inkMuted, background: confirmed ? T.mintSoft : T.surfaceAlt, padding: '1px 6px', borderRadius: T.r.tag, flexShrink: 0 }}>
      {confirmed ? 'settled' : 'pending'}
    </span>
  )
}
