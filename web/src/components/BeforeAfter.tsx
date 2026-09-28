import { MoveHorizontal } from 'lucide-react'
import { useRef, useState, type CSSProperties } from 'react'

/** Drag-to-compare before/after slider. */
export function BeforeAfter({
  before,
  after,
  beforeStyle,
  alt,
}: {
  before: string
  after: string
  /** Optional filter for demo imagery; omit when using real before/after photos. */
  beforeStyle?: CSSProperties
  alt: string
}) {
  const [pos, setPos] = useState(50)
  const ref = useRef<HTMLDivElement>(null)

  const move = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    setPos(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)))
  }

  return (
    <div
      ref={ref}
      className="relative aspect-[16/10] w-full cursor-ew-resize touch-none overflow-hidden rounded-2xl select-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        move(e.clientX)
      }}
      onPointerMove={(e) => e.buttons === 1 && move(e.clientX)}
    >
      <img src={after} alt={`${alt} — after`} className="absolute inset-0 size-full object-cover" draggable={false} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={before} alt={`${alt} — before`} className="absolute inset-0 size-full object-cover" style={beforeStyle} draggable={false} />
      </div>
      <span className="chip absolute top-4 left-4 bg-black/60 text-white">Before</span>
      <span className="chip absolute top-4 right-4 bg-black/60 text-white">After</span>
      <div className="absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }}>
        <div className="absolute top-1/2 left-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-forest shadow-lg">
          <MoveHorizontal className="size-5" />
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        className="sr-only"
        aria-label="Compare before and after"
      />
    </div>
  )
}
