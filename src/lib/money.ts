/**
 * Round to cents. Every monetary value crossing a boundary — into the DB, into
 * a balance total, into the UI — goes through this. Floats never reach the user.
 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Parse a money/percent text input to a number, treating blank and garbage as 0. */
export function parseNum(v: string | undefined): number {
  return parseFloat(v || '0') || 0
}

/** Strip minus signs from a numeric input — expense amounts are never negative. */
export function stripNegative(v: string): string {
  return v.replace(/-/g, '')
}

/** Formats a dollar amount for display: "$12.34". With `sign`, prefixes +/− (using U+2212, not a hyphen) — zero renders plain, no sign. */
export function formatAmount(n: number, { sign = false }: { sign?: boolean } = {}): string {
  const abs = Math.abs(n).toFixed(2)
  if (!sign || Math.abs(n) < 0.01) return `$${abs}`
  return `${n > 0 ? '+' : '−'}$${abs}`
}

/**
 * Splits a magnitude into the two pieces the design system's amount anatomy
 * renders in different fonts/weights: a comma-grouped whole-dollar string and
 * a ".cents" string (dot included). Sign is deliberately not handled here —
 * every call site already branches on sign for color, so it derives its own
 * +/− glyph from that same comparison instead of a second one here.
 */
export function splitAmount(n: number): { whole: string; cents: string } {
  const abs = Math.abs(n)
  return {
    whole: Math.floor(abs).toLocaleString(),
    cents: (abs % 1).toFixed(2).slice(1),
  }
}
