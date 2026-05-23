import { T, FH } from '@/design/tokens'
import { LoginButton } from './LoginButton'

export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: T.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 24px',
      }}
    >
      {/* Logo */}
      <div style={{ marginBottom: 48, textAlign: 'center' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: T.sun,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
            fontWeight: 800,
            fontFamily: FH,
            color: T.sunInk,
            margin: '0 auto 16px',
          }}
        >
          T
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 800,
            fontFamily: FH,
            letterSpacing: -1,
            color: T.ink,
          }}
        >
          tally
        </div>
        <div style={{ fontSize: 15, color: T.inkMuted, marginTop: 8 }}>
          Split expenses. Zero the balance. Free.
        </div>
      </div>

      <LoginButton />
    </div>
  )
}
