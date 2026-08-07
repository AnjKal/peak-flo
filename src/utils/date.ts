import { compareAsc, differenceInCalendarDays, format, isAfter, parseISO } from 'date-fns'

import type { PeriodEntry } from '../types/period'

export const DATE_KEY_FORMAT = 'yyyy-MM-dd'

export function formatDateKey(date: Date): string {
  return format(date, DATE_KEY_FORMAT)
}

export function compareDateKeys(firstDate: string, secondDate: string): number {
  return compareAsc(parseISO(firstDate), parseISO(secondDate))
}

export function getMostRecentPeriodStart(entries: PeriodEntry[]): PeriodEntry | null {
  if (entries.length === 0) {
    return null
  }

  return entries.reduce((latest, current) =>
    isAfter(parseISO(current.date), parseISO(latest.date)) ? current : latest,
  )
}

export function getDaysSinceMostRecentStart(entries: PeriodEntry[], today: Date = new Date()): number | null {
  const latestEntry = getMostRecentPeriodStart(entries)

  if (!latestEntry) {
    return null
  }

  return differenceInCalendarDays(today, parseISO(latestEntry.date))
}
