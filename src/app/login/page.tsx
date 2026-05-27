import { T, F, FH } from '@/design/tokens'
import { LoginButton } from './LoginButton'

function OBHatch() {
  return (
    <svg
      viewBox="0 0 402 320"
      preserveAspectRatio="xMidYMid slice"
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', opacity: 0.55,
      }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ob-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={T.bg} stopOpacity="0"/>
          <stop offset="100%" stopColor={T.bg} stopOpacity="1"/>
        </linearGradient>
      </defs>
      <circle cx="-40" cy="40"  r="90" fill={T.sun}   opacity="0.22"/>
      <circle cx="280" cy="22"  r="60" fill={T.mint}  opacity="0.22"/>
      <circle cx="60"  cy="200" r="90" fill={T.coral} opacity="0.22"/>
      <circle cx="320" cy="200" r="60" fill={T.lav}   opacity="0.22"/>
      <circle cx="180" cy="100" r="90" fill={T.sun}   opacity="0.22"/>
      <rect width="100%" height="100%" fill="url(#ob-fade)"/>
    </svg>
  )
}

export default function LoginPage() {
  return (
    <div style={{
      minHeight: '100dvh',
      background: T.bg,
      display: 'flex',
      justifyContent: 'center',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 430,
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* status bar / safe area */}
        <div style={{ height: 54, flexShrink: 0 }}/>

        <OBHatch/>

        {/* content */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 28px 0',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
        }}>
          {/* logo */}
          <div style={{
            width: 68, height: 68,
            borderRadius: 19,
            background: T.sun, color: T.sunInk,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: FH, fontWeight: 800, fontSize: 35, letterSpacing: -1,
            boxShadow: '0 6px 18px rgba(242,192,74,0.30), inset 0 1px 0 rgba(255,255,255,0.4)',
            userSelect: 'none',
          }}>
            T
          </div>

          <div style={{
            marginTop: 22,
            fontFamily: FH, fontSize: 42, fontWeight: 600,
            letterSpacing: -1.8, lineHeight: 1,
            color: T.ink,
          }}>
            tally
          </div>

          <div style={{
            marginTop: 12,
            fontSize: 16, color: T.inkMuted,
            lineHeight: 1.5, maxWidth: 260,
            fontFamily: F,
          }}>
            The friendly way to split costs.<br/>Free. No paywall, ever.
          </div>

          <div style={{ flex: 1, minHeight: 40 }}/>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 12, color: T.inkFaint,
            fontWeight: 600, letterSpacing: 0.2,
            fontFamily: F, marginBottom: 14,
          }}>
            <span style={{ width: 24, height: 1, background: T.lineStrong, display: 'block' }}/>
            Get started in seconds
            <span style={{ width: 24, height: 1, background: T.lineStrong, display: 'block' }}/>
          </div>
        </div>

        {/* sticky bottom — interactive */}
        <LoginButton/>
      </div>
    </div>
  )
}
