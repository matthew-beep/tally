'use client'

// Legacy URL. Add-expense is a sheet on the group page, not a route — this
// forwards to the group with ?add=1 so the sheet opens on arrival instead of
// silently dropping the user's intent (the previous version redirected to the
// bare group page). Kept rather than deleted because the URL is shareable and
// may be bookmarked; new links should point at /groups/[id]?add=1 directly.

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function AddExpenseRedirect() {
  const params  = useParams()
  const groupId = params.id as string
  const router  = useRouter()

  useEffect(() => {
    router.replace(`/groups/${groupId}?add=1`)
  }, [groupId, router])

  return null
}
