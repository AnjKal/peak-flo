import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { getApiBaseUrl, isAuthConfigured } from '../lib/awsConfig'

interface SignInCredentials {
  username: string
  password: string
}

interface SignUpDetails {
  username: string
  email: string
  password: string
}

interface ConfirmSignUpDetails {
  username: string
  confirmationCode: string
}

interface SignUpResult {
  requiresConfirmation: boolean
}

interface AuthUser {
  username: string
  userId: string
}

interface SignInResponse extends AuthUser {
  accessToken: string
}

const TOKEN_STORAGE_KEY = 'peakflo_access_token'

// --------------------------------------------------------------
// Token storage
// --------------------------------------------------------------
// The Cognito access token now travels as an Authorization: Bearer
// header instead of a cookie, since the frontend (Vercel) and API
// (API Gateway) are on different domains and cookies don't survive
// that cross-site boundary reliably. localStorage persists it
// across refreshes.

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

function clearStoredToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

async function readError(response: Response) {
  const message = await response.text()
  return message || 'Authentication request failed.'
}

// Exported so other files (e.g. period-entries API calls) can reuse
// the same authenticated-fetch behavior instead of duplicating it.
export async function authRequest(path: string, init?: RequestInit) {
  const token = getStoredToken()

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    throw new Error(await readError(response))
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

interface AuthContextValue {
  isConfigured: boolean
  isLoading: boolean
  isAuthenticated: boolean
  user: AuthUser | null
  signIn: (credentials: SignInCredentials) => Promise<void>
  signUp: (details: SignUpDetails) => Promise<SignUpResult>
  confirmSignUp: (details: ConfirmSignUpDetails) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isActive = true

    const loadUser = async () => {
      if (!isAuthConfigured) {
        setUser(null)
        setIsLoading(false)
        return
      }

      // No token stored yet — skip the request entirely rather than
      // making a call that's guaranteed to 401.
      if (!getStoredToken()) {
        setUser(null)
        setIsLoading(false)
        return
      }

      try {
        const currentUser = (await authRequest('/api/auth/me')) as AuthUser
        if (isActive) {
          setUser(currentUser)
        }
      } catch {
        if (isActive) {
          setUser(null)
          clearStoredToken()
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadUser()

    return () => {
      isActive = false
    }
  }, [])

  const handleSignIn = async ({ username, password }: SignInCredentials) => {
    const result = (await authRequest('/api/auth/sign-in', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })) as SignInResponse

    setStoredToken(result.accessToken)
    setUser({ username: result.username, userId: result.userId })
  }

  const handleSignUp = async ({ username, email, password }: SignUpDetails): Promise<SignUpResult> => {
    const result = (await authRequest('/api/auth/sign-up', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    })) as SignUpResult

    return {
      requiresConfirmation: Boolean(result?.requiresConfirmation),
    }
  }

  const handleConfirmSignUp = async ({ username, confirmationCode }: ConfirmSignUpDetails) => {
    await authRequest('/api/auth/confirm-sign-up', {
      method: 'POST',
      body: JSON.stringify({ username, confirmationCode }),
    })
  }

  const handleSignOut = async () => {
    try {
      await authRequest('/api/auth/sign-out', {
        method: 'POST',
      })
    } finally {
      clearStoredToken()
      setUser(null)
    }
  }

  const value: AuthContextValue = {
    isConfigured: isAuthConfigured,
    isLoading: isAuthConfigured ? isLoading : false,
    isAuthenticated: Boolean(user),
    user,
    signIn: handleSignIn,
    signUp: handleSignUp,
    confirmSignUp: handleConfirmSignUp,
    signOut: handleSignOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }

  return context
}