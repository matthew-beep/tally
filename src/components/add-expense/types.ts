export type SplitMode = 'equal' | 'percentage' | 'exact' | 'itemized'

// Which mobile picker sheet is currently open — Paid by/Split (existing
// fields, moved from inline-expand to a sheet) plus Date/Category. The note has
// no sheet: it is a line of the form you type into, so there is nothing to open.
export type OpenPanel = 'payer' | 'split' | 'date' | 'category' | null

// UI-only line item for the mobile itemized receipt builder (ItemizedBuilder).
// Nothing here reaches handleSave — expense_items isn't written yet.
export interface LineItem {
  id: number
  name: string
  price: number
  assignedTo: string[]
}

/**
 * The one split-mode list. Both surfaces read it — the mobile split sheet's
 * tabs and the desktop mode strip — so the two can't drift in order, labels or
 * membership the way two hand-maintained arrays did. `value`/`label` are named
 * to match <Segmented>'s option shape, so it drops in without mapping.
 */
export const SPLIT_MODES: { value: SplitMode; label: string; sentence: string }[] = [
  { value: 'equal',      label: 'Equal',    sentence: 'equally'          },
  { value: 'exact',      label: 'Exact',    sentence: 'by exact amounts' },
  { value: 'percentage', label: 'Percent',  sentence: 'by percentage'    },
  { value: 'itemized',   label: 'Itemized', sentence: 'by item'          },
]

/**
 * The same mode said as a sentence fragment rather than a tab label — the token
 * sentence reads "and split [equally]", where a tab has to read "Equal". Kept on
 * SPLIT_MODES rather than in a second lookup so the two registers can't drift.
 */
export function splitSentence(splitMode: SplitMode): string {
  return SPLIT_MODES.find(m => m.value === splitMode)?.sentence ?? 'equally'
}
