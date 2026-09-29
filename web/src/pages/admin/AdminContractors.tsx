import { Check, Loader2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { api } from '@/api'
import { Empty, ErrorBox, Loading, PageHeader, useAsync } from '@/components/dashboard/ui'
import { serviceLabel } from '@/lib/catalog'
import { date } from '@/lib/format'
import type { Contractor } from '@/lib/types'

function ContractorCard({ c, action }: { c: Contractor; action: ReactNode }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-forest-900">{c.company_name}</p>
          <p className="text-sm text-muted">
            {c.contact_name} · {c.email}
            {c.phone && ` · ${c.phone}`}
          </p>
        </div>
        {action}
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
      <p className="mt-1 text-xs text-muted">
        Applied {date(c.created_at)}
        {c.approved_at && ` · Approved ${date(c.approved_at)}`}
      </p>
    </div>
  )
}

export function AdminContractors() {
  const { data, error, loading, reload } = useAsync(() => api.listContractors())
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  const run = async (id: string, action: () => Promise<void>) => {
    setBusy(id)
    setActionError('')
    try {
      await action()
      await reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusy(null)
    }
  }

  const applications = data?.filter((c) => !c.approved_at) ?? []
  const members = data?.filter((c) => c.approved_at) ?? []

  return (
    <>
      <PageHeader
        title="Contractors"
        subtitle="Review applications before companies can see leads. Inactive contractors are not matched with leads."
      />
      {(error || actionError) && <ErrorBox message={error ?? actionError} />}
      {loading && !data ? (
        <Loading />
      ) : !data?.length ? (
        <Empty>No companies have applied yet.</Empty>
      ) : (
        <div className="space-y-10">
          {applications.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl text-forest-900">Applications awaiting review ({applications.length})</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {applications.map((c) => (
                  <ContractorCard
                    key={c.id}
                    c={c}
                    action={
                      <button className="btn-primary btn-sm shrink-0" disabled={busy === c.id} onClick={() => run(c.id, () => api.approveContractor(c.id))}>
                        {busy === c.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                        Approve
                      </button>
                    }
                  />
                ))}
              </div>
            </section>
          )}
          <section>
            <h2 className="mb-4 text-xl text-forest-900">Network ({members.length})</h2>
            {members.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {members.map((c) => (
                  <ContractorCard
                    key={c.id}
                    c={c}
                    action={
                      <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          className="size-4 accent-forest"
                          checked={c.active}
                          disabled={busy === c.id}
                          onChange={(e) => run(c.id, () => api.setContractorActive(c.id, e.target.checked))}
                        />
                        {c.active ? 'Active' : 'Inactive'}
                      </label>
                    }
                  />
                ))}
              </div>
            ) : (
              <Empty>No approved companies yet.</Empty>
            )}
          </section>
        </div>
      )}
    </>
  )
}
