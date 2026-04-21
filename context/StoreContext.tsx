// context/StoreContext.tsx
import React, { createContext, useContext, ReactNode } from 'react'
import { useStore } from '@/hooks/useStore'

type StoreContextType = ReturnType<typeof useStore>

const StoreContext = createContext<StoreContextType | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const store = useStore()
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useStoreContext() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStoreContext must be used inside StoreProvider')
  return ctx
}
