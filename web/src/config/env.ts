const env = import.meta.env

export const API_BASE_URL = (env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
/** With no API configured, the app runs against an in-browser mock of the Lambda API. */
export const USE_MOCK_API = !API_BASE_URL

/**
 * How staff sign in when a real API is configured.
 *  - 'cognito' (default): Amazon Cognito.
 *  - 'local': password-less sign-in that issues unsigned tokens accepted only by the local dev server
 *    (backend `npm run dev`). Honoured in `vite dev` only — production builds always use Cognito.
 */
export const AUTH_MODE: 'mock' | 'local' | 'cognito' = USE_MOCK_API
  ? 'mock'
  : env.VITE_AUTH_MODE === 'local' && env.DEV
    ? 'local'
    : 'cognito'

if (env.VITE_AUTH_MODE === 'local' && !env.DEV) {
  console.error('VITE_AUTH_MODE=local is ignored outside development builds; using Cognito.')
}

export const COGNITO_REGION = env.VITE_COGNITO_REGION ?? 'us-east-1'
export const COGNITO_CLIENT_ID = env.VITE_COGNITO_CLIENT_ID ?? ''

export const PUBLIC_PHONE = env.VITE_PUBLIC_PHONE || '(214) 555-0142'
export const PUBLIC_EMAIL = env.VITE_PUBLIC_EMAIL || 'hello@dfwlawnpros.com'
export const PHONE_HREF = `tel:+1${PUBLIC_PHONE.replace(/\D/g, '')}`
