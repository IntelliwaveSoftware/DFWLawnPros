import { CheckCircle2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { PHONE_HREF, PUBLIC_EMAIL, PUBLIC_PHONE } from '@/config/env'
import { BRAND } from '@/content/site'

export function ThankYou() {
  const [params] = useSearchParams()
  const ref = params.get('ref')
  return (
    <div className="container-x flex min-h-[70vh] flex-col items-center justify-center pt-28 pb-20 text-center">
      <CheckCircle2 className="size-16 text-leaf" />
      <h1 className="mt-6 text-4xl text-forest-900 sm:text-5xl">You’re all set!</h1>
      <p className="mt-4 max-w-xl text-lg text-muted">
        We’ve received your request and are matching you with a local pro. Expect a call or text — usually within one
        business day.
      </p>
      {ref && <p className="mt-4 text-sm text-muted">Reference: <span className="font-mono">{ref}</span></p>}
      <p className="mt-8 text-sm text-muted">
        Questions? Call <a className="font-semibold text-forest" href={PHONE_HREF}>{PUBLIC_PHONE}</a>
      </p>
      <Link to="/portfolio" className="btn-outline mt-8 text-forest">
        Browse our portfolio while you wait
      </Link>
    </div>
  )
}

export function Privacy() {
  return (
    <div className="container-x max-w-3xl pt-32 pb-20">
      <h1 className="text-4xl text-forest-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted">Template — have counsel review before launch.</p>
      <div className="mt-8 space-y-5 leading-relaxed text-ink/85">
        <p>
          {BRAND.name} connects consumers with independent local landscaping and lawn care companies. When you submit a
          request, we collect the information you provide (such as your name, contact details, address, and project
          details) along with basic technical and marketing attribution data.
        </p>
        <p>
          <strong>How we use it.</strong> We use your information to review and categorize your request, estimate pricing,
          and share it with a relevant local landscaping company so they can respond to you. We may use automated tools,
          including AI, to summarize your project description. We record the date and time you consented to this sharing.
        </p>
        <p>
          <strong>Who we share it with.</strong> Your request is shared with landscaping companies in our network that serve
          your area and offer the service you requested. We do not sell your information to data brokers.
        </p>
        <p>
          <strong>Your choices.</strong> To access, correct, or delete your information, or to opt out of communications,
          email <a className="text-forest underline" href={`mailto:${PUBLIC_EMAIL}`}>{PUBLIC_EMAIL}</a>. Reply STOP to any
          text message to opt out of texts.
        </p>
      </div>
    </div>
  )
}

export function NotFound() {
  return (
    <div className="container-x flex min-h-[70vh] flex-col items-center justify-center pt-28 pb-20 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 text-4xl text-forest-900">This page wandered off the path</h1>
      <Link to="/" className="btn-primary mt-8">
        Back home
      </Link>
    </div>
  )
}
