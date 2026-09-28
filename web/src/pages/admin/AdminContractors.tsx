import { api } from '@/api'
import { Empty, ErrorBox, Loading, PageHeader, useAsync } from '@/components/dashboard/ui'
import { serviceLabel } from '@/lib/catalog'
import { date } from '@/lib/format'

export function AdminContractors() {
  const { data, error, loading, reload } = useAsync(() => api.listContractors())

  const toggle = async (id: string, active: boolean) => {
    await api.setContractorActive(id, active)
    await reload()
  }

  return (
    <>
      <PageHeader title="Contractors" subtitle="Companies in the network. Inactive contractors are not matched with leads." />
      {error && <ErrorBox message={error} />}
      {loading && !data ? (
        <Loading />
      ) : !data?.length ? (
        <Empty>No contractors have signed up yet.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((c) => (
            <div key={c.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-forest-900">{c.company_name}</p>
                  <p className="text-sm text-muted">
                    {c.contact_name} · {c.email} · {c.phone}
                  </p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <input type="checkbox" className="size-4 accent-forest" checked={c.active} onChange={(e) => toggle(c.id, e.target.checked)} />
                  {c.active ? 'Active' : 'Inactive'}
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {c.services.map((s) => (
                  <span key={s} className="chip bg-forest/10 text-forest">
                    {serviceLabel(s)}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">
                Serves {c.service_area.length} ZIP codes: {c.service_area.slice(0, 8).join(', ')}
                {c.service_area.length > 8 && '…'}
              </p>
              <p className="mt-1 text-xs text-muted">Joined {date(c.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
