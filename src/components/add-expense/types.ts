export type SplitMode = 'equal' | 'percentage' | 'exact' | 'itemized'

// UI-only line item for the mobile itemized receipt builder (BreakdownItems).
// Nothing here reaches handleSave — expense_items tables don't exist yet.
export interface LineItem {
  id: number
  name: string
  price: number
  assignedTo: string[]
}

export const ALGORITHMS: { id: SplitMode; label: string; desc: string }[] = [
  { id: 'equal',      label: 'Equal',         desc: 'Divided evenly among everyone' },
  { id: 'exact',      label: 'Exact amounts', desc: 'Enter a specific amount per person' },
  { id: 'percentage', label: 'Percentages',   desc: 'Each person pays a % of the total' },
  { id: 'itemized',   label: 'By items',      desc: 'Assign receipt items to people' },
]

export function algoLabel(splitMode: SplitMode): string {
  return ALGORITHMS.find(a => a.id === splitMode)?.label ?? 'Equal'
}
