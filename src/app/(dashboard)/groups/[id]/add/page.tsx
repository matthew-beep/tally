'use client'

// Full-screen mobile add-expense route. On mobile this is the FAB's target
// (see AddExpenseGroupPicker.goToGroup) — a real page instead of the sheet,
// so there's a back button and no dimmed group behind it. The sheet-based
// flow is untouched and still reachable via /groups/[id]?add=1 (desktop
// always uses it for the modal; mobile too, via old/bookmarked links), so on
// desktop this route just redirects there instead of rendering full-screen.

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useIsMobileSheet } from '@/hooks/useMediaQuery'
import { useAddExpenseForm } from '@/components/add-expense/useAddExpenseForm'
import { MobilePanel } from '@/components/add-expense/MobilePanel'

export default function AddExpensePage() {
  const params  = useParams()
  const groupId = params.id as string
  const router  = useRouter()
  const isMobile = useIsMobileSheet()

  useEffect(() => {
    if (!isMobile) router.replace(`/groups/${groupId}?add=1`)
  }, [isMobile, groupId, router])

  if (!isMobile) return null

  return <AddExpenseRoutePanel groupId={groupId} />
}

// Split out so useAddExpenseForm (and the queries it fires) only ever mounts
// on mobile — a desktop visit redirects above before this renders at all.
function AddExpenseRoutePanel({ groupId }: { groupId: string }) {
  const router = useRouter()
  const goToGroup = () => router.push(`/groups/${groupId}`)
  const state = useAddExpenseForm({ groupId, isMobile: true, onSuccess: goToGroup })

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <MobilePanel s={state} onCancel={goToGroup} variant="route" />
    </div>
  )
}
