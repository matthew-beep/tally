'use client'

import { useRouter } from 'next/navigation'
import { ChevronRight, Plus } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { T, F, FH, FMONO } from '@/design/tokens'
import { EmojiTile } from '@/components/EmojiTile'
import { AvatarStack } from '@/components/Avatar'
import { ModalOrSheet, ModalHeader, ModalContent } from '@/components/modal'
import { useGroups } from '@/queries/useGroups'
import { useGlobalBalances } from '@/queries/useGlobalBalances'
import { avatarProfile, slotFor } from '@/lib/memberDisplay'
import { formatAmount } from '@/lib/money'
import { useUIStore } from '@/store/ui'
import type { GroupMember } from '@/types'

/**
 * Global "Add expense" entry point for non-group pages (Home, Groups,
 * Activity, Me) — reached from AppHeader's "Add expense" button and
 * DockedTabBar's center FAB. Lists every group so the user can jump
 * straight into that group's existing add-expense flow
 * (`/groups/:id?add=1`) without navigating through the Groups list first.
 * Styled after the "Header & Sidebar Variants" design exploration's
 * HsGroupPicker / HsMobilePicker.
 */
export function AddExpenseGroupPicker() {
  const { fabOpen, setFabOpen } = useUIStore()
  const router = useRouter()
  const { data: groups = [], isLoading: groupsLoading } = useGroups()
  const { data: gb, isLoading: balancesLoading } = useGlobalBalances()

  function close() {
    setFabOpen(false)
  }

  function goToGroup(groupId: string) {
    close()
    router.push(`/groups/${groupId}?add=1`)
  }

  function goToNewGroup() {
    close()
    router.push('/groups/new')
  }

  const isLoading = groupsLoading || balancesLoading

  return (
    <ModalOrSheet open={fabOpen} onClose={close} title="New expense — which group?" maxWidth={480}>
      <ModalHeader onClose={close}>
        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.9, textTransform: 'uppercase', color: T.inkFaint }}>
          New expense
        </div>
        <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginTop: 4, color: T.ink }}>
          Which group?
        </div>
      </ModalHeader>

      <ModalContent style={{ padding: '10px 14px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <PickerRow
          onClick={goToNewGroup}
          icon={
            <div style={{ width: 46, height: 46, borderRadius: 13, background: T.sunSoft, color: T.sunInk, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Plus size={20} strokeWidth={2.4} />
            </div>
          }
          title="New group"
          subtitle="Start a group for this expense"
          style={{ marginBottom: 6, paddingBottom: 12, borderBottom: `1px solid ${T.line}` }}
        />

        {isLoading && <div style={{ padding: '14px 10px', fontSize: 13, color: T.inkMuted }}>Loading groups…</div>}

        {!isLoading && groups.length === 0 && (
          <div style={{ padding: '14px 10px', fontSize: 13, color: T.inkMuted }}>
            No groups yet — create one to log your first expense.
          </div>
        )}

        {!isLoading && groups.map(group => (
          <GroupRow
            key={group.id}
            group={group}
            myId={gb?.myId}
            netPerGroup={gb?.netPerGroup}
            members={gb?.membersPerGroup?.[group.id] ?? []}
            onClick={() => goToGroup(group.id)}
          />
        ))}
      </ModalContent>
    </ModalOrSheet>
  )
}

function GroupRow({
  group,
  myId,
  netPerGroup,
  members,
  onClick,
}: {
  group: { id: string; name: string; emoji: string }
  myId?: string
  netPerGroup?: Record<string, Record<string, number>>
  members: GroupMember[]
  onClick: () => void
}) {
  const myBalance = myId && netPerGroup ? (netPerGroup[group.id]?.[myId] ?? 0) : 0
  const settled = Math.abs(myBalance) < 0.01
  const pos = myBalance > 0

  const avatarItems = members.map(m => ({
    profile: avatarProfile(m),
    slot: slotFor(members, m.id),
    isYou: m.user_id === myId,
  }))

  return (
    <PickerRow
      onClick={onClick}
      icon={<EmojiTile emoji={group.emoji} size={46} fontSize={22} radius={13} background={T.surfaceAlt} />}
      title={group.name}
      subtitle={`${members.length} ${members.length === 1 ? 'member' : 'members'}`}
      trailing={
        <>
          <AvatarStack members={avatarItems} size={24} max={3} overlap={0.4} ringColor={T.surface} />
          {settled ? (
            <div style={{ fontSize: 11.5, fontWeight: 700, color: T.inkMuted, padding: '4px 11px', background: T.bg, borderRadius: T.r.pill, flexShrink: 0 }}>
              settled
            </div>
          ) : (
            <div style={{ fontFamily: FMONO, fontSize: 13, fontWeight: 700, minWidth: 58, textAlign: 'right', color: pos ? T.mintInk : T.coralInk, flexShrink: 0 }}>
              {formatAmount(myBalance, { sign: true })}
            </div>
          )}
        </>
      }
    />
  )
}

function PickerRow({
  onClick,
  icon,
  title,
  subtitle,
  trailing,
  style,
}: {
  onClick: () => void
  icon: ReactNode
  title: string
  subtitle: string
  trailing?: ReactNode
  style?: CSSProperties
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="gp-pick-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        width: '100%',
        textAlign: 'left',
        border: 0,
        cursor: 'pointer',
        font: 'inherit',
        fontFamily: F,
        color: T.ink,
        background: 'transparent',
        borderRadius: 14,
        padding: '11px 10px',
        ...style,
      }}
    >
      {icon}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {subtitle}
        </div>
      </div>
      {trailing}
      <ChevronRight size={16} color={T.inkFaint} style={{ flexShrink: 0 }} />
    </button>
  )
}
