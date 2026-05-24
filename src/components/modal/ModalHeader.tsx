'use client'

import { T, F, FH } from '@/design/tokens'
import type { CSSProperties, ReactNode } from 'react'
import { useContext } from 'react'
import { X } from 'lucide-react'
import { ModalContext } from './ModalContext'

interface ModalHeaderProps {
  title?: string
  children?: ReactNode
  showClose?: boolean
  onClose?: () => void
  style?: CSSProperties
}

export function ModalHeader({ title, children, showClose = true, onClose, style }: ModalHeaderProps) {
  const ctx = useContext(ModalContext)
  const handleClose = onClose ?? ctx?.onClose

  return (
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        padding: '20px 24px 16px',
        borderBottom: `1px solid ${T.line}`,
        ...style,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <div style={{
            fontFamily: FH,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: -0.4,
            color: T.ink,
            lineHeight: 1.25,
          }}>
            {title}
          </div>
        )}
        {children}
      </div>
      {showClose && handleClose && (
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          style={{
            flexShrink: 0,
            width: 32,
            height: 32,
            borderRadius: T.r.md,
            border: 'none',
            background: T.surfaceAlt,
            color: T.inkMuted,
            fontSize: 18,
            lineHeight: 1,
            cursor: 'pointer',
            fontFamily: F,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={16} strokeWidth={2.5} />
        </button>
      )}
    </div>
  )
}
