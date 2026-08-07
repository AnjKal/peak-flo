import { createContext, useContext, type ReactNode } from 'react'

import { usePeriodStorage } from '../hooks/usePeriodStorage'

const PeriodContext = createContext<ReturnType<typeof usePeriodStorage> | null>(null)

export function PeriodProvider({ children }: { children: ReactNode }) {
  const periodStorage = usePeriodStorage()

  return <PeriodContext.Provider value={periodStorage}>{children}</PeriodContext.Provider>
}

export function usePeriodContext() {
  const context = useContext(PeriodContext)

  if (!context) {
    throw new Error('usePeriodContext must be used within a PeriodProvider')
  }

  return context
}
