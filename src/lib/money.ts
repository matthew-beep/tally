/** Formats a dollar amount for display: "$12.34". With `sign`, prefixes +/− (using U+2212, not a hyphen) — zero renders plain, no sign. */
export function formatAmount(n: number, { sign = false }: { sign?: boolean } = {}): string {
  const abs = Math.abs(n).toFixed(2)
  if (!sign || Math.abs(n) < 0.01) return `$${abs}`
  return `${n > 0 ? '+' : '−'}$${abs}`
}
