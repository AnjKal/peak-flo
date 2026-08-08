import { DaysSinceCounter } from './components/DaysSinceCounter'
import { PeriodCalendar } from './components/PeriodCalendar'
import { PeriodProvider } from './context/PeriodContext'

function App() {
  return (
    <PeriodProvider>
      <main className="min-h-screen bg-background px-4 py-6 text-text sm:px-6 sm:py-10">
        <div className="mx-auto w-full max-w-[800px] space-y-6">
          <h1 className="text-center text-3xl font-semibold tracking-tight text-accent sm:text-4xl">
            Peak Flo
          </h1>
          <PeriodCalendar />
          <DaysSinceCounter />
        </div>
      </main>
    </PeriodProvider>
  )
}

export default App
