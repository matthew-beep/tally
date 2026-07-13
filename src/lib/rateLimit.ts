import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────
// One function to check limits. Current source of truth: count existing
// domain rows in Postgres — no counter table, no external store. The DB
// already records who did what when (groups.created_by + created_at,
// group_members.invited_by + joined_at), so "how many times has this user
// done X recently?" is a count query against rows that exist anyway:
//
//   SELECT count(*) FROM groups
//   WHERE created_by = :identifier AND created_at > now() - interval 'windowMs';
//
//   const admin = createServiceRoleClient()
//   const over = await isOverLimit(
//     admin,
//     { table: 'groups', userCol: 'created_by', timeCol: 'created_at' },
//     userId, 10, HOUR
//   )
//   if (over) return NextResponse.json({ error: 'Too many groups created' }, { status: 429 })
//
// `source` is the only Postgres-specific knowledge here — which
// table/columns hold the evidence for one action. It's a parameter, not
// hardcoded, so swapping the source of truth (Postgres row counts → Redis
// → anything else) means writing a differently-shaped `isOverLimit` with
// the same (identifier, limit, windowMs) call convention — call sites just
// switch which function they import.
//
// Must be called with the service-role client: RLS on the counted table
// would otherwise hide rows and undercount.
//
// Known slop, accepted: two concurrent requests can both read
// count = limit - 1 and both pass (rate limiting, not billing), and rows
// deleted after the fact (e.g. a declined invite) un-count themselves.
// Fails open — if the count query errors, real users aren't blocked by a
// broken limiter; the error is logged (`[rate-limit]` prefix) so it's
// visible in Vercel logs. If count queries ever show up in profiles, add
// composite indexes (user col, time col) — at current scale unnecessary.
// ─────────────────────────────────────────────────────────────────

export const HOUR = 60 * 60 * 1000
export const DAY = 24 * HOUR

export interface RowCountSource {
  table: string
  userCol: string
  timeCol: string
}

export async function isOverLimit(
  admin: SupabaseClient,
  source: RowCountSource,
  identifier: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const since = new Date(Date.now() - windowMs).toISOString()

  const { count, error } = await admin
    .from(source.table)
    .select('*', { count: 'exact', head: true })
    .eq(source.userCol, identifier)
    .gte(source.timeCol, since)

  if (error) {
    console.warn(
      `[rate-limit] count failed — failing open. table=${source.table} id=${identifier}: ${error.message}`
    )
    return false
  }

  const over = (count ?? 0) >= limit
  if (over) {
    console.warn(
      `[rate-limit] limit hit. table=${source.table} id=${identifier} count=${count} max=${limit} windowMs=${windowMs}`
    )
  }
  return over
}
