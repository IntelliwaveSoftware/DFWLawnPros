// Site photography: Unsplash and Pexels (free licenses) plus our own files in src/assets/Images. Replace stock photos with real project photos before launch.
import yardAfter from '@/assets/Images/after-1600.webp'
import yardBefore from '@/assets/Images/before-1600.webp'
import dfwNeighborhood from '@/assets/Images/dfw-neighborhood-1200.webp'
import artificialTurf from '@/assets/Images/artificial-turf.jpeg'
import shrubTrimming from '@/assets/Images/shrub_trimming-1200.webp'

const u = (id: string, w = 1600) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75`
// Pexels (free license): https://www.pexels.com/photo/<slug>-<id>/
const pexels = (id: number, w = 1200) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`

export const img = {
  hero: u('1600585154340-be6161a56a0c', 2200),
  lawnCare: u('1605117882932-f9e32b03fea9', 1200),
  lawnCloseup: u('1558904541-efa843a96f01', 1600),
  landscaping: u('1729552867938-05ecfcb3cce6', 1200),
  design: u('1600047509807-ba8f99d2cdde', 1200),
  sod: pexels(5231236),
  turf: artificialTurf,
  irrigation: pexels(32974053),
  trees: shrubTrimming,
  hardscape: u('1617850687395-620757feb1f3', 1200),
  planting: u('1622383563227-04401ab4e5ea', 1200),
  soil: u('1611843467160-25afb8df1074', 1200),
  residential: u('1598228723793-52759bba239c', 1400),
  commercial: dfwNeighborhood,
  frontYard: u('1625602812206-5ec545ca1231', 1600),
  // A real before/after pair (same framing), used by the home page slider and the Fort Worth project.
  yardBefore,
  yardAfter,
}

export const unsplash = u
