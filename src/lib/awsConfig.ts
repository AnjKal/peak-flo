const env = import.meta.env

function readEnv(name: keyof ImportMetaEnv): string {
  return (env[name] ?? '').trim()
}

export const periodApiBaseUrl = readEnv('VITE_PERIOD_API_BASE_URL')

export const isPersistenceConfigured = Boolean(periodApiBaseUrl)
export const isAuthConfigured = isPersistenceConfigured

export function getApiBaseUrl() {
  if (!periodApiBaseUrl) {
    throw new Error('Missing VITE_PERIOD_API_BASE_URL configuration.')
  }

  return periodApiBaseUrl.replace(/\/$/, '')
}