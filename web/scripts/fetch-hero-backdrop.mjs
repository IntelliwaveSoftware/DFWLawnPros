// Downloads the landing page's metro backdrop from USGS/USDA NAIP aerial imagery (public domain) so the
// page shows satellite imagery on load without any Amazon Location requests.
//
// The image is framed exactly like the live map's opening view (BACKDROP in src/content/landing.ts):
// same center, same Web Mercator zoom, 1 CSS pixel = 1 map pixel. That lets the page load the live map
// behind it, cross-fade, and fly in without a jump. Phones get a 2x image for sharp screens; desktop stays
// at 1x to keep the page light (it sits under a dark overlay, so the difference isn't visible).
//
//   node scripts/fetch-hero-backdrop.mjs
import { writeFile } from 'node:fs/promises'

const SERVICE = 'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage'
const CENTER = { lat: 32.95, lng: -97.0 } // keep in sync with BACKDROP in src/content/landing.ts
const ZOOM = 11 // Dallas and Fort Worth both in view on a typical desktop, streets and lakes recognizable
const VARIANTS = [
  { file: 'public/images/dfw-metro-wide.jpg', width: 2560, height: 1400, scale: 1 }, // desktop, CSS px (covers 2560px monitors)
  { file: 'public/images/dfw-metro-tall.jpg', width: 780, height: 1000, scale: 2 }, // phones
]

const R = 6378137
const metresPerPx = (2 * Math.PI * R) / 256 / 2 ** ZOOM
const x = (CENTER.lng * Math.PI * R) / 180
const y = Math.log(Math.tan(Math.PI / 4 + (CENTER.lat * Math.PI) / 360)) * R

for (const v of VARIANTS) {
  const halfW = (v.width / 2) * metresPerPx
  const halfH = (v.height / 2) * metresPerPx
  const params = new URLSearchParams({
    bbox: [x - halfW, y - halfH, x + halfW, y + halfH].map((n) => n.toFixed(2)).join(','),
    bboxSR: '3857',
    imageSR: '3857',
    size: `${v.width * v.scale},${v.height * v.scale}`,
    format: 'jpg',
    compressionQuality: '50',
    f: 'image',
  })
  const res = await fetch(`${SERVICE}?${params}`)
  const type = res.headers.get('content-type') ?? ''
  if (!res.ok || !type.startsWith('image/')) throw new Error(`${v.file}: ${res.status} ${type} ${(await res.text()).slice(0, 300)}`)
  const bytes = Buffer.from(await res.arrayBuffer())
  await writeFile(new URL(`../${v.file}`, import.meta.url), bytes)
  console.log(`${v.file}  ${v.width * v.scale}x${v.height * v.scale}  ${Math.round(bytes.length / 1024)} KB`)
}
