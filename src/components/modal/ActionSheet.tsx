'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState, type ReactNode } from 'react'
import { T, F } from '@/design/tokens'
import { useIsMobileSheet } from '@/hooks/useMediaQuery'
import { useBodyScrollLock } from './useBodyScrollLock'

export interface ActionSheetItem {
  id: string
  icon?: ReactNode
  label: string
  sublabel?: string
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}

interface ActionSheetProps {
  open: boolean
  onClose: () => void
  /** Shown as a small label at the top of the items card */
  title?: string
  items: ActionSheetItem[]
}

// ── Mobile — iOS-style floating cards ─────────────────────────────────────

function MobileActionSheet({ open, onClose, title, items }: ActionSheetProps) {
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

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 300 }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.44)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          animation: 'tally-fade 0.18s ease',
        }}
      />

      {/* Cards container */}
      <div style={{
        position: 'absolute', left: 10, right: 10, bottom: 28,
        display: 'flex', flexDirection: 'column', gap: 10,
        animation: 'tally-slideup 0.26s cubic-bezier(.34,1.0,.5,1)',
      }}>
        {/* Items card */}
        <div style={{
          background: T.surface,
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: T.shadowModal,
        }}>
          {title && (
            <div style={{
              padding: '14px 18px 10px',
              fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
              color: T.inkMuted, fontFamily: F,
              borderBottom: `0.5px solid ${T.line}`,
            }}>
              {title}
            </div>
          )}
          {items.map((item, i) => (
            <button
              key={item.id}
              disabled={item.disabled}
              onClick={() => { if (!item.disabled) { item.onClick(); onClose() } }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 18px',
                background: 'none', border: 'none',
                borderTop: i > 0 ? `0.5px solid ${T.line}` : 'none',
                cursor: item.disabled ? 'default' : 'pointer',
                fontFamily: F, textAlign: 'left',
                color: item.danger ? T.coralInk : T.ink,
                opacity: item.disabled ? 0.4 : 1,
              }}
            >
              {item.icon && (
                <div style={{
                  width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                  background: item.danger ? T.coralSoft : T.surfaceAlt,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {item.icon}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: -0.1 }}>{item.label}</div>
                {item.sublabel && (
                  <div style={{ fontSize: 11.5, color: item.danger ? T.coralInk : T.inkMuted, opacity: 0.75, marginTop: 1 }}>
                    {item.sublabel}
                  </div>
                )}
              </div>
              {!item.danger && !item.disabled && (
                <svg width="6" height="11" viewBox="0 0 6 11" fill="none" style={{ opacity: 0.2, flexShrink: 0 }}>
                  <path d="M1 1l4 4.5L1 10" stroke={T.ink} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>

        {/* Cancel */}
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: 16, borderRadius: 18,
            background: T.surface, border: 'none',
            cursor: 'pointer', fontFamily: F,
            fontSize: 16, fontWeight: 700, color: T.ink,
            boxShadow: T.shadowModal,
          }}
        >
          Cancel
        </button>
      </div>
    </div>,
    document.body,
  )
}

// ── Desktop — compact dropdown ─────────────────────────────────────────────

function DesktopActionSheet({ open, onClose, title, items }: ActionSheetProps) {
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

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 300 }}>
      {/* Backdrop — lighter on desktop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }}
      />

      {/* Centered dropdown */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 280,
        background: T.surface,
        borderRadius: 18,
        boxShadow: T.shadowModal,
        overflow: 'hidden',
        animation: 'modal-pop-in 0.18s ease-out',
        border: `0.5px solid ${T.line}`,
      }}>
        {title && (
          <div style={{
            padding: '12px 16px 9px',
            fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
            color: T.inkMuted, fontFamily: F,
            borderBottom: `0.5px solid ${T.line}`,
          }}>
            {title}
          </div>
        )}
        {items.map((item, i) => (
          <button
            key={item.id}
            disabled={item.disabled}
            onClick={() => { if (!item.disabled) { item.onClick(); onClose() } }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 16px',
              background: 'none', border: 'none',
              borderTop: i > 0 ? `0.5px solid ${T.line}` : 'none',
              cursor: item.disabled ? 'default' : 'pointer',
              fontFamily: F, textAlign: 'left',
              color: item.danger ? T.coralInk : T.ink,
              opacity: item.disabled ? 0.4 : 1,
            }}
          >
            {item.icon && (
              <div style={{
                width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                background: item.danger ? T.coralSoft : T.surfaceAlt,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {item.icon}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{item.label}</div>
              {item.sublabel && (
                <div style={{ fontSize: 11, color: item.danger ? T.coralInk : T.inkMuted, opacity: 0.75, marginTop: 1 }}>
                  {item.sublabel}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  )
}

// ── Responsive wrapper ─────────────────────────────────────────────────────

export function ActionSheet(props: ActionSheetProps) {
  const isMobile = useIsMobileSheet()
  return isMobile
    ? <MobileActionSheet {...props} />
    : <DesktopActionSheet {...props} />
}
