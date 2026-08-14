'use client'

import { create } from 'zustand'

export interface Toast {
  id: string
  message: string
}

interface UIState {
  activeGroupId: string | null
  fabOpen: boolean
  toasts: Toast[]
  setActiveGroup: (id: string | null) => void
  setFabOpen: (open: boolean) => void
  pushToast: (message: string) => void
  dismissToast: (id: string) => void
}

export const useUIStore = create<UIState>(set => ({
  activeGroupId: null,
  fabOpen: false,
  toasts: [],
  setActiveGroup: id => set({ activeGroupId: id }),
  setFabOpen: open => set({ fabOpen: open }),
  pushToast: message =>
    set(state => ({
      toasts: [...state.toasts, { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, message }],
    })),
  dismissToast: id =>
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),
}))
