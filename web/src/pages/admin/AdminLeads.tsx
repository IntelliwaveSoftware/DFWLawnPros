import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api } from '@/api'
import { Empty, ErrorBox, Loading, PageHeader, ScoreBadge, StatusBadge, useAsync } from '@/components/dashboard/ui'
import { SERVICES, budgetLabel, serviceLabel, timeframeLabel } from '@/lib/catalog'
import { date } from '@/lib/format'
import type { LeadFilters, LeadSource, LeadStatus, ServiceKey } from '@/lib/types'

const STATUSES: LeadStatus[] = ['new', 'available', 'purchased', 'closed', 'rejected']

export function AdminLeads() {
  const [params, setParams] = useSearchParams()
  const filters: LeadFilters = {
    q: params.get('q') ?? '',
    status: (params.get('status') ?? '') as LeadStatus | '',
    service: (params.get('service') ?? '') as ServiceKey | '',
    source: (params.get('source') ?? '') as LeadSource | '',
    purchased: (params.get('purchased') ?? '') as 'yes' | 'no' | '',
    min_score: Number(params.get('min_score')) || undefined,
  }
  const [q, setQ] = useState(filters.q ?? '')
  const key = params.toString()
  const { data, error, loading } = useAsync(() => api.listLeads(filters), [key])

  const update = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  // Debounce free-text search into the URL.
  useEffect(() => {
    const t = setTimeout(() => (q !== (params.get('q') ?? '') ? update('q', q) : undefined), 300)
    return () => clearTimeout(t)
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <PageHeader title="Leads" subtitle={data ? `${data.length} matching leads` : ' '} />
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <label className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Search name, email, phone, ZIP, city…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="input" value={filters.status} onChange={(e) => update('status', e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s}
            </option>
          ))}
        </select>
        <select className="input" value={filters.service} onChange={(e) => update('service', e.target.value)} aria-label="Service">
          <option value="">All services</option>
          {SERVICES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <select className="input" value={filters.purchased} onChange={(e) => update('purchased', e.target.value)} aria-label="Purchase status">
          <option value="">Sold & unsold</option>
          <option value="yes">Sold</option>
          <option value="no">Unsold</option>
        </select>
        <select className="input" value={params.get('min_score') ?? ''} onChange={(e) => update('min_score', e.target.value)} aria-label="Minimum score">
          <option value="">Any score</option>
          <option value="40">Score 40+</option>
          <option value="60">Score 60+</option>
          <option value="80">Score 80+</option>
        </select>
      </div>

      {error && <ErrorBox message={error} />}
      {loading && !data ? (
        <Loading />
      ) : data && data.length === 0 ? (
        <Empty>No leads match these filters.</Empty>
      ) : (
        data && (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-stone text-xs tracking-wide text-muted uppercase">
                <tr>
                  {['Date', 'Lead', 'Location', 'Service', 'Budget', 'Timeframe', 'Score', 'Status', 'Purchase'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone/60">
                {data.map((l) => (
                  <tr key={l.id} className="hover:bg-sand/40">
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{date(l.created_at)}</td>
                    <td className="px-4 py-3">
                      <Link to={`/admin/leads/${l.id}`} className="font-medium text-forest hover:underline">
                        {l.name}
                      </Link>
                      <div className="text-xs text-muted">
                        {l.id} · {l.source === 'instant_quote' ? 'Instant quote' : 'Lead form'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {l.city}, {l.zip_code}
                    </td>
                    <td className="px-4 py-3">{serviceLabel(l.service)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{budgetLabel(l.budget)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{timeframeLabel(l.timeframe)}</td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={l.score} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {l.purchase ? (
                        <span className="text-ink">{l.purchase.company_name}</span>
                      ) : (
                        <span className="text-muted">Unsold</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </>
  )
}
