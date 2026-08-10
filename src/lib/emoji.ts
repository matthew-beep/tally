/**
 * Picker vocabularies. One `EmojiPickerSheet` renders all of them — the set is
 * a prop, so the interaction is identical wherever emoji get chosen.
 *
 * These are app-layer, not DB constraints: `expense_reactions.emoji` only
 * checks length (see 20260809000000_expense_reactions.sql), so retiring an
 * emoji from a list here never orphans rows that already use it.
 *
 * `CATEGORIES` in categories.ts is deliberately not one of these — it carries
 * keyword-matching logic, not just a vocabulary.
 */

/** What a group *is* — identity, one per group. */
export const GROUP_EMOJI = [
  '💸', '🏖️', '🍕', '✈️', '🏠', '🎉', '🛒', '🚗',
  '🍽️', '💪', '🎮', '❤️', '🌲', '🏔️', '🎿', '🍻',
] as const

/** How you *respond* to an expense — several at once, per person. */
export const REACTION_EMOJI = ['😍', '😂', '💸', '🙏', '🔥', '👀'] as const
