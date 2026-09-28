import { Link } from 'react-router'
import { BRAND } from '@/content/site'

export function Logo({ light = false, to = '/' }: { light?: boolean; to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5" aria-label={`${BRAND.name} home`}>
      <svg viewBox="0 0 32 32" className="size-9 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" fill={light ? '#f6f3ec' : '#1f3d2b'} />
        <path
          d="M8 23c0-6 4-11 12-13-2 3-3 6-3 9m-4 4c1-4 4-7 9-8"
          stroke={light ? '#1f3d2b' : '#d8c68a'}
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      <span className={`font-display text-xl leading-none font-semibold whitespace-nowrap ${light ? 'text-white' : 'text-forest'}`}>
        DFW Lawn Pros
      </span>
    </Link>
  )
}
