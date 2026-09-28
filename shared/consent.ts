// Consent language, shared by the web app (which shows it) and the Lambda (which checks it).
//
// Two variants: when the customer gives a phone number, the consent must cover calls and texts;
// without one, it covers contact about the project only. Each variant has its own version tag,
// stored at the end of the accepted text on every lead. Change a wording → bump its version.

export const CONSENT_VERSIONS = {
  withPhone: '2026-09-v1',
  withoutPhone: '2026-09-v3',
} as const

export function consentText(brand: string, hasPhone: boolean): string {
  return hasPhone
    ? `By submitting this form, I agree that ${brand} may share the information I provide with a relevant local landscaping company for the purpose of responding to my request, and that they and ${brand} may contact me by phone, text message or email about my project. Message and data rates may apply. Consent is not a condition of purchase. [${CONSENT_VERSIONS.withPhone}]`
    : `By submitting this form, I agree that ${brand} may share the information I provide with a trusted local landscaping partner for consultation, and that they and ${brand} may contact me about my project. Consent is not a condition of purchase. [${CONSENT_VERSIONS.withoutPhone}]`
}

/** The version tag at the end of an accepted consent text, e.g. "2026-09-v1". */
export const consentVersionOf = (text: string) => /\[([^\]]+)\]\s*$/.exec(text)?.[1] ?? null

/** Consent text as shown to the customer: the version tag is for our records only. */
export const displayConsent = (text: string) => text.replace(/\s*\[[^\]]+\]\s*$/, '')

/** A phone number counts as provided once it has any digits in it. */
export const hasPhoneNumber = (phone: string | null | undefined) => /\d/.test(phone ?? '')
