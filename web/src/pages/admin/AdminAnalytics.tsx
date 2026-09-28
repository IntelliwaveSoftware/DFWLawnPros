import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '@/api'
import { ErrorBox, Loading, PageHeader, Panel, Stat, useAsync } from '@/components/dashboard/ui'
import { serviceLabel } from '@/lib/catalog'
import { money, num, pct, titleCase } from '@/lib/format'

// Every chart here is single-series, so one hue carries it and the panel title names it.
const INK = '#2a5039'
const GRID = '#e3ddcf'
const AXIS = { fontSize: 11, fill: '#5d655f' }

function TooltipBox({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-stone bg-white px-3 py-2 text-xs shadow-lg">
      <p className="text-muted">{label}</p>
      <p className="font-semibold text-ink tabular-nums">{num(payload[0].value)}</p>
    </div>
  )
}

function HBar({ data, height = 260 }: { data: { label: string; count: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }} barCategoryGap={4}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="label" tick={AXIS} axisLine={false} tickLine={false} width={120} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: 'rgba(31,61,43,0.06)' }} />
        <Bar dataKey="count" fill={INK} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function AdminAnalytics() {
  const { data, error, loading } = useAsync(() => api.getAnalytics())
  if (loading && !data) return <Loading />
  if (error) return <ErrorBox message={error} />
  if (!data) return null
  const t = data.totals

  return (
    <>
      <PageHeader title="Analytics" subtitle="Marketplace performance across the full lead lifecycle." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Leads" value={num(t.leads)} hint={`Avg score ${t.avg_score}`} />
        <Stat label="Leads sold" value={num(t.leads_sold)} hint={`${pct(t.conversion_rate)} sell-through`} />
        <Stat label="Revenue" value={money(t.revenue)} hint={t.leads_sold ? `${money(t.revenue / t.leads_sold)} per lead` : undefined} />
        <Stat label="Jobs won" value={num(t.won_jobs)} hint={`${money(t.won_value)} reported job value`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Leads per day · last 30 days">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.by_day.map((d) => ({ label: d.date.slice(5), count: d.leads }))} margin={{ left: -16, right: 8, top: 4 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<TooltipBox />} cursor={{ fill: 'rgba(31,61,43,0.06)' }} />
              <Bar dataKey="count" fill={INK} radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Lifecycle funnel · leads reaching each stage">
          <HBar data={data.funnel.map((f) => ({ label: f.stage, count: f.count }))} />
        </Panel>
        <Panel title="Leads by service">
          <HBar data={data.by_service.map((s) => ({ label: serviceLabel(s.key), count: s.count }))} />
        </Panel>
        <Panel title="Leads by city">
          <HBar data={data.by_city.slice(0, 8).map((s) => ({ label: s.key, count: s.count }))} />
        </Panel>
        <Panel title="Leads by source">
          <HBar data={data.by_source.map((s) => ({ label: titleCase(s.key), count: s.count }))} height={200} />
        </Panel>
        <Panel title="Reported outcomes · purchased leads">
          <HBar data={data.outcomes.map((o) => ({ label: o.key, count: o.count }))} height={200} />
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Contractor activity">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-stone text-xs tracking-wide text-muted uppercase">
                <tr>
                  {['Company', 'Leads bought', 'Spend', 'Contacted', 'Won', 'Won value', 'Contact rate'].map((h) => (
                    <th key={h} className="py-2 pr-4 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone/60 tabular-nums">
                {data.contractors.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 pr-4 font-medium">{c.company_name}</td>
                    <td className="py-2.5 pr-4">{c.purchases}</td>
                    <td className="py-2.5 pr-4">{money(c.spend)}</td>
                    <td className="py-2.5 pr-4">{c.contacted}</td>
                    <td className="py-2.5 pr-4">{c.won}</td>
                    <td className="py-2.5 pr-4">{money(c.won_value)}</td>
                    <td className="py-2.5 pr-4">{c.purchases ? pct(c.contacted / c.purchases) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  )
}
