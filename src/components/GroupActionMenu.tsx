'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { T, F, FH } from '@/design/tokens'
import { useBodyScrollLock } from '@/components/modal/useBodyScrollLock'
import type { Group } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  group: Group
  onAddMember: () => void
  onDeleteTap: () => void
}

const Chevron = () => (
  <svg width="6" height="11" viewBox="0 0 6 11" fill="none" style={{ opacity: 0.2 }}>
    <path d="M1 1l4 4.5L1 10" stroke={T.ink} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export function GroupActionMenu({ open, onClose, group, onAddMember, onDeleteTap }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useBodyScrollLock(open)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !mounted) return null

  const items = [
    {
      id: 'settings',
      icon: (
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="3" stroke={T.ink} strokeWidth="1.7"/>
          <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M15.78 4.22l-1.42 1.42M5.64 14.36l-1.42 1.42" stroke={T.ink} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ),
      label: 'Group settings',
      sub: null,
      danger: false,
      onClick: onClose,
    },
    {
      id: 'add-member',
      icon: (
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
          <circle cx="8" cy="7" r="3" stroke={T.ink} strokeWidth="1.7"/>
          <path d="M2 17c0-3.3 2.7-5 6-5" stroke={T.ink} strokeWidth="1.7" strokeLinecap="round"/>
          <path d="M15 12v4M13 14h4" stroke={T.ink} strokeWidth="1.7" strokeLinecap="round"/>
        </svg>
      ),
      label: 'Add member',
      sub: null,
      danger: false,
      onClick: () => { onAddMember(); onClose() },
    },
    {
      id: 'leave',
      icon: (
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
          <path d="M13 5l5 5-5 5M18 10H8M12 3H4a1 1 0 00-1 1v12a1 1 0 001 1h8" stroke={T.inkMuted} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      label: 'Leave group',
      sub: null,
      danger: false,
      onClick: onClose,
    },
    {
      id: 'delete',
      icon: (
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
          <path d="M4 6h12M8 6V4h4v2M7 6l1 10h4l1-10" stroke={T.coralInk} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      label: 'Delete group',
      sub: "Permanent — can't be undone",
      danger: true,
      onClick: () => { onDeleteTap(); onClose() },
    },
  ]

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 300 }}>
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.44)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', animation: 'tally-fade 0.18s ease' }}
      />
      <div style={{ position: 'absolute', left: 10, right: 10, bottom: 28, display: 'flex', flexDirection: 'column', gap: 10, animation: 'tally-slideup 0.26s cubic-bezier(.34,1.0,.5,1)' }}>

        {/* Actions card */}
        <div style={{ background: T.surface, borderRadius: T.r.panel, overflow: 'hidden', boxShadow: T.shadowModal }}>
          <div style={{ padding: '14px 18px 10px', fontSize: 12, fontWeight: 700, letterSpacing: 0.3, color: T.inkMuted, borderBottom: `0.5px solid ${T.line}`, fontFamily: F }}>
            {group.emoji} {group.name}
          </div>
          {items.map((item, i) => (
            <button
              key={item.id}
              onClick={item.onClick}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'none', border: 'none', borderTop: i > 0 ? `0.5px solid ${T.line}` : 'none', cursor: 'pointer', font: 'inherit', fontFamily: F, textAlign: 'left', color: item.danger ? T.coralInk : T.ink }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 11, background: item.danger ? T.coralSoft : T.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {item.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: -0.1 }}>{item.label}</div>
                {item.sub && <div style={{ fontSize: 11.5, color: T.coralInk, opacity: 0.75, marginTop: 1 }}>{item.sub}</div>}
              </div>
              {!item.danger && <Chevron />}
            </button>
          ))}
        </div>

        {/* Cancel */}
        <button
          onClick={onClose}
          style={{ width: '100%', padding: '16px', borderRadius: T.r.panel, background: T.surface, border: 0, cursor: 'pointer', font: 'inherit', fontFamily: FH, fontSize: 16, fontWeight: 700, color: T.ink, boxShadow: T.shadowModal }}
        >
          Cancel
        </button>
      </div>
    </div>,
    document.body,
  )
}
