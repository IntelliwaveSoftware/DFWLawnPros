const env = import.meta.env

export const API_BASE_URL = (env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
/** With no API configured, the app runs against an in-browser mock of the Lambda API. */
export const USE_MOCK_API = !API_BASE_URL

/**
 * Non-public environments only (the dev site): sent as X-Dev-Access on every API request. The dev build is
 * only served to visitors who pass the dev site's IP/password gate, which is what keeps it private.
 */
export const API_ACCESS_TOKEN = env.VITE_API_ACCESS_TOKEN ?? ''
export const apiAccessHeaders = (): Record<string, string> => (API_ACCESS_TOKEN ? { 'X-Dev-Access': API_ACCESS_TOKEN } : {})

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

/**
 * Amazon Location Service (address search + satellite tiles). The key is public by design: it is
 * restricted to the site's domains and to tile/place reads. Without it (demo mode, local dev),
 * the map falls back to free services that are fine for development but not for commercial traffic.
 */
export const AWS_LOCATION_KEY = env.VITE_AWS_LOCATION_KEY ?? ''
export const AWS_LOCATION_REGION = env.VITE_AWS_LOCATION_REGION || COGNITO_REGION

/** Ad-platform tracking. Each script loads only when its ID is set (GitHub variables at build time). */
export const GA4_ID = env.VITE_GA4_ID ?? '' // G-XXXXXXX
export const META_PIXEL_ID = env.VITE_META_PIXEL_ID ?? ''
export const GOOGLE_ADS_ID = env.VITE_GOOGLE_ADS_ID ?? '' // AW-XXXXXXX
export const GOOGLE_ADS_CONVERSION_LABEL = env.VITE_GOOGLE_ADS_CONVERSION_LABEL ?? ''
