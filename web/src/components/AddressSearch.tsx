import { Loader2, MapPin, Search } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { suggestAddresses, type AddressSuggestion, type GeoResult } from '@/lib/geocode'

export function AddressSearch({
  onSelect,
  initialQuery = '',
  placeholder = 'Enter your home address',
  buttonLabel = 'Get my price',
  size = 'lg',
}: {
  onSelect: (result: GeoResult) => void
  initialQuery?: string
  placeholder?: string
  buttonLabel?: string
  size?: 'lg' | 'md'
}) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<AddressSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [error, setError] = useState('')
  const listId = useId()
  const picked = useRef(false)

  useEffect(() => {
    if (picked.current) {
      picked.current = false
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      if (query.trim().length < 4) {
        setResults([])
        return
      }
      setLoading(true)
      try {
        const r = await suggestAddresses(query, ctrl.signal)
        setResults(r)
        setActive(0)
        setOpen(true)
      } catch {
        // aborted or network error — leave previous results
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query])

  const choose = async (s: AddressSuggestion) => {
    picked.current = true
    setQuery(s.label)
    setOpen(false)
    setError('')
    setLoading(true)
    try {
      onSelect(await s.resolve())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We couldn’t look up that address. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const submit = async () => {
    if (results[active]) return choose(results[active])
    if (query.trim().length < 4) return setError('Please enter your street address.')
    setLoading(true)
    const r = await suggestAddresses(query).catch(() => [])
    setLoading(false)
    if (r[0]) await choose(r[0])
    else setError('We couldn’t find that address. Try including your city and ZIP.')
  }

  const h = size === 'lg' ? 'h-14 text-base' : 'h-12 text-sm'

  return (
    <div className="relative w-full">
      <form
        className="flex w-full gap-2 rounded-full bg-white p-1.5 shadow-xl shadow-black/10 ring-1 ring-black/5"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className="relative flex flex-1 items-center">
          <MapPin className="pointer-events-none absolute left-4 size-5 text-leaf" />
          <input
            className={`w-full rounded-full bg-transparent pr-3 pl-11 text-ink placeholder:text-muted/70 focus:outline-none ${h}`}
            value={query}
            placeholder={placeholder}
            autoComplete="street-address"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-label="Street address"
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1))
              if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
              if (e.key === 'Escape') setOpen(false)
            }}
          />
          {loading && <Loader2 className="absolute right-3 size-4 animate-spin text-muted" />}
        </div>
        <button type="submit" className={`btn-primary shrink-0 px-5 sm:px-7 ${size === 'lg' ? 'h-14' : 'h-12'}`}>
          <Search className="size-4 sm:hidden" />
          <span className="hidden sm:inline">{buttonLabel}</span>
        </button>
      </form>
      {error && <p className="mt-2 pl-4 text-sm text-red-700">{error}</p>}
      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-[1100] mt-2 overflow-hidden rounded-2xl bg-white py-1 text-left shadow-xl ring-1 ring-black/5"
        >
          {results.map((r, i) => (
            <li
              key={r.id}
              role="option"
              aria-selected={i === active}
              className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm ${i === active ? 'bg-sand' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault()
                void choose(r)
              }}
              onMouseEnter={() => setActive(i)}
            >
              <MapPin className="size-4 shrink-0 text-leaf" />
              <span className="text-ink">{r.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
