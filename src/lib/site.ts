/**
 * Site identity for metadata, sitemap and structured data. Set
 * NEXT_PUBLIC_SITE_URL to the production origin; Vercel builds fall back to
 * the project's production domain.
 */

const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? (vercelHost ? `https://${vercelHost}` : 'http://localhost:3000')
).replace(/\/$/, '')

export const SITE_NAME = 'Gigasaurus'

export const SITE_DESCRIPTION =
  'ARK: Survival Ascended companion: every creature with taming, stats and spawn maps, interactive maps for The Island, Ragnarok, Aberration and more, plus armor, weapons and resources.'

export const absoluteUrl = (path: string) => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
