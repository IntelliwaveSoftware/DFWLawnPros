// The quote map's opening state on the landing page: our own metro aerial image (no map requests until
// an address is entered). Once there's a target, the live map loads behind the image at exactly the same
// framing, cross-fades in when its tiles are on screen, and flies to the home; then `onArrive` hands over
// to the lawn map, which opens at the same zoom from the tiles already loaded.
import { useCallback, useState } from 'react'
import { BACKDROP } from '@/content/landing'
import { FlyInMap } from './FlyInMap'
import type { LatLng } from './geometry'

export function MapIntro({ target, onArrive }: { target: LatLng | null; onArrive: () => void }) {
  const [tilesReady, setTilesReady] = useState(false)
  const markTilesReady = useCallback(() => setTilesReady(true), [])

  return (
    <div className="absolute inset-0 overflow-hidden bg-forest-900">
      {target && (
        <div className="absolute inset-0">
          <FlyInMap
            center={BACKDROP.center}
            zoom={BACKDROP.zoom}
            to={target}
            ready={tilesReady}
            onTilesReady={markTilesReady}
            onArrive={onArrive}
          />
        </div>
      )}
      {/* One CSS pixel per map pixel, centered, so it lines up with the live map's opening view
          (widths match BACKDROP; md = Tailwind's 768px breakpoint). */}
      <picture
        className={`pointer-events-none absolute inset-0 z-[450] transition-opacity duration-[600ms] ${tilesReady ? 'opacity-0' : ''}`}
      >
        <source media="(max-width: 767px)" srcSet={BACKDROP.tall.src} />
        <img
          src={BACKDROP.wide.src}
          alt=""
          loading="lazy"
          style={{ filter: BACKDROP.filter }}
          className="absolute top-1/2 left-1/2 h-auto w-[780px] max-w-none -translate-x-1/2 -translate-y-1/2 md:w-[2560px]"
        />
      </picture>
      {target && (
        <p className="absolute inset-x-0 bottom-6 z-[460] text-center text-sm font-medium text-white drop-shadow">
          Finding your home…
        </p>
      )}
    </div>
  )
}
