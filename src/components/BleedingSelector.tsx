import { format, parseISO } from 'date-fns'

import type { BleedingIntensity } from '../types/period'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

const intensityOptions: { label: string; value: BleedingIntensity; color: string }[] = [
  { label: 'Light', value: 'light', color: '#F8BBD0' },
  { label: 'Medium', value: 'medium', color: '#EC407A' },
  { label: 'Heavy', value: 'heavy', color: '#C2185B' },
]

interface BleedingSelectorProps {
  open: boolean
  date: string | null
  currentIntensity?: BleedingIntensity
  onOpenChange: (open: boolean) => void
  onSelect: (intensity: BleedingIntensity) => void
  onRemove: () => void
}

export function BleedingSelector({
  open,
  date,
  currentIntensity,
  onOpenChange,
  onSelect,
  onRemove,
}: BleedingSelectorProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select bleeding intensity</DialogTitle>
          <DialogDescription>
            {date ? `Date: ${format(parseISO(date), 'MMMM d, yyyy')}` : 'Select a date'}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 grid gap-3">
          {intensityOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={currentIntensity === option.value ? 'default' : 'secondary'}
              className="justify-between"
              onClick={() => onSelect(option.value)}
            >
              {option.label}
              <span aria-hidden="true" className="text-base" style={{ color: option.color }}>
                ★
              </span>
            </Button>
          ))}
          {currentIntensity && (
            <Button type="button" variant="destructive" onClick={onRemove}>
              Remove marker
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
