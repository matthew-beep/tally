import { describe, it, expect } from 'vitest'
import { sanitizeAmount } from './money'

// Ported from the retired NumericPad.pressKey suite: the same rules, now
// applied to whatever the system keyboard puts in the field rather than to one
// synthetic keystroke at a time.
describe('sanitizeAmount', () => {
  it('keeps plain digits', () => {
    expect(sanitizeAmount('5')).toBe('5')
    expect(sanitizeAmount('524')).toBe('524')
  })

  it('drops anything that is not a digit or a dot', () => {
    expect(sanitizeAmount('$52.40')).toBe('52.40')
    expect(sanitizeAmount('-12')).toBe('12')
    expect(sanitizeAmount('12abc')).toBe('12')
  })

  it('starts a decimal from empty as 0.', () => {
    expect(sanitizeAmount('.')).toBe('0.')
    expect(sanitizeAmount('.5')).toBe('0.5')
  })

  it('allows only one decimal point', () => {
    expect(sanitizeAmount('12.')).toBe('12.')
    expect(sanitizeAmount('12..')).toBe('12.')
    expect(sanitizeAmount('12.3.4')).toBe('12.34')
  })

  // round2 at save time would turn a typed 12.345 into 12.35 without saying so.
  // Refusing the third decimal makes the limit visible as it happens.
  it('caps at two decimal places', () => {
    expect(sanitizeAmount('12.34')).toBe('12.34')
    expect(sanitizeAmount('12.345')).toBe('12.34')
  })

  it('trims leading zeros only when a digit follows', () => {
    expect(sanitizeAmount('0')).toBe('0')
    expect(sanitizeAmount('05')).toBe('5')
    expect(sanitizeAmount('007')).toBe('7')
    expect(sanitizeAmount('0.50')).toBe('0.50')
  })

  it('passes an empty field through', () => {
    expect(sanitizeAmount('')).toBe('')
  })
})
