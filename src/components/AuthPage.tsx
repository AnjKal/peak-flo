import { useMemo, useState, type FormEvent } from 'react'

import { useAuthContext } from '../context/AuthContext'

type AuthMode = 'sign-in' | 'sign-up' | 'confirm'

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Authentication failed. Please try again.'
}

export function AuthPage() {
  const { signIn, signUp, confirmSignUp, isConfigured } = useAuthContext()
  const [mode, setMode] = useState<AuthMode>('sign-in')

  const [signInUsername, setSignInUsername] = useState('')
  const [signInPassword, setSignInPassword] = useState('')

  const [signUpUsername, setSignUpUsername] = useState('')
  const [signUpEmail, setSignUpEmail] = useState('')
  const [signUpPassword, setSignUpPassword] = useState('')

  const [confirmationCode, setConfirmationCode] = useState('')
  const [pendingUsername, setPendingUsername] = useState('')
  const [pendingPassword, setPendingPassword] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const confirmUsername = useMemo(() => pendingUsername || signUpUsername, [pendingUsername, signUpUsername])

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setIsSubmitting(true)

    try {
      await signIn({
        username: signInUsername.trim(),
        password: signInPassword,
      })
    } catch (signInError) {
      setError(getErrorMessage(signInError))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setIsSubmitting(true)

    try {
      const username = signUpUsername.trim()
      const password = signUpPassword
      const email = signUpEmail.trim()

      const result = await signUp({ username, email, password })
      setPendingUsername(username)
      setPendingPassword(password)

      if (result.requiresConfirmation) {
        setMode('confirm')
        setNotice('Account created. Enter the verification code sent to your email.')
      } else {
        await signIn({ username, password })
      }
    } catch (signUpError) {
      setError(getErrorMessage(signUpError))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setIsSubmitting(true)

    try {
      const username = confirmUsername.trim()
      await confirmSignUp({ username, confirmationCode: confirmationCode.trim() })

      if (!pendingPassword) {
        throw new Error('Please sign in with your password after confirmation.')
      }

      await signIn({ username, password: pendingPassword })
    } catch (confirmError) {
      setError(getErrorMessage(confirmError))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isConfigured) {
    return (
      <main className="min-h-screen bg-background px-4 py-10 text-text sm:px-6 sm:py-14">
        <section className="mx-auto w-full max-w-xl rounded-3xl border border-dashed border-[#E0B7C8] bg-white/90 p-8 text-sm text-[#5A5A5A] shadow-[0_18px_45px_rgba(183,92,131,0.08)]">
          <h1 className="text-2xl font-semibold text-text">Peak Flo</h1>
          <p className="mt-3">
            Configure AWS environment variables to enable Cognito sign in and DynamoDB sync.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-text sm:px-6 sm:py-14">
      <section className="mx-auto w-full max-w-xl rounded-3xl border border-[#F0D5E0] bg-white/95 p-8 shadow-[0_24px_55px_rgba(183,92,131,0.14)]">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-accent">Peak Flo</h1>

        {mode !== 'confirm' && (
          <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-[#FCEAF1] p-2">
            <button
              type="button"
              className={`h-10 rounded-xl text-sm font-medium transition ${
                mode === 'sign-in' ? 'bg-white text-text shadow-sm' : 'text-[#7E5A69]'
              }`}
              onClick={() => {
                setMode('sign-in')
                setError(null)
                setNotice(null)
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`h-10 rounded-xl text-sm font-medium transition ${
                mode === 'sign-up' ? 'bg-white text-text shadow-sm' : 'text-[#7E5A69]'
              }`}
              onClick={() => {
                setMode('sign-up')
                setError(null)
                setNotice(null)
              }}
            >
              Sign Up
            </button>
          </div>
        )}

        {notice && <p className="mt-4 text-sm text-[#5A5A5A]">{notice}</p>}
        {error && <p className="mt-4 text-sm text-[#8A4B66]">{error}</p>}

        {mode === 'sign-in' && (
          <form className="mt-6 grid gap-3" onSubmit={handleSignIn}>
            <input
              autoComplete="username"
              type="text"
              required
              placeholder="Username"
              value={signInUsername}
              onChange={(event) => setSignInUsername(event.target.value)}
              className="h-11 rounded-xl border border-[#E7C5D3] bg-white px-3 text-sm text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-[#FAD8E5]"
            />
            <input
              autoComplete="current-password"
              type="password"
              required
              placeholder="Password"
              value={signInPassword}
              onChange={(event) => setSignInPassword(event.target.value)}
              className="h-11 rounded-xl border border-[#E7C5D3] bg-white px-3 text-sm text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-[#FAD8E5]"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {mode === 'sign-up' && (
          <form className="mt-6 grid gap-3" onSubmit={handleSignUp}>
            <input
              autoComplete="username"
              type="text"
              required
              placeholder="Username"
              value={signUpUsername}
              onChange={(event) => setSignUpUsername(event.target.value)}
              className="h-11 rounded-xl border border-[#E7C5D3] bg-white px-3 text-sm text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-[#FAD8E5]"
            />
            <input
              autoComplete="email"
              type="email"
              required
              placeholder="Email"
              value={signUpEmail}
              onChange={(event) => setSignUpEmail(event.target.value)}
              className="h-11 rounded-xl border border-[#E7C5D3] bg-white px-3 text-sm text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-[#FAD8E5]"
            />
            <input
              autoComplete="new-password"
              type="password"
              required
              minLength={8}
              placeholder="Password"
              value={signUpPassword}
              onChange={(event) => setSignUpPassword(event.target.value)}
              className="h-11 rounded-xl border border-[#E7C5D3] bg-white px-3 text-sm text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-[#FAD8E5]"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        )}

        {mode === 'confirm' && (
          <form className="mt-6 grid gap-3" onSubmit={handleConfirmSignUp}>
            <input
              type="text"
              required
              placeholder="Username"
              value={confirmUsername}
              onChange={(event) => setPendingUsername(event.target.value)}
              className="h-11 rounded-xl border border-[#E7C5D3] bg-white px-3 text-sm text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-[#FAD8E5]"
            />
            <input
              type="text"
              required
              placeholder="Verification code"
              value={confirmationCode}
              onChange={(event) => setConfirmationCode(event.target.value)}
              className="h-11 rounded-xl border border-[#E7C5D3] bg-white px-3 text-sm text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-[#FAD8E5]"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Confirming...' : 'Confirm and Sign In'}
            </button>
            <button
              type="button"
              className="text-sm text-[#8A4B66] underline underline-offset-4"
              onClick={() => {
                setMode('sign-in')
                setError(null)
                setNotice(null)
              }}
            >
              Back to Sign In
            </button>
          </form>
        )}
      </section>
    </main>
  )
}
