import { describe, it, expect } from 'vitest'
import { pressKey } from './NumericPad'

describe('pressKey', () => {
  it('appends digits', () => {
    expect(pressKey('', '5')).toBe('5')
    expect(pressKey('5', '2')).toBe('52')
    expect(pressKey('52', '4')).toBe('524')
  })

  it('starts a decimal from empty as 0.', () => {
    expect(pressKey('', '.')).toBe('0.')
    expect(pressKey('0.', '5')).toBe('0.5')
  })

  it('allows only one decimal point', () => {
    expect(pressKey('12', '.')).toBe('12.')
    expect(pressKey('12.', '.')).toBe('12.')
    expect(pressKey('12.3', '.')).toBe('12.3')
  })

  // round2 at save time would turn a typed 12.345 into 12.35 without saying so.
  // Refusing the third decimal makes the limit visible as it happens.
  it('caps at two decimal places', () => {
    expect(pressKey('12.3', '4')).toBe('12.34')
    expect(pressKey('12.34', '5')).toBe('12.34')
  })

  it('replaces a lone leading zero rather than accumulating one', () => {
    expect(pressKey('0', '5')).toBe('5')
    expect(pressKey('0', '.')).toBe('0.')
  })

  it('deletes from the right, and is a no-op when empty', () => {
    expect(pressKey('12.34', 'del')).toBe('12.3')
    expect(pressKey('1', 'del')).toBe('')
    expect(pressKey('', 'del')).toBe('')
  })
})
