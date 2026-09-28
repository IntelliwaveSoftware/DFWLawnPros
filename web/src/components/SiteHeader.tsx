import { Menu, Phone, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { PHONE_HREF, PUBLIC_PHONE } from '@/config/env'
import { Logo } from './Logo'

const NAV = [
  { to: '/#services', label: 'Services' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/#process', label: 'Process' },
  { to: '/#service-area', label: 'Service Area' },
  { to: '/#faq', label: 'FAQ' },
]

export function SiteHeader() {
  const { pathname } = useLocation()
  const overHero = pathname === '/'
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => setOpen(false), [pathname])

  const transparent = overHero && !scrolled && !open
  const linkCls = transparent ? 'text-white/90 hover:text-white' : 'text-ink/80 hover:text-forest'

  return (
    <header
      className={`fixed inset-x-0 top-0 z-[1000] transition-colors ${
        transparent ? 'bg-gradient-to-b from-black/50 to-transparent' : 'border-b border-stone/60 bg-cream/95 backdrop-blur'
      }`}
    >
      <div className="container-x flex h-18 items-center justify-between gap-6 py-3">
        <Logo light={transparent} />
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={`text-sm font-medium transition-colors ${linkCls}`}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <a href={PHONE_HREF} className={`flex items-center gap-2 text-sm font-semibold ${linkCls}`}>
            <Phone className="size-4" /> {PUBLIC_PHONE}
          </a>
          <Link to="/get-quote" className={transparent ? 'btn-outline btn-sm text-white' : 'btn-ghost btn-sm'}>
            Request a Consultation
          </Link>
          <Link to="/instant-quote" className="btn-gold btn-sm">
            Instant Quote
          </Link>
        </div>
        <button
          className={`rounded-lg p-2 lg:hidden ${transparent ? 'text-white' : 'text-ink'}`}
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <div className="border-t border-stone/60 bg-cream lg:hidden">
          <nav className="container-x flex flex-col gap-1 py-4" aria-label="Mobile">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} className="rounded-lg px-2 py-2.5 font-medium hover:bg-sand" onClick={() => setOpen(false)}>
                {n.label}
              </Link>
            ))}
            <a href={PHONE_HREF} className="flex items-center gap-2 px-2 py-2.5 font-semibold text-forest">
              <Phone className="size-4" /> {PUBLIC_PHONE}
            </a>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link to="/get-quote" className="btn-outline btn-sm text-forest">
                Consultation
              </Link>
              <Link to="/instant-quote" className="btn-gold btn-sm">
                Instant Quote
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
