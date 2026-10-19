// Per-page search and social metadata. Each public page calls useSeo; the build's prerender step
// (scripts/prerender.mjs) captures the result into that page's static HTML, so crawlers and link
// previews see it without running JavaScript.
import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { SITE_URL } from '@/config/env'
import { img } from '@/content/images'

export interface Seo {
  /** Page-specific part of the title; " | DFW Lawn Pros" is appended unless it already names the brand. */
  title: string
  description?: string
  /** Pages that shouldn't appear in search results: paid-traffic landing pages, confirmations, 404s. */
  noindex?: boolean
  /** Absolute URL of the image shown in link previews. */
  image?: string
}

const BRAND = 'DFW Lawn Pros'
const DEFAULT_DESCRIPTION =
  'Get an instant lawn care quote or connect with a trusted local landscaping company in Dallas–Fort Worth. Lawn care, landscape design, sod, turf, irrigation and patios.'

/** Sets (or, with null, removes) the head element matching `selector`. */
function setHead(selector: string, create: () => HTMLElement, attr: string, value: string | null) {
  let el = document.head.querySelector<HTMLElement>(selector)
  if (value === null) {
    el?.remove()
    return
  }
  if (!el) {
    el = create()
    document.head.appendChild(el)
  }
  el.setAttribute(attr, value)
}

const meta = (name: string, content: string | null) =>
  setHead(`meta[name="${name}"]`, () => Object.assign(document.createElement('meta'), { name }), 'content', content)

const property = (name: string, content: string | null) =>
  setHead(
    `meta[property="${name}"]`,
    () => {
      const el = document.createElement('meta')
      el.setAttribute('property', name)
      return el
    },
    'content',
    content,
  )

export function useSeo({ title, description = DEFAULT_DESCRIPTION, noindex = false, image = img.hero }: Seo) {
  const { pathname } = useLocation()
  useEffect(() => {
    const fullTitle = title.includes(BRAND) ? title : `${title} | ${BRAND}`
    const url = SITE_URL + (pathname === '/' ? '/' : pathname.replace(/\/+$/, ''))
    document.title = fullTitle
    meta('description', description)
    meta('robots', noindex ? 'noindex' : null)
    setHead('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), 'href', noindex ? null : url)
    property('og:type', 'website')
    property('og:site_name', BRAND)
    property('og:title', fullTitle)
    property('og:description', description)
    property('og:url', url)
    property('og:image', image.startsWith('/') ? SITE_URL + image : image)
    meta('twitter:card', 'summary_large_image')
  }, [title, description, noindex, image, pathname])
}
