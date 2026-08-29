'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { T } from '@/design/tokens'

/** Finger travel is damped by this much — a 128px drag reads as 64px of pull. */
const RESISTANCE = 0.5
/** Pull distance (post-resistance) that arms the refresh. */
const THRESHOLD = 64
/** Indicator stops travelling here no matter how far the finger goes. */
const MAX_PULL = 100
/** Floor on the spinner so a warm cache doesn't flash it for a single frame. */
const MIN_SPIN_MS = 450
/**
 * Ceiling on the spinner. Sized above the query retry floor: providers.tsx sets
 * no `retry`, so the default 3 attempts + exponential backoff means a genuinely
 * failing query takes ~7s to settle — a 10s cap would fire on legitimate slow
 * retries. This bounds the *indicator only*; see runRefresh.
 */
const MAX_SPIN_MS = 15_000
/** Indicator's resting spot, clipped just above the scroller's top edge. */
const REST_Y = -40

type Phase = 'idle' | 'pulling' | 'armed' | 'refreshing'

interface PullToRefreshProps {
  children: ReactNode
  /** The scroller's own class — this component *is* the scroll container, not a wrapper around one. */
  className?: string
  style?: CSSProperties
  /** Defaults to refetching every mounted query, which is exactly what's on screen. */
  onRefresh?: () => Promise<unknown>
  /** Opt out — nested scrollers, or surfaces where the gesture shouldn't apply. */
  disabled?: boolean
  /**
   * Applied to the inner wrapper that carries the drag transform. Only needed
   * where that wrapper would otherwise break a flex chain: `.home-main` is
   * `display: flex; flex-direction: column` on desktop with `.home-content` at
   * `flex: 1` inside it, so home must pass
   * `{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }` to
   * keep the wrapper transparent to layout. Block scrollers (`.page-scroll`)
   * need nothing.
   */
  contentStyle?: CSSProperties
}

/**
 * Takes over the top overscroll gesture: suppresses the browser's native
 * pull-to-refresh and runs Tally's own refetch instead.
 *
 * Renders *as* the scroll container so pages swap `<div className="home-main">`
 * → `<PullToRefresh className="home-main">` with no extra layout box of their own.
 * Content and indicator both move with the drag, as native does. The one inner
 * wrapper this needs can interrupt a flex chain on scrollers that are flex
 * parents (`.home-main` holds `.home-content` at `flex: 1` on desktop) — see
 * `contentStyle`.
 *
 * Desktop needs no gate. The whole thing keys off touch events, which a mouse and
 * a macOS trackpad never fire (two-finger scroll is a `wheel` event), so it is
 * inert there by construction. Gating on viewport width instead would kill the
 * gesture on an iPad in landscape, which is touch and expects it.
 */
