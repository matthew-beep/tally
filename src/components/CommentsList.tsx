'use client'

import { useState } from 'react'
import { T, F, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { SectionLabel } from '@/components/SectionLabel'
import { avatarProfile, displayName, firstName, slotFor } from '@/lib/memberDisplay'
import { timeAgo } from '@/lib/time'
import { useExpenseComments, useAddComment, useDeleteComment } from '@/queries/useExpenseComments'
import { useUIStore } from '@/store/ui'
import type { GroupMember } from '@/types'

interface Props {
  expenseId: string
  groupId: string
  members: GroupMember[]
  /** The viewer's seat. Absent (or inactive) means read-only, same as ReactionPills. */
  mySeatId?: string
  /** False for guests and left members, whose writes RLS would reject. */
  canPost: boolean
}

const MAX_LEN = 1000

/**
 * Comment thread + composer for the expense detail drawer. Fetched lazily
 * (only while the drawer holding it is mounted) on its own
 * `['expense-comments', expenseId]` key — see useExpenseComments for why this
 * stays out of the group's expense list cache.
 */
export function CommentsList({ expenseId, groupId, members, mySeatId, canPost }: Props) {
  const { data: comments, isPending } = useExpenseComments(expenseId)
  const addComment = useAddComment(expenseId, groupId)
  const deleteComment = useDeleteComment(expenseId)
  const pushToast = useUIStore(s => s.pushToast)
  const [draft, setDraft] = useState('')

  const memberById: Record<string, GroupMember> = Object.fromEntries(members.map(m => [m.id, m]))
  const canWrite = canPost && !!mySeatId
  const trimmed = draft.trim()
  const canSend = canWrite && trimmed.length > 0 && trimmed.length <= MAX_LEN && !addComment.isPending

  function send() {
    if (!canSend || !mySeatId) return
    addComment.mutate(
      { body: trimmed, seatId: mySeatId },
      { onError: () => pushToast('Couldn’t post that comment') }
    )
    setDraft('')
  }

  function remove(commentId: string) {
    deleteComment.mutate(commentId, { onError: () => pushToast('Couldn’t delete that comment') })
  }

  // Nothing posted and nothing to offer — same "take up no space" rule as ReactionPills.
  if (!isPending && !comments?.length && !canWrite) return null

  return (
    <div>
      <SectionLabel size="sm" style={{ marginBottom: 10, padding: '0 2px' }}>Comments</SectionLabel>

      {!!comments?.length && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: canWrite ? 14 : 0 }}>
          {comments.map(c => {
            const m = memberById[c.group_member_id]
            const isMine = c.group_member_id === mySeatId
            const name = isMine ? 'You' : m ? firstName(displayName(m)) : '…'
            return (
              <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                <Avatar profile={m ? avatarProfile(m) : undefined} slot={slotFor(members, c.group_member_id)} size={28} isYou={isMine} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{name}</span>
                    <span style={{ fontSize: 10.5, color: T.inkFaint, fontFamily: FMONO }}>{timeAgo(c.created_at)}</span>
                    {isMine && (
                      <button
                        onClick={() => remove(c.id)}
                        disabled={deleteComment.isPending}
                        aria-label="Delete comment"
                        style={{
                          marginLeft: 'auto', border: 0, background: 'transparent',
                          color: T.inkFaint, cursor: deleteComment.isPending ? 'default' : 'pointer',
                          fontSize: 11, fontFamily: F, padding: 2,
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.45, marginTop: 2, wordBreak: 'break-word' }}>
                    {c.body}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {canWrite && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Avatar profile={avatarProfile(memberById[mySeatId!])} slot={slotFor(members, mySeatId!)} size={28} isYou />
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: T.surfaceAlt, borderRadius: T.r.pill, padding: '4px 6px 4px 14px', boxShadow: `inset 0 0 0 1px ${T.line}` }}>
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Add a comment…"
              maxLength={MAX_LEN}
              style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', fontSize: 13, color: T.ink, fontFamily: F, padding: '8px 0' }}
            />
            <button
              onClick={send}
              disabled={!canSend}
              aria-label="Post comment"
              style={{
                width: 30, height: 30, borderRadius: T.r.pill, border: 0, flexShrink: 0,
                background: canSend ? T.ink : T.lineStrong, color: canSend ? T.bg : T.inkFaint,
                cursor: canSend ? 'pointer' : 'default',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M2 8h11M8.5 3.5L13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
