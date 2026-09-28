import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { PORTFOLIO, getProject } from '@/content/portfolio'

export function PortfolioProject() {
  const { slug = '' } = useParams()
  const project = getProject(slug)
  const [lightbox, setLightbox] = useState<number | null>(null)

  useEffect(() => {
    if (lightbox === null || !project) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null)
      if (e.key === 'ArrowRight') setLightbox((i) => ((i ?? 0) + 1) % project.gallery.length)
      if (e.key === 'ArrowLeft') setLightbox((i) => ((i ?? 0) - 1 + project.gallery.length) % project.gallery.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, project])

  if (!project) return <Navigate to="/portfolio" replace />

  const idx = PORTFOLIO.indexOf(project)
  const prev = PORTFOLIO[(idx - 1 + PORTFOLIO.length) % PORTFOLIO.length]
  const next = PORTFOLIO[(idx + 1) % PORTFOLIO.length]

  return (
    <div className="bg-portfolio pt-18">
      <div className="container-x py-16 sm:py-20">
        <Link to="/portfolio" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Portfolio
        </Link>
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-end">
          <div>
            <h1 className="dashed-heading text-4xl font-normal text-ink sm:text-5xl">{project.title}</h1>
            <p className="mt-6 text-sm tracking-wide text-muted uppercase">{project.city}, Texas</p>
          </div>
          <div>
            <p className="text-lg leading-relaxed text-ink/80">{project.summary}</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {project.services.map((s) => (
                <li key={s} className="chip border border-ink/15 bg-white px-3 py-1 text-ink/80">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {project.gallery.map((src, i) => (
            <button
              key={src}
              onClick={() => setLightbox(i)}
              className={`block overflow-hidden ${i === 0 ? 'md:col-span-2' : ''}`}
              aria-label={`Open photo ${i + 1}`}
            >
              <img
                src={src}
                alt={`${project.title} photo ${i + 1}`}
                loading={i === 0 ? 'eager' : 'lazy'}
                className={`w-full object-cover transition-transform duration-700 hover:scale-[1.02] ${i === 0 ? 'aspect-[16/8]' : 'aspect-[4/3]'}`}
              />
            </button>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center gap-6 border-t border-ink/10 pt-10 text-center">
          <p className="font-display text-2xl text-ink">Want something like this at your home?</p>
          <Link to="/get-quote?service=landscape_design" className="btn-primary">
            Request a consultation
          </Link>
        </div>

        <nav className="mt-14 flex justify-between gap-4 text-sm" aria-label="Project navigation">
          <Link to={`/portfolio/${prev.slug}`} className="group flex items-center gap-2 text-muted hover:text-ink">
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" /> {prev.title}
          </Link>
          <Link to={`/portfolio/${next.slug}`} className="group flex items-center gap-2 text-muted hover:text-ink">
            {next.title} <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </nav>
      </div>

      {lightbox !== null && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute top-5 right-5 text-white/80 hover:text-white" aria-label="Close">
            <X className="size-8" />
          </button>
          <img
            src={project.gallery[lightbox].replace(/w=\d+/, 'w=2400')}
            alt={`${project.title} photo ${lightbox + 1}`}
            className="max-h-[90vh] max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
