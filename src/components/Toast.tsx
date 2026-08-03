'use client'

import { useEffect } from 'react'
import { T, F } from '@/design/tokens'
import { useUIStore } from '@/store/ui'

const AUTO_DISMISS_MS = 5000

export function ToastStack() {
  const toasts = useUIStore(s => s.toasts)
  const dismissToast = useUIStore(s => s.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 'max(20px, env(safe-area-inset-bottom))',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: 'min(360px, calc(100vw - 32px))',
        pointerEvents: 'none',
      }}
    >
      {toasts.map(toast => (
        <ToastRow key={toast.id} id={toast.id} message={toast.message} onDismiss={dismissToast} />
      ))}
    </div>
  )
}

function ToastRow({ id, message, onDismiss }: { id: string; message: string; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [id, onDismiss])

  return (
    <div
      onClick={() => onDismiss(id)}
      style={{
        pointerEvents: 'auto',
        cursor: 'pointer',
        background: T.ink,
        color: T.surface,
        borderRadius: T.r.md,
        boxShadow: T.shadowFloat,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        fontFamily: F,
        fontSize: 13.5,
        fontWeight: 500,
        lineHeight: 1.4,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.coral, flexShrink: 0, marginTop: 5 }} />
      <span style={{ flex: 1 }}>{message}</span>
    </div>
  )
}
