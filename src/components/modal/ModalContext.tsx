'use client'

import { createContext, useContext } from 'react'

interface ModalContextValue {
  onClose: () => void
}

export const ModalContext = createContext<ModalContextValue | null>(null)

export function useModalContext() {
  const ctx = useContext(ModalContext)
  if (!ctx) {
    throw new Error('Modal subcomponents must be used inside <Modal>')
  }
  return ctx
}
