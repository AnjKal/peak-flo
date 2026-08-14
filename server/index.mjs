import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { randomUUID } from 'node:crypto'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb'
import {
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
  GlobalSignOutCommand,
  InitiateAuthCommand,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'

const requiredEnv = ['AWS_REGION', 'COGNITO_USER_POOL_CLIENT_ID', 'DYNAMODB_PERIOD_TABLE_NAME']
for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required server env var: ${key}`)
  }
}

const region = process.env.AWS_REGION
const userPoolClientId = process.env.COGNITO_USER_POOL_CLIENT_ID
const tableName = process.env.DYNAMODB_PERIOD_TABLE_NAME
const serverPort = Number(process.env.API_PORT || 8787)
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173'
const isProduction = process.env.NODE_ENV === 'production'

const PROFILE_SORT_KEY = '__PROFILE__'
const SESSION_COOKIE = 'peakflo_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7

const baseClient = new DynamoDBClient({ region })
const db = DynamoDBDocumentClient.from(baseClient)
const cognito = new CognitoIdentityProviderClient({ region })

const app = express()
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
)
app.use(express.json())
app.use(cookieParser())

const sessions = new Map()

function isValidIntensity(value) {
  return value === 'light' || value === 'medium' || value === 'heavy'
}

function isValidDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function getMonthKey(dateKey) {
  return dateKey.slice(0, 7)
}

function createEmptyProfile(userId) {
  const now = new Date().toISOString()
  return {
    userId,
    date: PROFILE_SORT_KEY,
    entriesByMonth: {},
    createdAt: now,
    updatedAt: now,
  }
}

function isProfileItem(item, userId) {
  return (
    item &&
    typeof item === 'object' &&
    item.userId === userId &&
    item.date === PROFILE_SORT_KEY &&
    item.entriesByMonth &&
    typeof item.entriesByMonth === 'object'
  )
}

function isLegacyEntryItem(item, userId) {
  return (
    item &&
    typeof item === 'object' &&
    item.userId === userId &&
    isValidDateKey(item.date) &&
    isValidIntensity(item.intensity)
  )
}

function setProfileEntry(profile, entry) {
  const now = new Date().toISOString()
  const monthKey = getMonthKey(entry.date)
  const monthRecord = profile.entriesByMonth[monthKey] ?? {}
  const existing = monthRecord[entry.date]

  monthRecord[entry.date] = {
    id: entry.id,
    intensity: entry.intensity,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  profile.entriesByMonth[monthKey] = monthRecord
  profile.updatedAt = now

  return {
    userId: profile.userId,
    id: entry.id,
    date: entry.date,
    intensity: entry.intensity,
    createdAt: monthRecord[entry.date].createdAt,
    updatedAt: monthRecord[entry.date].updatedAt,
  }
}

function removeProfileEntry(profile, dateKey) {
  const monthKey = getMonthKey(dateKey)
  const monthRecord = profile.entriesByMonth[monthKey]

  if (!monthRecord || !monthRecord[dateKey]) {
    return
  }

  delete monthRecord[dateKey]
  if (Object.keys(monthRecord).length === 0) {
    delete profile.entriesByMonth[monthKey]
  } else {
    profile.entriesByMonth[monthKey] = monthRecord
  }

  profile.updatedAt = new Date().toISOString()
}

function flattenProfile(profile) {
  const entries = []

  for (const monthRecord of Object.values(profile.entriesByMonth)) {
    if (!monthRecord || typeof monthRecord !== 'object') {
      continue
    }

    for (const [date, value] of Object.entries(monthRecord)) {
      if (!value || typeof value !== 'object') {
        continue
      }

      if (!isValidDateKey(date) || !isValidIntensity(value.intensity) || typeof value.id !== 'string') {
        continue
      }

      entries.push({
        userId: profile.userId,
        id: value.id,
        date,
        intensity: value.intensity,
        createdAt: typeof value.createdAt === 'string' ? value.createdAt : profile.createdAt,
        updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : profile.updatedAt,
      })
    }
  }

  return entries.sort((first, second) => first.date.localeCompare(second.date))
}

async function writeProfile(profile) {
  await db.send(
    new PutCommand({
      TableName: tableName,
      Item: profile,
    }),
  )
}

async function loadProfile(userId) {
  const profileResult = await db.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        userId,
        date: PROFILE_SORT_KEY,
      },
    }),
  )

  if (isProfileItem(profileResult.Item, userId)) {
    return profileResult.Item
  }

  const legacyResult = await db.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    }),
  )

  const legacyEntries = (legacyResult.Items ?? []).filter((item) => isLegacyEntryItem(item, userId))
  const profile = createEmptyProfile(userId)

  for (const legacyEntry of legacyEntries) {
    setProfileEntry(profile, {
      id: legacyEntry.id,
      date: legacyEntry.date,
      intensity: legacyEntry.intensity,
    })
  }

  if (legacyEntries.length > 0) {
    await writeProfile(profile)
  }

  return profile
}

function setSessionCookie(response, sessionId) {
  response.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: SESSION_TTL_MS,
  })
}

function clearSessionCookie(response) {
  response.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
  })
}

function getCurrentSession(request) {
  const sessionId = request.cookies?.[SESSION_COOKIE]
  if (!sessionId || typeof sessionId !== 'string') {
    return null
  }

  const session = sessions.get(sessionId)
  if (!session) {
    return null
  }

  if (Date.now() >= session.expiresAt) {
    sessions.delete(sessionId)
    return null
  }

  return { sessionId, ...session }
}

function requireSession(request, response) {
  const session = getCurrentSession(request)
  if (!session) {
    response.status(401).send('Not authenticated')
    return null
  }

  return session
}

app.post('/api/auth/sign-up', async (request, response) => {
  try {
    const { username, email, password } = request.body ?? {}

    if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      response.status(400).send('Invalid sign-up payload')
      return
    }

    const result = await cognito.send(
      new SignUpCommand({
        ClientId: userPoolClientId,
        Username: username.trim(),
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email.trim() },
          { Name: 'given_name', Value: username.trim() },
        ],
      }),
    )

    response.json({
      requiresConfirmation: !result.UserConfirmed,
    })
  } catch (error) {
    response.status(400).send(error instanceof Error ? error.message : 'Sign-up failed')
  }
})

app.post('/api/auth/confirm-sign-up', async (request, response) => {
  try {
    const { username, confirmationCode } = request.body ?? {}

    if (typeof username !== 'string' || typeof confirmationCode !== 'string') {
      response.status(400).send('Invalid confirmation payload')
      return
    }

    await cognito.send(
      new ConfirmSignUpCommand({
        ClientId: userPoolClientId,
        Username: username.trim(),
        ConfirmationCode: confirmationCode.trim(),
      }),
    )

    response.status(204).send()
  } catch (error) {
    response.status(400).send(error instanceof Error ? error.message : 'Confirmation failed')
  }
})

app.post('/api/auth/sign-in', async (request, response) => {
  try {
    const { username, password } = request.body ?? {}

    if (typeof username !== 'string' || typeof password !== 'string') {
      response.status(400).send('Invalid sign-in payload')
      return
    }

    const result = await cognito.send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: userPoolClientId,
        AuthParameters: {
          USERNAME: username.trim(),
          PASSWORD: password,
        },
      }),
    )

    if (result.ChallengeName) {
      response
        .status(400)
        .send(`Sign-in challenge required: ${result.ChallengeName}. Configure the user pool for username/password sign-in.`)
      return
    }

    const authResult = result.AuthenticationResult
    if (!authResult?.AccessToken) {
      response.status(400).send('Cognito did not return an access token.')
      return
    }

    const expiresInSeconds = Number(authResult.ExpiresIn ?? 3600)
    const expiresAt = Date.now() + expiresInSeconds * 1000
    const sessionId = randomUUID()

    sessions.set(sessionId, {
      username: username.trim(),
      accessToken: authResult.AccessToken,
      expiresAt,
    })

    setSessionCookie(response, sessionId)

    response.json({
      username: username.trim(),
      userId: username.trim(),
    })
  } catch (error) {
    response.status(401).send(error instanceof Error ? error.message : 'Sign-in failed')
  }
})

app.get('/api/auth/me', (request, response) => {
  const session = getCurrentSession(request)
  if (!session) {
    response.status(401).send('Not authenticated')
    return
  }

  response.json({
    username: session.username,
    userId: session.username,
  })
})

app.post('/api/auth/sign-out', async (request, response) => {
  const session = getCurrentSession(request)

  if (!session) {
    clearSessionCookie(response)
    response.status(204).send()
    return
  }

  try {
    await cognito.send(
      new GlobalSignOutCommand({
        AccessToken: session.accessToken,
      }),
    )
  } catch {
    // Ignore upstream sign-out failures and still clear local session.
  }

  sessions.delete(session.sessionId)
  clearSessionCookie(response)
  response.status(204).send()
})

app.get('/api/period-entries', async (request, response) => {
  const session = requireSession(request, response)
  if (!session) {
    return
  }

  try {
    const profile = await loadProfile(session.username)
    response.json(flattenProfile(profile))
  } catch (error) {
    response.status(500).send(error instanceof Error ? error.message : 'Unable to load entries')
  }
})

app.put('/api/period-entries', async (request, response) => {
  const session = requireSession(request, response)
  if (!session) {
    return
  }

  try {
    const { id, date, intensity } = request.body ?? {}

    if (typeof id !== 'string' || !isValidDateKey(date) || !isValidIntensity(intensity)) {
      response.status(400).send('Invalid period entry payload')
      return
    }

    const profile = await loadProfile(session.username)
    const savedEntry = setProfileEntry(profile, { id, date, intensity })
    await writeProfile(profile)

    response.json(savedEntry)
  } catch (error) {
    response.status(500).send(error instanceof Error ? error.message : 'Unable to save entry')
  }
})

app.delete('/api/period-entries/:date', async (request, response) => {
  const session = requireSession(request, response)
  if (!session) {
    return
  }

  try {
    const date = request.params.date

    if (!isValidDateKey(date)) {
      response.status(400).send('Invalid date key')
      return
    }

    const profile = await loadProfile(session.username)
    removeProfileEntry(profile, date)
    await writeProfile(profile)

    response.status(204).send()
  } catch (error) {
    response.status(500).send(error instanceof Error ? error.message : 'Unable to delete entry')
  }
})

app.listen(serverPort, () => {
  console.log(`Peak Flo API running on http://localhost:${serverPort}`)
})
