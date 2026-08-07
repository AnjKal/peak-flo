import { usePeriodContext } from '../context/PeriodContext'
import { getDaysSinceMostRecentStart } from '../utils/date'
import { Card, CardContent } from './ui/card'

export function DaysSinceCounter() {
  const { entries } = usePeriodContext()
  const daysSinceLastStart = getDaysSinceMostRecentStart(entries)

  return (
    <Card className="mx-auto mt-6 w-full max-w-lg">
      <CardContent className="text-center">
        <h2 className="text-xl font-semibold text-text">Days since last period started</h2>
        <p className="mt-2 text-base text-[#5A5A5A]">
          {daysSinceLastStart === null ? 'No period recorded yet.' : daysSinceLastStart}
        </p>
      </CardContent>
    </Card>
  )
}
