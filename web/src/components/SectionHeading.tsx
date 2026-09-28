import type { ReactNode } from 'react'

/** Numbered section heading ("01 — Portfolio") in the style of the reference site. */
export function SectionHeading({
  index,
  eyebrow,
  title,
  children,
  light = false,
  center = false,
}: {
  index?: number
  eyebrow: string
  title: ReactNode
  children?: ReactNode
  light?: boolean
  center?: boolean
}) {
  return (
    <div className={`max-w-3xl ${center ? 'mx-auto text-center' : ''}`}>
      <p className={`eyebrow ${light ? 'text-gold-soft' : ''}`}>
        {index !== undefined && <span className="mr-2 tabular-nums">{String(index).padStart(2, '0')} —</span>}
        {eyebrow}
      </p>
      <h2 className={`mt-3 text-3xl leading-tight sm:text-4xl lg:text-[2.75rem] ${light ? 'text-white' : 'text-forest-900'}`}>
        {title}
      </h2>
      {children && <div className={`mt-4 text-base leading-relaxed sm:text-lg ${light ? 'text-white/75' : 'text-muted'}`}>{children}</div>}
    </div>
  )
}
