'use client'

import { T, F } from '@/design/tokens'
import { Btn } from '@/components/Btn'

type Action = {
  label: string
  onClick: () => void
  disabled?: boolean
}

type Props = {
  secondary: Action
  primary: Action & { background: string; color: string }
  hint?: string
}

/** Ghost + filled button pair for the notification review footer. */
export function NotificationActionFooter({ secondary, primary, hint }: Props) {
  return (
    <div style={{ flexShrink: 0, padding: '18px 26px 24px' }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn
          onClick={secondary.onClick} disabled={secondary.disabled} variant="outline" size="lg"
          style={{ flex: 0.8, padding: '13px 0', borderRadius: 13, fontFamily: F, fontSize: 14 }}
        >
          {secondary.label}
        </Btn>
        <button
          type="button"
          onClick={primary.onClick}
          disabled={primary.disabled}
          style={{
            flex: 1.4, padding: '13px 0', borderRadius: 13, border: 0, cursor: 'pointer',
            font: 'inherit', fontSize: 15, fontWeight: 700,
            background: primary.background, color: primary.color,
          }}
        >
          {primary.label}
        </button>
      </div>
      {hint && (
        <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 12, lineHeight: 1.5, textAlign: 'center' }}>
          {hint}
        </div>
      )}
    </div>
  )
}
