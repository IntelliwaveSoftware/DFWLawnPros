import { Loader2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { api, type ContractorProfileInput } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { ErrorBox, Loading, PageHeader, Panel, useAsync } from '@/components/dashboard/ui'
import { SERVICES } from '@/lib/catalog'
import type { ServiceKey } from '@/lib/types'

export function ContractorProfile() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { data, error, loading } = useAsync(() => api.getMyProfile())
  const [form, setForm] = useState<ContractorProfileInput>({
    company_name: '',
    contact_name: user?.name ?? '',
    email: user?.email ?? '',
    phone: '',
    service_area: [],
    services: [],
  })
  const [zipText, setZipText] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (data) {
      setForm({
        company_name: data.company_name,
        contact_name: data.contact_name,
        email: data.email,
        phone: data.phone,
        service_area: data.service_area,
        services: data.services,
      })
      setZipText(data.service_area.join(', '))
    }
  }, [data])

  if (loading && !data) return <Loading />

  const toggleService = (k: ServiceKey) =>
    setForm((f) => ({ ...f, services: f.services.includes(k) ? f.services.filter((s) => s !== k) : [...f.services, k] }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const zips = [...new Set(zipText.match(/\d{5}/g) ?? [])]
    if (!form.company_name.trim()) return setMsg('Company name is required.')
    if (!form.services.length) return setMsg('Choose at least one service.')
    if (!zips.length) return setMsg('Add at least one 5-digit ZIP code.')
    setSaving(true)
    setMsg('')
    try {
      await api.saveMyProfile({ ...form, service_area: zips })
      setZipText(zips.join(', '))
      if (!data) navigate('/contractor', { replace: true })
      else setMsg('Profile saved.')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Company profile"
        subtitle={
          params.get('welcome') || !data
            ? 'Tell us about your company, what you do and where. We review every application before granting access to leads.'
            : 'Leads are matched on your service area, services offered, and active status.'
        }
      />
      {error && <ErrorBox message={error} />}
      {data && !data.approved_at && (
        <p className="mb-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Application under review.</strong> We’ll email {data.email} once your company is approved. You can keep
          your profile up to date in the meantime.
        </p>
      )}
      <form onSubmit={onSubmit} className="space-y-6">
        <Panel title="Company">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="label">Company name</span>
              <input className="input" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </label>
            <label>
              <span className="label">Contact name</span>
              <input className="input" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            </label>
            <label>
              <span className="label">Phone</span>
              <input className="input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label className="sm:col-span-2">
              <span className="label">Email for lead notifications</span>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
          </div>
        </Panel>
        <Panel title="Services offered">
          <div className="grid gap-2 sm:grid-cols-3">
            {SERVICES.map((s) => (
              <label
                key={s.key}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                  form.services.includes(s.key) ? 'border-forest bg-forest/5' : 'border-stone'
                }`}
              >
                <input type="checkbox" className="size-4 accent-forest" checked={form.services.includes(s.key)} onChange={() => toggleService(s.key)} />
                {s.label}
              </label>
            ))}
          </div>
        </Panel>
        <Panel title="Service area">
          <label>
            <span className="label">ZIP codes you serve</span>
            <textarea
              className="input min-h-24 font-mono"
              placeholder="75024, 75034, 75035, 75070…"
              value={zipText}
              onChange={(e) => setZipText(e.target.value)}
            />
            <span className="mt-1 block text-xs text-muted">Separate with commas, spaces or new lines.</span>
          </label>
          {data?.approved_at && !data.active && (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Your account is currently inactive, so you won’t be matched with new leads. Contact support to reactivate.
            </p>
          )}
        </Panel>
        {msg && <p className="text-sm text-forest">{msg}</p>}
        <button className="btn-primary" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />} {data ? 'Save profile' : 'Submit application'}
        </button>
      </form>
    </>
  )
}
