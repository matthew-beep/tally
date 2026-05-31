'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function AddExpenseRedirect() {
  const params  = useParams()
  const groupId = params.id as string
  const router  = useRouter()

  useEffect(() => {
    router.replace(`/groups/${groupId}`)
  }, [groupId])

  return null
}
