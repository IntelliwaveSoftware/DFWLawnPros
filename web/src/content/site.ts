// Marketing copy for the consumer site. Edit here — components read from this file.
// NOTE: stats and reviews below are PLACEHOLDERS. Replace them with real, verifiable
// figures and genuine customer reviews before launch (FTC rules prohibit fabricated reviews).
import type { ServiceKey } from '@/lib/types'
import { img } from './images'

export const BRAND = {
  name: 'DFW Lawn Pros',
  tagline: 'Lawn care & landscaping, matched to the right local pro.',
  region: 'Dallas–Fort Worth',
}

export const HERO = {
  eyebrow: 'Dallas–Fort Worth Lawn Care & Landscaping',
  title: 'Beautiful yards, built by vetted local pros.',
  subtitle:
    'Get an instant lawn care price in 60 seconds, or tell us about your landscaping project and we’ll connect you with a trusted DFW company that specializes in exactly that.',
}

export const STATS = [
  { value: '60 sec', label: 'Instant lawn quote' },
  { value: '9', label: 'Services covered' },
  { value: '40+', label: 'DFW cities served' },
  { value: '$0', label: 'Cost to homeowners' },
]

export interface ServiceCard {
  key: ServiceKey
  title: string
  blurb: string
  image: string
}

export const SERVICE_CARDS: ServiceCard[] = [
  { key: 'lawn_care', title: 'Lawn Care', blurb: 'Weekly mowing, edging, fertilization, weed control and aeration built for Texas heat.', image: img.lawnCare },
  { key: 'landscaping', title: 'Landscaping', blurb: 'New beds, plantings, mulch, rock and seasonal color that lift your curb appeal.', image: img.landscaping },
  { key: 'artificial_turf', title: 'Artificial Turf', blurb: 'Pet-friendly, water-wise synthetic grass and putting greens.', image: img.turf },
  { key: 'landscape_design', title: 'Landscape Design', blurb: 'A full plan for your property — installed at once or in phases.', image: img.design },
  { key: 'hardscaping', title: 'Patios & Hardscaping', blurb: 'Paver patios, walkways, retaining walls, fire pits and outdoor kitchens.', image: img.hardscape },
  { key: 'sod', title: 'Sod Installation', blurb: 'Bermuda, zoysia and St. Augustine installed with proper grading and prep.', image: img.sod },
  { key: 'irrigation', title: 'Irrigation', blurb: 'New sprinkler systems, drip lines, repairs and seasonal check-ups.', image: img.irrigation },
  { key: 'tree_shrub', title: 'Tree & Shrub Care', blurb: 'Trimming, shaping, removal, stump grinding and new plantings.', image: img.trees }
]

export const AUDIENCES = [
  {
    title: 'Residential',
    image: img.residential,
    body:
      'From a weekly mow to a full backyard build-out, we match homeowners with companies that specialize in the project — not whoever happens to answer the phone. Every request is reviewed so the right pro calls you back, fast.',
    points: ['Recurring lawn maintenance', 'Backyard renovations & patios', 'Sod, turf and irrigation'],
  },
  {
    title: 'Commercial & HOA',
    image: img.commercial,
    body:
      'Property managers and HOAs get connected with crews equipped for maintenance contracts, common-area landscaping, drainage and seasonal clean-ups across the Metroplex.',
    points: ['Maintenance contracts', 'Common areas & entrances', 'Drainage & storm clean-up'],
  },
]

export const PILLARS = [
  { title: 'Vetted local companies', body: 'We only work with established DFW landscaping companies that serve your ZIP code and offer the service you need.' },
  { title: 'Fast, honest pricing', body: 'See a lawn care estimate instantly. For bigger projects, your pro provides a detailed quote after a site visit.' },
  { title: 'Your info, respected', body: 'Your request goes to a relevant local company to respond to you — never sold to a call center or spam list.' },
]

export const PROCESS = [
  { title: 'Tell us about your yard', body: 'Get an instant lawn quote or describe your landscaping project in a couple of minutes.' },
  { title: 'We review & match', body: 'We look at your project, location and timeline and match you with a qualified local company.' },
  { title: 'Your pro reaches out', body: 'Expect a call or text — usually within one business day — to confirm details and schedule.' },
  { title: 'On-site quote', body: 'For design and install work, your pro visits to measure and provide a detailed proposal.' },
  { title: 'Enjoy your yard', body: 'Work is completed by the company you chose. We follow up to make sure it went well.' },
]

export const SERVICE_AREA = {
  intro:
    'We cover the Dallas–Fort Worth Metroplex — from the Black Land Prairie clay of Collin County to the rocky soils west of Fort Worth. Local pros know what grows (and drains) in your neighborhood.',
  cities: [
    'Dallas', 'Fort Worth', 'Plano', 'Frisco', 'McKinney', 'Allen', 'Prosper', 'Celina', 'Richardson', 'Garland',
    'Irving', 'Coppell', 'Grapevine', 'Southlake', 'Keller', 'Colleyville', 'Flower Mound', 'Lewisville', 'Carrollton',
    'Arlington', 'Mansfield', 'Rockwall', 'Rowlett', 'Wylie', 'Little Elm', 'The Colony', 'University Park', 'Highland Park',
  ],
}

// PLACEHOLDER reviews for layout only — replace with real reviews (with permission) before launch.
export const REVIEWS = [
  { name: 'Homeowner, Frisco', rating: 5, text: 'The instant quote was spot on. A crew called the next morning and started weekly mowing that Friday.' },
  { name: 'Homeowner, Dallas', rating: 5, text: 'We described our backyard patio idea and were matched with a company that clearly specializes in hardscaping. Beautiful work.' },
  { name: 'Homeowner, Plano', rating: 5, text: 'Easy process, no spam calls. Our new sod and sprinkler repair were done within two weeks.' },
]

export const FAQS = [
  {
    q: 'Is DFW Lawn Pros a landscaping company?',
    a: 'We’re a matching service. We connect Dallas–Fort Worth homeowners and property managers with independent, established local landscaping and lawn care companies. The company you’re matched with performs and warranties the work.',
  },
  {
    q: 'How accurate is the instant lawn quote?',
    a: 'The instant quote uses your measured lawn area and typical DFW pricing to give an estimated range. Your pro confirms the final price — usually on the first visit — based on terrain, obstacles and lawn condition.',
  },
  {
    q: 'Does it cost anything to request a quote?',
    a: 'No. Requesting a quote is free and there’s no obligation to hire.',
  },
  {
    q: 'Who will see my information?',
    a: 'Your details are shared only with a relevant local landscaping company so they can respond to your request. See our privacy policy for details.',
  },
  {
    q: 'What services can I get quotes for?',
    a: 'Lawn care, landscaping, landscape design, sod, artificial turf, irrigation, tree and shrub work, patios and hardscaping — plus drainage and other outdoor projects.',
  },
  {
    q: 'How quickly will someone contact me?',
    a: 'Most requests receive a call or text within one business day. Urgent needs like sprinkler leaks are often same-day.',
  },
]

export interface PortfolioProject {
  slug: string
  title: string
  city: string
  services: string[]
  summary: string
  cover: string
  gallery: string[]
}
