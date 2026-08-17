'use client'

import { useState } from 'react'
import { T, FH, FMONO } from '@/design/tokens'
import { ModalOrSheet } from '@/components/modal'
import { Btn } from '@/components/Btn'
import { Card } from '@/components/Card'
import { copyToClipboard } from '@/lib/clipboard'
import { useUIStore } from '@/store/ui'

interface Props {
  open: boolean
  onClose: () => void
  groupName: string
  groupEmoji: string
  inviteToken: string
}

export function InviteGroupSheet({ open, onClose, groupName, groupEmoji, inviteToken }: Props) {
  const [copied, setCopied] = useState(false)
  const pushToast = useUIStore(s => s.pushToast)

  const link = typeof window !== 'undefined' ? `${window.location.origin}/invite/${inviteToken}` : ''

  async function handleCopy() {
    const ok = await copyToClipboard(link)
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1800) }
    else pushToast('Could not copy link')
  }

  async function handleShare() {
    if (navigator.share) {
      try { await navigator.share({ title: `Join ${groupName} on Tally`, url: link }) }
      catch { /* user cancelled the share sheet — not an error */ }
    } else {
      handleCopy()
    }
  }

  return (
    <ModalOrSheet open={open} onClose={onClose} title="Invite to group" maxWidth={400}>
      <div style={{ padding: '10px 22px 30px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 13, color: T.inkMuted }}>{groupEmoji} {groupName}</div>

        <Card tone="surface" style={{ border: `0.5px solid ${T.line}`, borderRadius: T.r.lg, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <svg width="15" height="15" viewBox="0 0 18 18" fill="none"><path d="M7.5 10.5a3 3 0 004.24 0l2.5-2.5a3 3 0 00-4.24-4.24l-.9.9M10.5 7.5a3 3 0 00-4.24 0l-2.5 2.5a3 3 0 004.24 4.24l.9-.9" stroke={T.inkMuted} strokeWidth="1.5" strokeLinecap="round"/></svg>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>Shareable link</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0, background: T.surfaceAlt, border: `1px solid ${T.line}`, borderRadius: T.r.md, padding: '11px 13px', fontFamily: FMONO, fontSize: 12.5, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {link.replace(/^https?:\/\//, '')}
            </div>
            <button
              onClick={handleCopy}
              style={{ flexShrink: 0, height: 40, padding: '0 16px', borderRadius: T.r.md, border: 0, cursor: 'pointer', background: copied ? T.mint : T.sun, color: copied ? 'white' : T.sunOn, fontFamily: FH, fontSize: 14, fontWeight: 700 }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 10, lineHeight: 1.45 }}>Anyone with this link can join and see this group&rsquo;s expenses.</div>
        </Card>

        <Btn
          onClick={handleShare} variant="primary" size="lg" fullWidth
          style={{ padding: '15px', borderRadius: T.r.lg, fontFamily: FH, fontSize: 15, fontWeight: 600 }}
        >
          Share invite link
        </Btn>
        <Btn
          onClick={onClose} variant="soft" size="lg" fullWidth
          style={{ padding: '15px', borderRadius: T.r.lg, fontFamily: FH, fontSize: 15, fontWeight: 600 }}
        >
          Done
        </Btn>
      </div>
    </ModalOrSheet>
  )
}
