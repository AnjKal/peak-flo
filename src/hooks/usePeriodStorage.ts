import { useEffect, useState } from 'react'

import { useAuthContext } from '../context/AuthContext'
import { isPersistenceConfigured } from '../lib/awsConfig'
import { deletePeriodEntry, listPeriodEntries, upsertPeriodEntry } from '../lib/periodRepository'
import { compareDateKeys, formatDateKey } from '../utils/date'
import type { BleedingIntensity, PeriodEntry } from '../types/period'

const PERIOD_STORAGE_KEY = 'period_entries'

function isPeriodEntry(value: unknown): value is PeriodEntry {
  if (!value || typeof value !== 'object') {
    return false
  }

  const entry = value as Partial<PeriodEntry>
  return (
    typeof entry.id === 'string' &&
    typeof entry.date === 'string' &&
    (entry.intensity === 'light' || entry.intensity === 'medium' || entry.intensity === 'heavy')
  )
}

function loadPeriodEntries(): PeriodEntry[] {
  if (typeof window === 'undefined') {
    return []
  }

  const rawValue = window.localStorage.getItem(PERIOD_STORAGE_KEY)
  if (!rawValue) {
    return []
  }

  try {
    const parsed = JSON.parse(rawValue)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(isPeriodEntry).sort((first, second) => compareDateKeys(first.date, second.date))
  } catch {
    return []
  }
}

function persistLocalEntries(nextEntries: PeriodEntry[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(PERIOD_STORAGE_KEY, JSON.stringify(nextEntries))
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unable to sync period data right now.'
}

export function usePeriodStorage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthContext()
  const [entries, setEntries] = useState<PeriodEntry[]>(() => loadPeriodEntries())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isRemoteEnabled = isAuthenticated && isPersistenceConfigured

  useEffect(() => {
    let isActive = true

    const loadEntries = async () => {
      setIsLoading(true)

      if (!isRemoteEnabled) {
        const localEntries = loadPeriodEntries()
        if (isActive) {
          setEntries(localEntries)
          setError(null)
          setIsLoading(false)
        }
        return
      }

      try {
        const remoteEntries = await listPeriodEntries()
        if (isActive) {
          setEntries(remoteEntries)
          persistLocalEntries(remoteEntries)
          setError(null)
        }
      } catch (loadError) {
        if (isActive) {
          setError(getErrorMessage(loadError))
          setEntries(loadPeriodEntries())
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadEntries()

    return () => {
      isActive = false
    }
  }, [isRemoteEnabled, isAuthLoading])

  const upsertEntry = (date: Date, intensity: BleedingIntensity) => {
    const dateKey = formatDateKey(date)
    const existingEntry = entries.find((entry) => entry.date === dateKey)

    const nextEntry = existingEntry
      ? {
          ...existingEntry,
          intensity,
        }
      : {
          id: globalThis.crypto?.randomUUID?.() ?? `${dateKey}-${intensity}`,
          date: dateKey,
          intensity,
        }

    const nextEntries = existingEntry
      ? entries.map((entry) =>
          entry.date === dateKey
            ? nextEntry
            : entry,
        )
      : [...entries, nextEntry]

    const sortedEntries = nextEntries.sort((first, second) => compareDateKeys(first.date, second.date))
    setEntries(sortedEntries)
    persistLocalEntries(sortedEntries)

    if (isRemoteEnabled) {
      void upsertPeriodEntry(nextEntry).catch((syncError) => {
        setError(getErrorMessage(syncError))
      })
    }
  }

  const removeEntry = (date: Date) => {
    const dateKey = formatDateKey(date)
    const nextEntries = entries.filter((entry) => entry.date !== dateKey)

    setEntries(nextEntries)
    persistLocalEntries(nextEntries)

    if (isRemoteEnabled) {
      void deletePeriodEntry(dateKey).catch((syncError) => {
        setError(getErrorMessage(syncError))
      })
    }
  }

  return {
    entries,
    isLoading: isLoading || isAuthLoading,
    error,
    isRemoteEnabled,
    upsertEntry,
    removeEntry,
  }
}
