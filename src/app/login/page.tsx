import { T, F, FH } from '@/design/tokens'
import { LoginButton } from './LoginButton'

export default function LoginPage() {
  return (
    <div
      style={{
        width: '100%',
        minHeight: '100dvh',
        background: T.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: F,
        position: 'relative',
        overflow: 'hidden',
        padding: 24,
        boxSizing: 'border-box',
      }}
    >
      {/* Ambient blobs */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '8%',
          left: '6%',
          width: 380,
          height: 380,
          borderRadius: '50%',
          background: T.mintSoft,
          opacity: 0.55,
          filter: 'blur(70px)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '5%',
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: T.coralSoft,
          opacity: 0.55,
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: T.surface,
          borderRadius: T.r.sheet,
          padding: '44px 44px 36px',
          boxShadow: T.shadow,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 68,
              height: 68,
              margin: '0 auto',
              borderRadius: 19,
              background: T.sun,
              color: T.sunInk,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: FH,
              fontWeight: 800,
              fontSize: 35,
              letterSpacing: -1,
              boxShadow: '0 6px 18px rgba(242,192,74,0.30), inset 0 1px 0 rgba(255,255,255,0.4)',
              userSelect: 'none',
            }}
          >
            T
          </div>

          <div
            style={{
              marginTop: 22,
              fontFamily: FH,
              fontSize: 42,
              fontWeight: 600,
              letterSpacing: -1.8,
              lineHeight: 1,
              color: T.ink,
            }}
          >
            tally
          </div>

          <div
            style={{
              marginTop: 12,
              fontSize: 16,
              color: T.inkMuted,
              lineHeight: 1.5,
              maxWidth: 300,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            The friendly way to split costs.
            <br />
            Free. No paywall, ever.
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 28,
              marginBottom: 20,
              fontSize: 12,
              color: T.inkFaint,
              fontWeight: 600,
              letterSpacing: 0.2,
            }}
          >
            <span style={{ width: 24, height: 1, background: T.lineStrong, display: 'block' }} />
            Get started in seconds
            <span style={{ width: 24, height: 1, background: T.lineStrong, display: 'block' }} />
          </div>
        </div>

        <LoginButton />
      </div>
    </div>
  )
}
