export interface PeriodEntry {
  id: string
  date: string
  intensity: 'light' | 'medium' | 'heavy'
}

export type BleedingIntensity = PeriodEntry['intensity']
