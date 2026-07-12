import type { SupabaseClient } from '@supabase/supabase-js'

// Postgres-backed rate limiting — no counter table, no external store.
// The domain tables already record who did what when, so "how many times has
// this user done X recently?" is a count query against rows that exist anyway:
//
//   SELECT count(*) FROM groups
//   WHERE created_by = :user AND created_at > now() - interval '1 hour';
//
//   SELECT count(*) FROM group_members
//   WHERE invited_by = :user AND joined_at > now() - interval '1 hour';
//
// Serverless-safe because the state lives in Postgres, not instance memory.
// Known slop, accepted: two concurrent requests can both read count = max - 1
// and both pass (rate limiting, not billing), and rows deleted after the fact
// (e.g. declined invites) un-count themselves. Limits sit ~10x above honest
// usage — they cap worst-case damage, not shape behavior.
//
// Must be called with the service-role client: RLS on the counted tables
// would otherwise hide rows and undercount.
//
// When wiring into a route, on `true` return 429 with a Retry-After header.
// If count queries ever show up in profiles, add composite indexes
// (user col, time col) — at current scale they're unnecessary.

export interface RateLimitRule {
  /** Table whose rows are the counter */
  table: string
  /** Column identifying the acting user */
  userCol: string
  /** Timestamp column for the window */
  timeCol: string
  /** Lookback window in ms */
  windowMs: number
  /** Requests allowed per window */
  max: number
}

const HOUR = 60 * 60 * 1000

export const RATE_LIMITS = {
  /** POST /api/groups/create — caps unbounded group + member-row inserts */
  groupCreate: {
    table: 'groups',
    userCol: 'created_by',
    timeCol: 'created_at',
    windowMs: HOUR,
    max: 10,
  },
  /**
   * POST /api/groups/members/add — the harassment vector: every real-user
   * invite fans out a notification. Guests insert with invited_by NULL, so
   * only real-user invites count — which is exactly the surface to cap.
   */
  memberInvite: {
    table: 'group_members',
    userCol: 'invited_by',
    timeCol: 'joined_at',
    windowMs: HOUR,
    max: 30,
  },
} as const satisfies Record<string, RateLimitRule>

/**
 * True if the user has exhausted the rule's window — caller should 429.
 *
 * Fails open: if the count query itself errors, legit users aren't blocked
 * by a broken limiter; the error is logged so it's visible in Vercel logs.
 * Both outcomes log with a stable `[rate-limit]` prefix for later tuning.
 */
export async function overLimit(
  admin: SupabaseClient,
  userId: string,
  rule: RateLimitRule
): Promise<boolean> {
  const since = new Date(Date.now() - rule.windowMs).toISOString()

  const { count, error } = await admin
    .from(rule.table)
    .select('*', { count: 'exact', head: true })
    .eq(rule.userCol, userId)
    .gte(rule.timeCol, since)

  if (error) {
    console.warn(
      `[rate-limit] count failed — failing open. table=${rule.table} user=${userId}: ${error.message}`
    )
    return false
  }

  const over = (count ?? 0) >= rule.max
  if (over) {
    console.warn(
      `[rate-limit] limit hit. table=${rule.table} user=${userId} count=${count} max=${rule.max} windowMs=${rule.windowMs}`
    )
  }
  return over
}
