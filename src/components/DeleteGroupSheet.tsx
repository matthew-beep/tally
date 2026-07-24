'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { T, F, FH, FMONO } from '@/design/tokens'
import { useBodyScrollLock } from '@/components/modal/useBodyScrollLock'
import { useDeleteGroup } from '@/queries/useGroups'
import { calcNetBalances } from '@/lib/balance'
import type { Group, GroupMember, Expense, Settlement } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  group: Group
  expenses: Expense[]
  settlements: Settlement[]
  members: GroupMember[]
  groupId: string
}

export function DeleteGroupSheet({ open, onClose, group, expenses, settlements, members, groupId }: Props) {
  const router      = useRouter()
  const deleteGroup = useDeleteGroup()
  const [mounted, setMounted] = useState(false)
  const [typed,   setTyped]   = useState('')
  const [deleted, setDeleted] = useState(false)

  useEffect(() => setMounted(true), [])
  useBodyScrollLock(open)

  useEffect(() => {
    if (!open) { setTyped(''); setDeleted(false) }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !mounted) return null

  const activeMembers = members.filter(m => m.status === 'active')
  const net = calcNetBalances(groupId, expenses, settlements, activeMembers.map(m => m.id))
  const unsettledCount = activeMembers.filter(m => Math.abs(net[m.id] ?? 0) >= 0.01).length
  const canDelete = unsettledCount === 0
  const confirmed = canDelete && typed.trim().toUpperCase() === 'DELETE'

  if (deleted) {
    return createPortal(
      <div style={{ position: 'fixed', inset: 0, zIndex: 300 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: `${T.r.sheet}px ${T.r.sheet}px 0 0`, background: T.bg, padding: '32px 24px 52px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center', boxShadow: T.shadowModal, animation: 'tally-slideup 0.28s cubic-bezier(.34,1.0,.5,1)' }}>
          <div style={{ width: 72, height: 72, borderRadius: T.r.xl, background: T.coralSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M6 10h20M12 10V7h8v3M10 10l2 16h12l2-16" stroke={T.coralInk} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 700, letterSpacing: -0.6, color: T.ink, marginBottom: 6 }}>{group.name} deleted</div>
            <div style={{ fontSize: 13.5, color: T.inkMuted, lineHeight: 1.55, maxWidth: 240 }}>
              All expenses and settlements have been removed for all {members.length} members.
            </div>
          </div>
          <button
            onClick={() => router.push('/groups')}
            style={{ width: '100%', padding: '15px', borderRadius: T.r.lg, background: T.surface, border: 0, cursor: 'pointer', font: 'inherit', fontFamily: F, fontSize: 15, fontWeight: 700, color: T.ink, marginTop: 8, boxShadow: `inset 0 0 0 1px ${T.lineStrong}` }}
          >
            Back to groups
          </button>
        </div>
      </div>,
      document.body,
    )
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 300 }}>
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', animation: 'tally-fade 0.18s ease' }}
      />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: `${T.r.sheet}px ${T.r.sheet}px 0 0`, background: T.bg, boxShadow: T.shadowModal, animation: 'tally-slideup 0.28s cubic-bezier(.34,1.0,.5,1)' }}>

        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 38, height: 5, borderRadius: 3, background: T.lineStrong }} />
        </div>

        <div style={{ padding: '22px 22px 44px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: T.r.card, background: T.coralSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 6h12M8 6V4h4v2M7 6l1 10h4l1-10" stroke={T.coralInk} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 700, letterSpacing: -0.5, color: T.ink }}>Delete {group.name}?</div>
              <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 2 }}>This can't be undone</div>
            </div>
          </div>

          {/* Impact summary */}
          <div style={{ background: T.coralSoft, borderRadius: T.r.card, padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { icon: '🗑️', text: `${expenses.length} expense${expenses.length !== 1 ? 's' : ''} deleted` },
              { icon: '👥', text: `Removed for all ${members.length} members` },
              canDelete
                ? { icon: '✅', text: 'All settled — ready to delete' }
                : { icon: '⚠️', text: `${unsettledCount} member${unsettledCount > 1 ? 's have' : ' has'} unsettled balances` },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: T.coralInk }}>
                <span style={{ fontSize: 15 }}>{row.icon}</span>
                <span style={{ fontWeight: 600 }}>{row.text}</span>
              </div>
            ))}
          </div>

          {/* Type to confirm */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.3, color: T.inkMuted, marginBottom: 8 }}>
              {canDelete
                ? <>Type <span style={{ fontFamily: FMONO, color: T.coralInk, letterSpacing: 1.5 }}>DELETE</span> to confirm</>
                : 'Settle all balances before deleting'}
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={typed}
                onChange={e => setTyped(e.target.value)}
                placeholder="DELETE"
                disabled={!canDelete}
                style={{ width: '100%', padding: '13px 14px', borderRadius: T.r.md, boxSizing: 'border-box', background: T.surfaceAlt, border: confirmed ? `1.5px solid ${T.coral}` : `1px solid ${T.lineStrong}`, fontFamily: FMONO, fontSize: 15, fontWeight: 700, color: confirmed ? T.coralInk : T.ink, letterSpacing: confirmed ? 2 : 0.5, outline: 'none', transition: 'border 0.15s, color 0.15s', opacity: canDelete ? 1 : 0.5 }}
              />
              {confirmed && (
                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <circle cx="9" cy="9" r="8" fill={T.coral}/>
                    <path d="M5.5 9l2.5 2.5L13 6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={async () => {
                if (!confirmed || deleteGroup.isPending) return
                await deleteGroup.mutateAsync(groupId)
                setDeleted(true)
              }}
              style={{ width: '100%', padding: '15px', borderRadius: T.r.lg, background: confirmed ? T.coral : T.lineStrong, color: confirmed ? '#fff' : T.inkFaint, border: 0, cursor: confirmed ? 'pointer' : 'default', font: 'inherit', fontFamily: FH, fontSize: 16, fontWeight: 700, letterSpacing: -0.2, boxShadow: confirmed ? `0 8px 24px rgba(239,97,68,0.36)` : 'none', transition: 'background 0.2s, box-shadow 0.2s', opacity: deleteGroup.isPending ? 0.6 : 1 }}
            >
              {deleteGroup.isPending ? 'Deleting…' : 'Delete group forever'}
            </button>
            <button
              onClick={onClose}
              style={{ width: '100%', padding: '13px', borderRadius: T.r.lg, background: 'transparent', border: 0, cursor: 'pointer', font: 'inherit', fontFamily: F, fontSize: 15, fontWeight: 600, color: T.inkMuted, boxShadow: `inset 0 0 0 1px ${T.lineStrong}` }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
