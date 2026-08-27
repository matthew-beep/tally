'use client'

import { Input, type InputSize } from '@/components/Input'
import { round2, parseNum } from '@/lib/money'

/**
 * Digits and at most one decimal point, at most two places after it.
 *
 * A pure filter — it can only ever shorten the string, never rewrite it. That
 * distinction matters: rejecting a keystroke is fine, but *reformatting* what
 * the user typed is what makes a field impossible to backspace through.
 */
function sanitize(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '')
  const [whole, ...rest] = cleaned.split('.')
  if (rest.length === 0) return whole
  return `${whole}.${rest.join('').slice(0, 2)}`
}

interface AmountInputProps {
  /** Raw field text — NOT a number. See the note below on why. */
  value: string
  onChange: (v: string) => void
  /** Upper bound, normalized on blur. Omit for an open-ended amount. */
  max?: number
  size?: InputSize
  fullWidth?: boolean
  placeholder?: string
  autoFocus?: boolean
  /** Applied to the <input> — e.g. `add-expense-amount-input`'s iOS zoom guard. */
  inputClassName?: string
}

/**
 * A dollar amount field: recessed well, `$` affix, digits only.
 *
 * **The value is a string and stays a string while the user types.** Holding it
 * as a number and rendering `n.toFixed(2)` looks tidier and is unusable: the
 * re-rendered `.00` tail can't be backspaced through (delete a char, it parses
 * back to the same number and reappears), and a second digit lands past the
 * decimal, so typing "15" yields $1.00. Parse at the point of use with
 * `parseNum`, never in `onChange`.
 *
 * Rounding and `max` are applied on blur only — mid-typing is not a value yet.
 * Callers that write money should still clamp at the write: tapping a button
 * doesn't reliably blur the field first on mobile.
 */
export function AmountInput({
  value, onChange, max, size = 'hero', fullWidth = true,
  placeholder = '0.00', autoFocus, inputClassName,
}: AmountInputProps) {
  function normalize() {
    const n = round2(parseNum(value))
    const bounded = Math.max(0, max == null ? n : Math.min(max, n))
    onChange(bounded === 0 && value.trim() === '' ? '' : bounded.toFixed(2))
  }

  return (
    <Input
      size={size} fullWidth={fullWidth} prefix="$"
      // `type="text"`, deliberately: a `type="number"` input reports an empty
      // `value` for any state the browser considers invalid, so typing the
      // "." in "12.50" blanks the field and eats the 12. `inputMode` is what
      // actually raises the numeric keypad on mobile.
      type="text" inputMode="decimal"
      value={value}
      onChange={e => onChange(sanitize(e.target.value))}
      onBlur={normalize}
      placeholder={placeholder}
      autoFocus={autoFocus}
      inputClassName={inputClassName}
    />
  )
}
