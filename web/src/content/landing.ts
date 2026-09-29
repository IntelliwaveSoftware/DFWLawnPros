// Ad landing page (/lawn-quote) variants. Ads link with ?service=…&city=… so the headline matches the ad
// (e.g. /lawn-quote?service=artificial-turf&city=frisco). Unknown values fall back to the generic page.

/**
 * The hero's metro backdrop: our own NAIP aerial image (public domain, see scripts/fetch-hero-backdrop.mjs),
 * framed exactly like the live map's opening view so the page can cross-fade into it and fly to the
 * customer's home. `width` is the image's CSS width at this zoom; change these only together with the script.
 */
export const BACKDROP = {
  center: [32.95, -97.0] as [number, number],
  zoom: 10,
  wide: { src: '/images/dfw-metro-wide.jpg', width: 1920 },
  tall: { src: '/images/dfw-metro-tall.jpg', width: 780 },
  /** Color correction so the aerial image's tone matches the live satellite tiles it cross-fades into. */
  filter: 'saturate(1.35) contrast(1.12) brightness(0.88)',
}

export const LANDING_CITIES = [
  'Dallas', 'Fort Worth', 'Plano', 'Frisco', 'McKinney', 'Allen', 'Prosper', 'Celina', 'Richardson', 'Garland',
]

export type LandingService = 'lawn_care' | 'artificial_turf' | 'landscaping'

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

const SERVICE_ALIASES: Record<string, LandingService> = {
  lawncare: 'lawn_care',
  lawn: 'lawn_care',
  mowing: 'lawn_care',
  artificialturf: 'artificial_turf',
  turf: 'artificial_turf',
  syntheticturf: 'artificial_turf',
  landscaping: 'landscaping',
  landscape: 'landscaping',
}

export const resolveService = (param: string | null): LandingService | undefined => SERVICE_ALIASES[slug(param ?? '')]
export const resolveCity = (param: string | null): string | undefined =>
  LANDING_CITIES.find((c) => slug(c) === slug(param ?? '') && slug(c) !== '')

export interface LandingCopy {
  eyebrow: string
  title: (where: string) => string
  subtitle: string
  /** Instant-quote items to pre-select. Absent for landscaping, which goes to the project form. */
  quoteItems?: Record<string, string>
  steps: [string, string][]
}

export const LANDING_COPY: Record<LandingService, LandingCopy> = {
  lawn_care: {
    eyebrow: 'Instant lawn care quote',
    title: (where) => `Lawn care prices in ${where}, in 60 seconds`,
    subtitle:
      'Mowing, fertilization and aeration priced for your exact yard. Outline it on the satellite map and see your price instantly — no phone tag.',
    quoteItems: { mowing: 'weekly' },
    steps: [
      ['Enter your address', 'We pull up a satellite view of your home.'],
      ['Outline your lawn', 'Trace your grass on the map — we measure the square footage.'],
      ['See your price', 'Pick your services and get an instant estimate from vetted local pros.'],
    ],
  },
  artificial_turf: {
    eyebrow: 'Instant artificial turf quote',
    title: (where) => `Artificial turf cost in ${where}, in 60 seconds`,
    subtitle:
      'See installed turf pricing for your yard. Outline the area on the satellite map and get an instant estimate from vetted local installers.',
    quoteItems: { artificial_turf: '' },
    steps: [
      ['Enter your address', 'We pull up a satellite view of your home.'],
      ['Outline the area', 'Trace where you want turf — we measure the square footage.'],
      ['See your price', 'Get an instant installed-price range from vetted local pros.'],
    ],
  },
  landscaping: {
    eyebrow: 'Free landscaping estimate',
    title: (where) => `Landscaping in ${where}, by vetted local pros`,
    subtitle:
      'Tell us about your project in two minutes. A vetted local landscaper follows up with a free on-site estimate — no bidding war, no spam calls.',
    steps: [
      ['Tell us about your project', 'Beds, planting, a full yard makeover — a few quick questions.'],
      ['We match one vetted pro', 'A local company that specializes in your kind of project.'],
      ['Get a free on-site estimate', 'They visit, measure and give you a firm price.'],
    ],
  },
}

export const LANDING_FAQ: [string, string][] = [
  ['Is the instant price accurate?', 'It’s based on your measured lawn and typical DFW rates. Your pro confirms the final price on the first visit — it’s free and there’s no obligation.'],
  ['Who will contact me?', 'One vetted local company that serves your area. We review every company before it joins, and your request isn’t auctioned to a crowd of contractors.'],
  ['Do I need to be home?', 'Not to get your price. For installs like turf or landscaping, the pro schedules a quick on-site visit at a time that suits you.'],
  ['What does it cost to use?', 'Nothing. Getting a quote is free for homeowners.'],
]
