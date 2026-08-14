import { compareDateKeys } from '../utils/date'
import type { PeriodEntry } from '../types/period'
import {
  getApiBaseUrl as getConfiguredApiBaseUrl,
  isPersistenceConfigured,
} from './awsConfig'

function isStoredPeriodRecord(value: unknown): value is StoredPeriodRecord {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Partial<StoredPeriodRecord>
  return (
    typeof record.userId === 'string' &&
    typeof record.id === 'string' &&
    typeof record.date === 'string' &&
    (record.intensity === 'light' || record.intensity === 'medium' || record.intensity === 'heavy') &&
    typeof record.createdAt === 'string' &&
    typeof record.updatedAt === 'string'
  )
}

interface StoredPeriodRecord extends PeriodEntry {
  userId: string
  createdAt: string
  updatedAt: string
}

function getPersistenceApiBaseUrl() {
  if (!isPersistenceConfigured) {
    throw new Error('Remote persistence is not configured. Set VITE_PERIOD_API_BASE_URL.')
  }

  return getConfiguredApiBaseUrl()
}

async function apiRequest(path: string, init?: RequestInit) {
  const response = await fetch(`${getPersistenceApiBaseUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const responseText = await response.text()
    throw new Error(responseText || 'Remote persistence request failed.')
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

export async function listPeriodEntries() {
  const response = await apiRequest('/api/period-entries')
  const items = Array.isArray(response) ? response : []

  return items
    .filter(isStoredPeriodRecord)
    .sort((first, second) => compareDateKeys(first.date, second.date))
    .map(({ id, date, intensity }) => ({ id, date, intensity }))
}

export async function upsertPeriodEntry(entry: PeriodEntry) {
  const response = await apiRequest('/api/period-entries', {
    method: 'PUT',
    body: JSON.stringify(entry),
  })

  if (!isStoredPeriodRecord(response)) {
    throw new Error('Unexpected response from persistence API.')
  }

  return { id: response.id, date: response.date, intensity: response.intensity }
}

export async function deletePeriodEntry(date: string) {
  await apiRequest(`/api/period-entries/${encodeURIComponent(date)}`, {
    method: 'DELETE',
  })
}