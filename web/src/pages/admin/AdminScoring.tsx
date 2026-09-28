import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '@/api'
import { ErrorBox, Loading, PageHeader, Panel, useAsync } from '@/components/dashboard/ui'
import type { RuleCondition, ScoringRules } from '@/lib/types'

function describe(c: RuleCondition): string {
  if ('any' in c) return c.any.map(describe).join(' OR ')
  if ('all' in c) return c.all.map(describe).join(' AND ')
  const v = Array.isArray(c.value) ? `[${c.value.join(', ')}]` : JSON.stringify(c.value)
  return c.op === 'present' ? `${c.field} is present` : `${c.field} ${c.op} ${v}`
}

export function AdminScoring() {
  const { data, error, loading, setData } = useAsync(() => api.getScoringRules())
  const [draft, setDraft] = useState<ScoringRules | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  useEffect(() => setDraft(data), [data])

  if (loading && !data) return <Loading />
  if (error) return <ErrorBox message={error} />
  if (!draft) return null

  const max = draft.rules.filter((r) => r.enabled).reduce((s, r) => s + r.points, 0)
  const dirty = JSON.stringify(draft) !== JSON.stringify(data)

  const save = async () => {
    setSaving(true)
    const next = await api.updateScoringRules(draft)
    setData(next)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <>
      <PageHeader
        title="Scoring rules"
        subtitle={`Deterministic rules, version ${draft.version}. Scores are normalized to 0–100 against ${max} possible points.`}
        actions={
          <button className="btn-primary" disabled={!dirty || saving} onClick={save}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saved ? 'Saved' : 'Save & re-score open leads'}
          </button>
        }
      />
      <Panel title="Rules">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-stone text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="py-2 pr-4 font-medium">On</th>
                <th className="py-2 pr-4 font-medium">Rule</th>
                <th className="py-2 pr-4 font-medium">Condition</th>
                <th className="py-2 pr-4 font-medium">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone/60">
              {draft.rules.map((r, i) => (
                <tr key={r.id}>
                  <td className="py-3 pr-4">
                    <input
                      type="checkbox"
                      className="size-4 accent-forest"
                      checked={r.enabled}
                      onChange={(e) =>
                        setDraft({ ...draft, rules: draft.rules.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)) })
                      }
                    />
                  </td>
                  <td className="py-3 pr-4 font-medium">{r.label}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-muted">{describe(r.condition)}</td>
                  <td className="py-3 pr-4">
                    <input
                      type="number"
                      className="input w-20 py-1.5"
                      value={r.points}
                      min={0}
                      max={100}
                      onChange={(e) =>
                        setDraft({ ...draft, rules: draft.rules.map((x, j) => (j === i ? { ...x, points: Number(e.target.value) } : x)) })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-muted">
          Conditions are defined in <code>shared/scoring-rules.json</code>; the Lambda stores the active version in the
          <code> scoring_configs</code> table. Changing points or toggling rules needs no code change.
        </p>
      </Panel>
    </>
  )
}
