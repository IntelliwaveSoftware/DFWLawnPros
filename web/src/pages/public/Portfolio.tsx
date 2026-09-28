import { Link } from 'react-router'
import { PORTFOLIO } from '@/content/portfolio'

// Styled after bonicklandscaping.com/portfolio: grey page, dashed heading,
// three-column grid of tall image tiles with the project name beneath.
export function Portfolio() {
  return (
    <div className="bg-portfolio pt-18">
      <div className="container-x py-16 sm:py-20">
        <h1 className="dashed-heading text-4xl font-normal text-ink sm:text-5xl">Landscape Design Portfolio</h1>
        <p className="mt-6 max-w-2xl text-muted">
          A selection of residential projects completed by landscaping companies in the DFW Lawn Pros network.
        </p>
        <div className="mt-12 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {PORTFOLIO.map((p) => (
            <Link key={p.slug} to={`/portfolio/${p.slug}`} className="group block">
              <span
                className="block h-[60vh] min-h-[430px] w-full bg-cover bg-center transition-opacity duration-500 group-hover:opacity-85"
                style={{ backgroundImage: `url('${p.cover}')` }}
                role="img"
                aria-label={p.title}
              />
              <h4 className="font-display mt-4 text-xl text-ink">{p.title}</h4>
              <p className="mt-0.5 text-sm text-muted">{p.city}, TX</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
