// Portfolio of completed projects by partner companies. Stock photos are PLACEHOLDERS —
// replace with real project photography (and partner permission) before launch.
import { unsplash as u } from './images'
import type { PortfolioProject } from './site'

export const PORTFOLIO: PortfolioProject[] = [
  {
    slug: 'willow-bend',
    title: 'Willow Bend',
    city: 'Plano',
    services: ['Landscape design', 'Sod', 'Lighting'],
    summary: 'A full backyard renovation with a sweeping zoysia lawn, layered native beds and low-voltage lighting for evening entertaining.',
    cover: u('1600585154340-be6161a56a0c', 1200),
    gallery: [u('1600585154340-be6161a56a0c'), u('1558904541-efa843a96f01'), u('1585320806297-9794b3e4eeae')],
  },
  {
    slug: 'starwood',
    title: 'Starwood',
    city: 'Frisco',
    services: ['Modern landscape', 'Artificial turf'],
    summary: 'Clean-lined modern landscape with synthetic turf, ornamental grasses and a floating concrete step path.',
    cover: u('1580587771525-78b9dba3b914', 1200),
    gallery: [u('1580587771525-78b9dba3b914'), u('1512917774080-9991f1c4c750'), u('1600047509807-ba8f99d2cdde')],
  },
  {
    slug: 'tanglewood-court',
    title: 'Tanglewood Court',
    city: 'Fort Worth',
    services: ['Hardscaping', 'Walkways'],
    summary: 'Oversized concrete pavers set in turf lead from the drive to a sheltered entry courtyard.',
    cover: u('1600047509807-ba8f99d2cdde', 1200),
    gallery: [u('1600047509807-ba8f99d2cdde'), u('1628744448840-55bdb2497bd4'), u('1600563438938-a9a27216b4f5')],
  },
  {
    slug: 'craig-ranch',
    title: 'Craig Ranch',
    city: 'McKinney',
    services: ['Sod', 'Lawn care'],
    summary: 'Complete Bermuda sod replacement with soil amendment, followed by a year-round maintenance program.',
    cover: u('1598228723793-52759bba239c', 1200),
    gallery: [u('1598228723793-52759bba239c'), u('1558904541-efa843a96f01'), u('1605117882932-f9e32b03fea9')],
  },
  {
    slug: 'ridgeview',
    title: 'Ridgeview',
    city: 'Allen',
    services: ['Front yard', 'Irrigation'],
    summary: 'Restored front lawn, new sprinkler zones and a stone-edged bed along the walk.',
    cover: u('1592595896551-12b371d546d5', 1200),
    gallery: [u('1592595896551-12b371d546d5'), u('1625602812206-5ec545ca1231'), u('1558904541-efa843a96f01')],
  },
  {
    slug: 'hillcrest-modern',
    title: 'Hillcrest Modern',
    city: 'Dallas',
    services: ['Modern landscape', 'Lighting'],
    summary: 'Architectural plantings and uplighting that let a contemporary home glow after dark.',
    cover: u('1600563438938-a9a27216b4f5', 1200),
    gallery: [u('1600563438938-a9a27216b4f5'), u('1600585154340-be6161a56a0c'), u('1512917774080-9991f1c4c750')],
  },
]

export const getProject = (slug: string) => PORTFOLIO.find((p) => p.slug === slug)
