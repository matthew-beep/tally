'use client'

import { create } from 'zustand'

interface UIState {
  activeGroupId: string | null
  fabOpen: boolean
  newGroupOpen: boolean
  setActiveGroup: (id: string | null) => void
  setFabOpen: (open: boolean) => void
  setNewGroupOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>(set => ({
  activeGroupId: null,
  fabOpen: false,
  newGroupOpen: false,
  setActiveGroup: id => set({ activeGroupId: id }),
  setFabOpen: open => set({ fabOpen: open }),
  setNewGroupOpen: open => set({ newGroupOpen: open }),
}))
