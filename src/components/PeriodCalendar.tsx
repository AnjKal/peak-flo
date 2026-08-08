import { useMemo, useState } from 'react'
import type { DayButtonProps } from 'react-day-picker'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'

import { usePeriodContext } from '../context/PeriodContext'
import type { BleedingIntensity } from '../types/period'
import { formatDateKey } from '../utils/date'
import { BleedingSelector } from './BleedingSelector'
import { Card, CardContent } from './ui/card'

const starColorByIntensity: Record<BleedingIntensity, string> = {
  light: '#F8BBD0',
  medium: '#EC407A',
  heavy: '#C2185B',
}

export function PeriodCalendar() {
  const { entries, upsertEntry, removeEntry } = usePeriodContext()
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [isSelectorOpen, setIsSelectorOpen] = useState(false)

  const entryByDate = useMemo(() => new Map(entries.map((entry) => [entry.date, entry])), [entries])

  const openSelector = (date: Date) => {
    setSelectedDate(date)
    setIsSelectorOpen(true)
  }

  const selectedDateKey = selectedDate ? formatDateKey(selectedDate) : null
  const selectedEntry = selectedDateKey ? entryByDate.get(selectedDateKey) : undefined

  const CustomDayButton = (props: DayButtonProps) => {
    const dayKey = formatDateKey(props.day.date)
    const entry = entryByDate.get(dayKey)

    return (
      <button
        {...props}
        className={`h-11 w-11 rounded-xl p-0 font-medium text-text transition hover:bg-[#FCE4EC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${props.className ?? ''}`}
        aria-label={entry ? `${dayKey} period intensity ${entry.intensity}` : `${dayKey} no period marker`}
        onDoubleClick={(event) => {
          props.onDoubleClick?.(event)
          openSelector(props.day.date)
        }}
      >
        <span className="flex items-center justify-center gap-1">
          <span>{props.day.date.getDate()}</span>
          {entry && (
            <span aria-hidden="true" style={{ color: starColorByIntensity[entry.intensity] }}>
              ★
            </span>
          )}
        </span>
      </button>
    )
  }

  return (
    <>
      <Card>
        <CardContent className="p-4 sm:p-6">
          <DayPicker
            mode="single"
            captionLayout="label"
            showOutsideDays
            onDayClick={(day) => openSelector(day)}
            className="mx-auto"
            classNames={{
              months: 'flex justify-center',
              month: 'space-y-4 w-full',
              nav: 'flex items-center justify-between gap-1',
              month_caption: 'relative flex items-center justify-center py-1.5 text-lg font-semibold text-text',
              month_grid: 'w-full border-collapse',
              weekdays: 'grid grid-cols-7',
              week: 'mt-2 grid grid-cols-7',
              weekday: 'h-10 text-center text-sm font-medium text-[#7A7A7A]',
              day: 'flex h-12 items-center justify-center p-0',
              outside: 'text-[#BCBCBC]',
              selected: 'bg-transparent',
              today: 'rounded-xl border border-accent',
            }}
            components={{
              DayButton: CustomDayButton,
            }}
          />
        </CardContent>
      </Card>

      <BleedingSelector
        open={isSelectorOpen}
        date={selectedDateKey}
        currentIntensity={selectedEntry?.intensity}
        onOpenChange={setIsSelectorOpen}
        onSelect={(intensity) => {
          if (!selectedDate) {
            return
          }

          upsertEntry(selectedDate, intensity)
          setIsSelectorOpen(false)
        }}
        onRemove={() => {
          if (!selectedDate) {
            return
          }

          removeEntry(selectedDate)
          setIsSelectorOpen(false)
        }}
      />
    </>
  )
}
