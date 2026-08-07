import { useState } from 'react'

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

export function usePeriodStorage() {
  const [entries, setEntries] = useState<PeriodEntry[]>(() => loadPeriodEntries())

  const persistEntries = (nextEntries: PeriodEntry[]) => {
    setEntries(nextEntries)
    window.localStorage.setItem(PERIOD_STORAGE_KEY, JSON.stringify(nextEntries))
  }

  const upsertEntry = (date: Date, intensity: BleedingIntensity) => {
    const dateKey = formatDateKey(date)
    const existingEntry = entries.find((entry) => entry.date === dateKey)

    const nextEntries = existingEntry
      ? entries.map((entry) =>
          entry.date === dateKey
            ? {
                ...entry,
                intensity,
              }
            : entry,
        )
      : [
          ...entries,
          {
            id: globalThis.crypto?.randomUUID?.() ?? `${dateKey}-${intensity}`,
            date: dateKey,
            intensity,
          },
        ]

    persistEntries(nextEntries.sort((first, second) => compareDateKeys(first.date, second.date)))
  }

  const removeEntry = (date: Date) => {
    const dateKey = formatDateKey(date)
    persistEntries(entries.filter((entry) => entry.date !== dateKey))
  }

  return {
    entries,
    upsertEntry,
    removeEntry,
  }
}
