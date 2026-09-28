import { Bot, Calculator, Loader2, User } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { LeadStatus } from '@/lib/types'

/** Load data on mount / when deps change, with a manual reload. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps)
  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await run())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [run])
  useEffect(() => {
    void reload()
  }, [reload])
  return { data, error, loading, reload, setData }
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl text-forest-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-20 text-muted">
      <Loader2 className="size-6 animate-spin" />
    </div>
  )
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{message}</div>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card px-6 py-16 text-center text-sm text-muted">{children}</div>
}

const STATUS_STYLES: Record<LeadStatus, string> = {
  new: 'bg-sky-100 text-sky-800',
  available: 'bg-emerald-100 text-emerald-800',
  purchased: 'bg-amber-100 text-amber-900',
  closed: 'bg-stone-200 text-stone-700',
  rejected: 'bg-red-100 text-red-800',
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <span className={`chip capitalize ${STATUS_STYLES[status]}`}>{status}</span>
}

export function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted">—</span>
  const tone = score >= 70 ? 'bg-emerald-600' : score >= 40 ? 'bg-amber-500' : 'bg-stone-400'
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative h-1.5 w-12 overflow-hidden rounded-full bg-stone/60">
        <span className={`absolute inset-y-0 left-0 ${tone}`} style={{ width: `${score}%` }} />
      </span>
      <span className="text-sm font-semibold tabular-nums">{score}</span>
    </span>
  )
}

/** Labels where a piece of data came from, as required by the MVP spec. */
export function Provenance({ kind }: { kind: 'customer' | 'ai' | 'system' }) {
  const map = {
    customer: { icon: User, label: 'Customer-provided', cls: 'bg-sky-50 text-sky-800 ring-sky-200' },
    ai: { icon: Bot, label: 'AI-derived · not verified', cls: 'bg-violet-50 text-violet-800 ring-violet-200' },
    system: { icon: Calculator, label: 'System-calculated', cls: 'bg-stone-100 text-stone-700 ring-stone-300' },
  }[kind]
  const Icon = map.icon
  return (
    <span className={`chip gap-1 ring-1 ${map.cls}`}>
      <Icon className="size-3" /> {map.label}
    </span>
  )
}

export function Panel({ title, badge, children, actions }: { title: string; badge?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-sans text-base font-semibold text-forest-900">{title}</h2>
          {badge}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}

export function KV({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs text-muted">{k}</dt>
          <dd className="mt-0.5 text-sm break-words text-ink">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="font-display mt-2 text-3xl text-forest-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}
