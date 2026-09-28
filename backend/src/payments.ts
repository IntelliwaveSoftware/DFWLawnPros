// Stripe Checkout for lead purchases (optional).
//
// Without STRIPE_SECRET_KEY, purchases complete immediately (MVP / invoicing mode).
// With it, a purchase is created as `pending_payment` (reserving the exclusive lead) and the
// contractor is redirected to Stripe Checkout; the webhook completes or cancels it.
// Uses Stripe's REST API directly to keep the bundle small.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { db } from './db.js'
import { HttpError, json, type Routes } from './http.js'
import { finalizePurchase } from './purchases.js'

const STRIPE_KEY = () => process.env.STRIPE_SECRET_KEY ?? ''
const WEBHOOK_SECRET = () => process.env.STRIPE_WEBHOOK_SECRET ?? ''
const SITE_URL = () => (process.env.SITE_URL ?? 'http://localhost:5173').replace(/\/$/, '')

export const paymentsEnabled = () => Boolean(STRIPE_KEY())

export async function createCheckout(opts: {
  purchaseId: string
  leadId: string
  price: number
  email: string
  description: string
}): Promise<{ id: string; url: string }> {
  const form = new URLSearchParams({
    mode: 'payment',
    customer_email: opts.email,
    client_reference_id: opts.purchaseId,
    success_url: `${SITE_URL()}/contractor/leads/${opts.leadId}?paid=1`,
    cancel_url: `${SITE_URL()}/contractor/leads/${opts.leadId}?cancelled=1`,
    expires_at: String(Math.floor(Date.now() / 1000) + 30 * 60),
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(Math.round(opts.price * 100)),
    'line_items[0][price_data][product_data][name]': opts.description,
    'metadata[purchase_id]': opts.purchaseId,
  })
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${STRIPE_KEY()}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Stripe checkout failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as { id: string; url: string }
}

function verifySignature(payload: string, header: string): boolean {
  const parts = Object.fromEntries(
    header
      .split(',')
      .map((p) => p.split('=', 2))
      .filter((p) => p.length === 2),
  )
  const ts = Number(parts.t)
  if (!parts.v1 || !ts || Math.abs(Date.now() / 1000 - ts) > 300) return false
  const expected = createHmac('sha256', WEBHOOK_SECRET()).update(`${ts}.${payload}`).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(parts.v1)
  return a.length === b.length && timingSafeEqual(a, b)
}

interface StripeEvent {
  type: string
  data: { object: { metadata?: Record<string, string>; payment_status?: string; payment_intent?: string } }
}

export const paymentRoutes: Routes = {
  async 'POST /webhooks/stripe'(req) {
    if (!WEBHOOK_SECRET() || !verifySignature(req.rawBody, req.headers['stripe-signature'] ?? '')) {
      throw new HttpError(400, 'Invalid signature')
    }
    const event = JSON.parse(req.rawBody) as StripeEvent
    const session = event.data.object
    const purchaseId = session.metadata?.purchase_id
    if (!purchaseId) return json(200, { ignored: true })

    if (event.type === 'checkout.session.completed' && session.payment_status === 'paid') {
      const { count } = await db().leadPurchase.updateMany({
        where: { id: purchaseId, status: 'pending_payment' },
        data: { status: 'completed', purchased_at: new Date(), stripe_payment_intent_id: session.payment_intent },
      })
      if (count) {
        const p = await db().leadPurchase.findUniqueOrThrow({ where: { id: purchaseId } })
        await finalizePurchase(p.lead_id, p.contractor_id, p.price.toNumber())
      }
    } else if (['checkout.session.expired', 'checkout.session.async_payment_failed'].includes(event.type)) {
      await db().leadPurchase.updateMany({
        where: { id: purchaseId, status: 'pending_payment' },
        data: { status: 'cancelled' },
      })
    }
    return json(200, { received: true })
  },
}
