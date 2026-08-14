import { AuthPage } from './components/AuthPage'
import { DaysSinceCounter } from './components/DaysSinceCounter'
import { PeriodCalendar } from './components/PeriodCalendar'
import { AuthProvider, useAuthContext } from './context/AuthContext'
import { PeriodProvider, usePeriodContext } from './context/PeriodContext'

function CalendarPage() {
  const { user, signOut } = useAuthContext()
  const { isLoading, error, isRemoteEnabled } = usePeriodContext()

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-text sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-[800px] space-y-6">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-accent sm:text-4xl">
          Peak Flo
        </h1>
        <section className="mx-auto flex w-full max-w-[800px] items-center justify-between gap-4 rounded-3xl border border-[#F0D5E0] bg-white/90 px-6 py-4 text-sm text-[#5A5A5A] shadow-[0_18px_45px_rgba(183,92,131,0.08)]">
          <div>
            <p className="font-semibold text-text">Signed in</p>
            <p>{user?.username ?? user?.userId ?? 'Cognito user'}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-full border border-[#E4AEC2] px-4 text-sm font-medium text-text transition hover:bg-[#FDEDF3]"
            onClick={signOut}
          >
            Sign out
          </button>
        </section>
        {isLoading && (
          <section className="rounded-3xl border border-[#F0D5E0] bg-white/90 p-6 text-sm text-[#5A5A5A] shadow-[0_18px_45px_rgba(183,92,131,0.08)]">
            Loading saved cycle data...
          </section>
        )}
        {error && (
          <section className="rounded-3xl border border-[#E4AEC2] bg-[#FFF8FB] p-4 text-sm text-[#8A4B66]">
            {error}
          </section>
        )}
        {isRemoteEnabled && (
          <p className="text-center text-xs uppercase tracking-[0.2em] text-[#8A4B66]">
            Synced with DynamoDB
          </p>
        )}
        <PeriodCalendar />
        <DaysSinceCounter />
      </div>
    </main>
  )
}

function AppContent() {
  const { isConfigured, isLoading, isAuthenticated } = useAuthContext()

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background px-4 py-10 text-text sm:px-6 sm:py-14">
        <section className="mx-auto w-full max-w-xl rounded-3xl border border-[#F0D5E0] bg-white/90 p-8 text-sm text-[#5A5A5A] shadow-[0_24px_55px_rgba(183,92,131,0.14)]">
          Loading authentication state...
        </section>
      </main>
    )
  }

  if (isConfigured && !isAuthenticated) {
    return <AuthPage />
  }

  return <CalendarPage />
}

function App() {
  return (
    <AuthProvider>
      <PeriodProvider>
        <AppContent />
      </PeriodProvider>
    </AuthProvider>
  )
}

export default App
