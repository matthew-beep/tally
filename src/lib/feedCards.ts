import { avatarProfile, displayName, firstName, slotFor } from './memberDisplay'
import { formatAmount, round2 } from './money'
import type { FeedItem } from './feed'
import type { ActivityItem, FeedCardModel, GroupMember } from '@/types'

/**
 * The two feeds' data pipelines meet here.
 *
 * The Activity tab folds every group into a flat `ActivityItem`; group detail
 * keeps raw `Expense`/`Settlement` because it needs splits and seats. Rather
 * than forcing either to carry the other's data — which would make the
 * cross-group fan-out pay for split rows it never renders — both map into
 * `FeedCardModel` and one component renders it.
 */

function shortDate(dateStr: string): string {
  // Midnight-qualified so a bare YYYY-MM-DD isn't read as UTC and shown a day early.
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Cross-group Activity tab. No splits available, so no share or participants. */
export function toActivityCard(item: ActivityItem, showGroup = false): FeedCardModel {
  const group = `${item.groupEmoji} ${item.groupName}`

  if (item.type === 'expense') {
    return {
      id: item.id,
      icon: { kind: 'emoji', emoji: item.category ?? '💸' },
      title: item.description,
      titleTag: item.updatedAt && item.updatedAt !== item.createdAt ? '(edited)' : undefined,
      subtitle: showGroup ? `${item.payerName} · ${group}` : `${item.payerName} · ${shortDate(item.date)}`,
      amount: item.amount,
      amountTone: 'neutral',
    }
  }

  const confirmed = item.status === 'confirmed'
  return {
    id: item.id,
    icon: { kind: 'settlement', confirmed },
    title: `${item.fromName} paid ${item.toName}`,
    subtitle: showGroup ? group : '',
    statusTag: item.status,
    amount: item.amount,
    amountTone: confirmed ? 'positive' : 'neutral',
  }
}

/**
 * Group detail. Has splits and seats, so it can say what the viewer's own
 * stake is — the payer is shown what they fronted for everyone else, everyone
 * else what they owe.
 */
export function toGroupFeedCard(
  item: FeedItem,
  members: GroupMember[],
  mySeatId: string | undefined
): FeedCardModel {
  const memberById: Record<string, GroupMember> = Object.fromEntries(members.map(m => [m.id, m]))
  const nameOf = (id: string) => {
    const m = memberById[id]
    return m ? displayName(m) : '…'
  }

  if (item.type === 'expense') {
    const e = item.data
    const splits = e.splits ?? []
    const youPaid = e.paid_by === mySeatId
    const mySplit = splits.find(s => s.group_member_id === mySeatId)

    // As payer, your stake is what everyone *else* owes you — your own split
    // row is money you owed yourself, which nets to nothing.
    const myAmt = youPaid
      ? round2(splits.filter(s => s.group_member_id !== e.paid_by).reduce((sum, s) => sum + Number(s.owed_amount), 0))
      : round2(Number(mySplit?.owed_amount ?? 0))
    const involved = youPaid || !!mySplit

    return {
      id: e.id,
      icon: { kind: 'emoji', emoji: e.category ?? '💸' },
      title: e.description,
      titleTag: e.updated_at && e.updated_at !== e.created_at ? '(edited)' : undefined,
      subtitle: `${youPaid ? 'You' : nameOf(e.paid_by)} paid · ${formatAmount(Number(e.amount))}`,
      // Someone else's expense you're not in still belongs in the feed, but it
      // has no number for you — showing $0.00 would read as a real balance.
      amount: involved && myAmt > 0 ? myAmt : 0,
      amountTone: involved && myAmt > 0 ? (youPaid ? 'positive' : 'negative') : undefined,
      amountCaption: involved && myAmt > 0 ? 'your share' : undefined,
      participants: splits.map(s => ({
        id: s.group_member_id,
        avatar: memberById[s.group_member_id]
          ? avatarProfile(memberById[s.group_member_id])
          : { name: '…', display_name: null, avatar_url: null },
        slot: slotFor(members, s.group_member_id),
        isYou: s.group_member_id === mySeatId,
      })),
    }
  }

  const s = item.data
  const youFrom = s.from_member_id === mySeatId
  const youTo = s.to_member_id === mySeatId
  const confirmed = s.status === 'confirmed'

  return {
    id: s.id,
    icon: { kind: 'settlement', confirmed },
    title: `${youFrom ? 'You' : firstName(nameOf(s.from_member_id))} paid ${youTo ? 'you' : firstName(nameOf(s.to_member_id))}`,
    subtitle: s.note ?? '',
    statusTag: s.status,
    amount: Number(s.amount),
    amountTone: confirmed ? 'positive' : 'neutral',
  }
}
