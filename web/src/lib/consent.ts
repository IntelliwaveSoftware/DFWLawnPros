import { consentText as sharedConsentText, displayConsent, hasPhoneNumber } from '@shared/consent'
import { BRAND } from '@/content/site'

export { displayConsent, hasPhoneNumber }

/**
 * Versioned consent language (wording lives in shared/consent.ts). The variant depends on whether
 * the customer gave a phone number; the exact text accepted is stored with each lead.
 */
export const consentText = (phone: string) => sharedConsentText(BRAND.name, hasPhoneNumber(phone))
