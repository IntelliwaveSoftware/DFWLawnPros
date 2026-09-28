// Minimal Amazon Cognito User Pools client using the public JSON API (no SDK needed).
// The app client must have USER_PASSWORD_AUTH enabled and no client secret.
import { COGNITO_CLIENT_ID, COGNITO_REGION } from '@/config/env'
import type { Role } from '@/lib/types'
import type { Session } from './session'

const endpoint = () => `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`

async function call<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${action}`,
    },
    body: JSON.stringify({ ClientId: COGNITO_CLIENT_ID, ...body }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || data.__type || 'Authentication failed')
  return data as T
}

function decodeJwt(token: string): Record<string, unknown> {
  const part = token.split('.')[1] ?? ''
  const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
  return JSON.parse(decodeURIComponent(escape(json)))
}

interface AuthResult {
  AuthenticationResult?: { IdToken: string; RefreshToken?: string; ExpiresIn: number }
  ChallengeName?: string
}

function toSession(result: AuthResult, refreshFallback?: string): Session {
  const auth = result.AuthenticationResult
  if (!auth) {
    throw new Error(
      result.ChallengeName === 'NEW_PASSWORD_REQUIRED'
        ? 'A password change is required for this account. Contact an administrator.'
        : 'Additional verification is required.',
    )
  }
  const claims = decodeJwt(auth.IdToken)
  const groups = (claims['cognito:groups'] as string[] | undefined) ?? []
  const role: Role = groups.includes('admin') ? 'admin' : 'contractor'
  return {
    user: {
      id: String(claims.sub),
      email: String(claims.email ?? ''),
      name: String(claims.name ?? claims.email ?? ''),
      role,
    },
    idToken: auth.IdToken,
    refreshToken: auth.RefreshToken ?? refreshFallback,
    expiresAt: Date.now() + auth.ExpiresIn * 1000,
  }
}

export async function cognitoSignIn(email: string, password: string) {
  const result = await call<AuthResult>('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: { USERNAME: email, PASSWORD: password },
  })
  return toSession(result)
}

export async function cognitoRefresh(refreshToken: string) {
  const result = await call<AuthResult>('InitiateAuth', {
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    AuthParameters: { REFRESH_TOKEN: refreshToken },
  })
  return toSession(result, refreshToken)
}

export async function cognitoSignUp(email: string, password: string, name: string) {
  await call('SignUp', {
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'name', Value: name },
    ],
  })
}

export async function cognitoConfirm(email: string, code: string) {
  await call('ConfirmSignUp', { Username: email, ConfirmationCode: code })
}