export function PullToRefresh({ children, className, style, onRefresh, disabled = false, contentStyle }: PullToRefreshProps) {
  const queryClient = useQueryClient()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const clearTransformRef = useRef<ReturnType<typeof setTimeout>>()
  const [phase, setPhase] = useState<Phase>('idle')

  // Gesture state lives in refs, not state: touchmove fires ~60x/s and the
  // indicator is moved by writing its transform directly. Only phase changes
  // (which swap the arrow for a spinner) are allowed to re-render.
  const startY = useRef(0)
  const active = useRef(false)
  // Shadows `phase` because the raw listeners below close over their creation
  // scope and would otherwise read a stale value. goPhase writes both.
  const phaseRef = useRef<Phase>('idle')
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const goPhase = useCallback((next: Phase) => {
    phaseRef.current = next
    if (mounted.current) setPhase(next)
  }, [])

  /**
   * Moves indicator and content together, the way native does: the content
   * slides down by `distance` and the indicator rides into the space it clears.
   * Both are written directly rather than through state — see the refs above.
   */
  const paint = useCallback((distance: number, animate: boolean) => {
    // No transition while the finger is down — both have to track it 1:1.
    // Animate only on release and settle, where the spring is wanted.
    const transition = animate ? 'transform 220ms cubic-bezier(0.22,1,0.36,1)' : 'none'

    const indicator = indicatorRef.current
    if (indicator) {
      indicator.style.transition = animate ? `${transition}, opacity 220ms ease` : 'none'
      indicator.style.transform = `translate(-50%, ${REST_Y + distance}px)`
      indicator.style.opacity = String(Math.min(1, distance / (THRESHOLD * 0.6)))
    }

    const content = contentRef.current
    if (content) {
      clearTimeout(clearTransformRef.current)
      content.style.transition = transition
      content.style.transform = `translateY(${distance}px)`
      // Back to `none`, not `translateY(0)`. A transform of any kind — including
      // an identity one — makes this element a containing block for
      // position: fixed descendants, which would silently break the popovers
      // that position themselves against the viewport (DatePicker, EmojiPopover,
      // ProfileMenuPopover). Leaving one parked on every converted page is a
      // latent bug; clearing it after the settle means it only exists during
      // the gesture, when no popover can be open anyway.
      if (distance === 0) {
        clearTransformRef.current = setTimeout(() => {
          if (content.style.transform === 'translateY(0px)') content.style.transform = 'none'
        }, animate ? 240 : 0)
      }
    }
  }, [])

  useEffect(() => () => clearTimeout(clearTransformRef.current), [])

  const runRefresh = useCallback(async () => {
    goPhase('refreshing')
    paint(THRESHOLD, true)
    const started = Date.now()
    try {
      // `type: 'active'` = every query with a mounted observer, which is
      // definitionally what's on screen. No per-page key wiring: the cross-group
      // aggregates (useGlobalBalances, useAllActivity) are useMemo derivations
      // over these same per-group caches, so refreshing the leaves refreshes
      // them for free. `throwOnError` is deliberately left off — one flaky query
      // out of ~37 on home shouldn't toast an error when the other 36 landed.
      const work = onRefresh ? onRefresh() : queryClient.refetchQueries({ type: 'active' })
      // Bounds the indicator, not the fetch. Nothing is cancelled: the refetches
      // keep running and still populate the cache when they land — the user just
      // stops being told the app is busy. Real cancellation would mean plumbing
      // AbortSignal through every queryFn in src/queries/ (tracked separately as
      // the network-deadline item in TODO.md § Prod readiness).
      await Promise.race([
        work,
        new Promise<void>(resolve => setTimeout(resolve, MAX_SPIN_MS)),
      ])
    } finally {
      const elapsed = Date.now() - started
      if (elapsed < MIN_SPIN_MS) {
        await new Promise(resolve => setTimeout(resolve, MIN_SPIN_MS - elapsed))
      }
      paint(0, true)
      goPhase('idle')
    }
  }, [goPhase, onRefresh, paint, queryClient])

  useEffect(() => {
    if (!scrollerRef.current || disabled) return
    // Aliased after the guard so the handlers below see a non-nullable type —
    // TS won't carry the narrowing on `scrollerRef.current` into a closure.
    const el: HTMLDivElement = scrollerRef.current

    function onTouchStart(e: TouchEvent) {
      if (phaseRef.current === 'refreshing' || e.touches.length !== 1) return
      // Armed once, at touchstart. Re-checking scrollTop on every move gives a
      // jarring hand-off when a fast flick happens to pass through zero.
      if (el.scrollTop > 0) return
      startY.current = e.touches[0].clientY
      active.current = true
    }

    function onTouchMove(e: TouchEvent) {
      if (!active.current || phaseRef.current === 'refreshing') return
      const dy = e.touches[0].clientY - startY.current

      // Dragged back up — hand the gesture to the browser for the rest of this
      // touch so normal scrolling resumes instead of fighting a held-open pull.
      if (dy <= 0) {
        if (phaseRef.current !== 'idle') { paint(0, true); goPhase('idle') }
        active.current = false
        return
      }

      // This is the line that actually cancels Safari's native pull-to-refresh;
      // overscroll-behavior alone isn't reliable across iOS versions. Only works
      // because of the { passive: false } registration below — React's
      // onTouchMove can't guarantee a cancelable event, which is why these are
      // raw listeners on a ref.
      e.preventDefault()

      const distance = Math.min(MAX_PULL, dy * RESISTANCE)
      paint(distance, false)

      const next: Phase = distance >= THRESHOLD ? 'armed' : 'pulling'
      if (phaseRef.current !== next) goPhase(next)
    }

    function onTouchEnd() {
      if (!active.current) return
      active.current = false
      if (phaseRef.current === 'armed') void runRefresh()
      else if (phaseRef.current !== 'idle') { paint(0, true); goPhase('idle') }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    // touchcancel shares the handler — an interrupting call or system gesture
    // would otherwise leave the indicator stuck open.
    el.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [disabled, goPhase, paint, runRefresh])

  return (
    <div
      ref={scrollerRef}
      className={className}
      // overscrollBehaviorY lives here rather than in a CSS rule so it travels
      // with the component: a scroller only stops chaining to the document once
      // it actually has the replacement gesture, which matters while this is
      // rolled out one page at a time. Belt and braces with preventDefault —
      // neither is reliable alone across iOS versions.
      style={{ position: 'relative', overscrollBehaviorY: 'contain', ...style }}
    >
      {/* Absolute so it never enters flow. Positioned against the scroller's
          padding box, which means it rides the scroll — fine, because the pull
          only happens at scrollTop 0 and the scroll is held there while it runs.
          Clipped out of sight at REST_Y until dragged in. */}
      <div
        ref={indicatorRef}
        aria-hidden={phase === 'idle'}
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: `translate(-50%, ${REST_Y}px)`,
          opacity: 0,
          zIndex: 5,
          pointerEvents: 'none',
          width: 32,
          height: 32,
          borderRadius: T.r.pill,
          background: T.surface,
          border: `0.5px solid ${T.line}`,
          boxShadow: T.shadowFloat,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {phase === 'refreshing' ? <Spinner /> : <PullArrow armed={phase === 'armed'} />}
      </div>
      {/* Carries the drag. Layout-neutral inside a block scroller; pass
          contentStyle where it would otherwise interrupt a flex chain. */}
      <div ref={contentRef} style={{ willChange: 'transform', ...contentStyle }}>
        {children}
      </div>
    </div>
  )
}

/** Same dashed-ring spinner as HandleInput's, on the shared `tally-spin` keyframe. */
function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"
      style={{ animation: 'tally-spin 0.9s linear infinite' }}>
      <circle cx="8" cy="8" r="5.5" stroke={T.inkFaint} strokeWidth="1.5"
        fill="none" strokeDasharray="9 5" />
    </svg>
  )
}

/** Points down while pulling, flips up once the threshold arms the refresh. */
function PullArrow({ armed }: { armed: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"
      style={{
        transform: armed ? 'rotate(180deg)' : 'none',
        transition: 'transform 180ms cubic-bezier(0.22,1,0.36,1)',
      }}>
      <path d="M8 3v9M4.5 8.5L8 12l3.5-3.5" stroke={armed ? T.ink : T.inkFaint}
        strokeWidth="1.75" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
