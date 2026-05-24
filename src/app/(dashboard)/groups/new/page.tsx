'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUIStore } from '@/store/ui'

/** Deep link fallback — opens the modal and redirects to groups list */
export default function NewGroupPage() {
  const router = useRouter()
  const setNewGroupOpen = useUIStore(s => s.setNewGroupOpen)

  useEffect(() => {
    setNewGroupOpen(true)
    router.replace('/groups')
  }, [router, setNewGroupOpen])

  return null
}
