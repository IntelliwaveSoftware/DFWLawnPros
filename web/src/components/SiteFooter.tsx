import { Link } from 'react-router'
import { PHONE_HREF, PUBLIC_EMAIL, PUBLIC_PHONE } from '@/config/env'
import { BRAND, SERVICE_AREA, SERVICE_CARDS } from '@/content/site'
import { Logo } from './Logo'

export function SiteFooter() {
  return (
    <footer className="bg-forest-900 text-white/75">
      <div className="container-x grid gap-10 py-16 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Logo light />
          <p className="text-sm leading-relaxed">{BRAND.tagline}</p>
          <p className="text-sm">
            <a href={PHONE_HREF} className="font-semibold text-white hover:text-gold-soft">
              {PUBLIC_PHONE}
            </a>
            <br />
            <a href={`mailto:${PUBLIC_EMAIL}`} className="hover:text-white">
              {PUBLIC_EMAIL}
            </a>
          </p>
          <p className="text-xs text-white/50">Mon–Fri 7am–7pm · Sat 8am–5pm</p>
        </div>
        <div>
          <h3 className="mb-4 font-sans text-sm font-semibold tracking-wide text-white uppercase">Services</h3>
          <ul className="space-y-2 text-sm">
            {SERVICE_CARDS.map((s) => (
              <li key={s.key}>
                <Link to={`/get-quote?service=${s.key}`} className="hover:text-white">
                  {s.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-4 font-sans text-sm font-semibold tracking-wide text-white uppercase">Service Area</h3>
          <p className="text-sm leading-relaxed">{SERVICE_AREA.cities.slice(0, 14).join(' · ')} and more.</p>
        </div>
        <div>
          <h3 className="mb-4 font-sans text-sm font-semibold tracking-wide text-white uppercase">For Landscaping Companies</h3>
          <p className="mb-4 text-sm leading-relaxed">
            Get exclusive, pre-qualified lawn care and landscaping leads in the ZIP codes you serve.
          </p>
          <div className="flex flex-col items-start gap-2 text-sm">
            <Link to="/contractor/signup" className="btn-gold btn-sm">
              Join the network
            </Link>
            <Link to="/login?role=contractor" className="hover:text-white">
              Contractor login
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col items-center justify-between gap-3 py-6 text-xs text-white/50 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {BRAND.name}. {BRAND.name} connects consumers with independent local service providers.
          </p>
          <div className="flex gap-5">
            <Link to="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link to="/login?role=admin" className="hover:text-white">
              Admin
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
