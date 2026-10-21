/**
 * End-to-end checks against a deployed site (production by default).
 *
 *   bun run test:e2e
 *   E2E_BASE_URL=https://<deployment>.vercel.app VERCEL_AUTOMATION_BYPASS_SECRET=… bun run test:e2e
 *
 * Runs in CI after every Vercel deployment of dev and main (.github/workflows/e2e.yml).
 * Named *.e2e.ts so plain `bun test` (unit tests, offline) skips it.
 * Covers what only breaks once deployed: request-time pages and API routes
 * can't read public/, so image URLs must come from the bundled index.
 *
 *   E2E_BASE_URL     deployment to test
 *   E2E_SITE_URL     origin canonical links and the sitemap should use. Previews build
 *                    them on the production domain, so CI sets this to production.
 *                    Defaults to E2E_BASE_URL.
 *   VERCEL_AUTOMATION_BYPASS_SECRET
 *                    gets past Vercel Deployment Protection on *.vercel.app URLs.
 */

import { describe, it, expect } from 'bun:test'

const trim = (url: string) => url.replace(/\/$/, '')
const BASE = trim(process.env.E2E_BASE_URL || 'https://gigasaurus.perp-cuison.com')
const SITE = trim(process.env.E2E_SITE_URL || BASE)
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
const TIMEOUT = 30_000

/** Accepts a path or an absolute URL (the API returns absolute image URLs). */
const get = (path: string, init?: RequestInit) =>
  fetch(new URL(path, BASE), {
    redirect: 'manual',
    ...init,
    headers: { ...(BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {}), ...init?.headers },
  })
const html = async (path: string) => {
  const res = await get(path)
  expect(res.status).toBe(200)
  return res.text()
}
/** Distinct creature image paths a page references, via next/image or directly. */
const creatureImages = (page: string) =>
  new Set([...page.matchAll(/(?:\/images\/creatures\/|images%2Fcreatures%2F)([a-z0-9_]+\.(?:webp|png|jpg|gif))/g)].map((m) => m[1]))

interface CreatureListItem { slug: string; image: string | null }

it('deployment is reachable (not blocked by Vercel Deployment Protection)', async () => {
  const res = await get('/robots.txt')
  if (res.status === 401 || (res.status >= 300 && res.status < 400 && res.headers.get('location')?.includes('vercel.com/sso'))) {
    throw new Error(`${BASE} is behind Vercel Deployment Protection; set VERCEL_AUTOMATION_BYPASS_SECRET`)
  }
  expect(res.status).toBe(200)
}, TIMEOUT)

describe(`creature images (${BASE})`, () => {
  it('API list returns an image for nearly every creature', async () => {
    const res = await get('/api/creatures?limit=1000')
    expect(res.status).toBe(200)
    const { results } = (await res.json()) as { results: CreatureListItem[] }
    const withImage = results.filter((c) => c.image)
    expect(results.length).toBeGreaterThan(200)
    // A creature or two may have no dossier on the wiki; most must have one.
    expect(withImage.length / results.length).toBeGreaterThan(0.95)
  }, TIMEOUT)

  it('API detail returns an image URL', async () => {
    const res = await get('/api/creatures/rex')
    expect(res.status).toBe(200)
    const { image } = (await res.json()) as { image: string | null }
    expect(image).not.toBeNull()
    expect(new URL(image!, BASE).pathname).toMatch(/^\/images\/creatures\/rex\.\w+$/)
  }, TIMEOUT)

  it('every image URL the API returns is served', async () => {
    const { results } = (await (await get('/api/creatures?limit=1000')).json()) as { results: CreatureListItem[] }
    const urls = results.flatMap((c) => (c.image ? [c.image] : []))
    const broken: string[] = []
    // Small batches: enough to be quick without hammering the CDN.
    for (let i = 0; i < urls.length; i += 20) {
      await Promise.all(
        urls.slice(i, i + 20).map(async (url) => {
          const res = await get(url, { method: 'HEAD' })
          if (res.status !== 200 || !res.headers.get('content-type')?.startsWith('image/')) broken.push(`${url} → ${res.status}`)
        }),
      )
    }
    expect(broken).toEqual([])
  }, 120_000)

  it('/creatures list renders creature images', async () => {
    // Rendered on request (filters live in the query string), so it's the page that breaks first.
    expect(creatureImages(await html('/creatures')).size).toBeGreaterThan(200)
  }, TIMEOUT)

  it('/creatures?q= search results render images', async () => {
    expect(creatureImages(await html('/creatures?q=rex')).size).toBeGreaterThan(0)
  }, TIMEOUT)

  it('creature page renders its image and shares it as og:image', async () => {
    const page = await html('/creatures/rex')
    expect(creatureImages(page).has('rex.webp')).toBe(true)
    expect(page).toMatch(/<meta property="og:image" content="[^"]*\/images\/creatures\/rex\.\w+"/)
  }, TIMEOUT)

  it('home page hero and featured images are served', async () => {
    const page = await html('/')
    for (const src of ['/images/ARKniversary.webp', '/images/creatures/giganotosaurus.webp']) {
      expect(page).toContain(encodeURIComponent(src))
      expect((await get(src, { method: 'HEAD' })).status).toBe(200)
    }
  }, TIMEOUT)
})

describe(`SEO and routing (${BASE})`, () => {
  it('robots.txt points at the sitemap', async () => {
    const res = await get('/robots.txt')
    expect(res.status).toBe(200)
    expect(await res.text()).toContain(`${SITE}/sitemap.xml`)
  }, TIMEOUT)

  it('sitemap lists creatures, maps and spawn pages on this origin', async () => {
    const xml = await (await get('/sitemap.xml')).text()
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    expect(locs.length).toBeGreaterThan(1500)
    expect(locs.every((l) => l.startsWith(SITE))).toBe(true)
    expect(locs).toContain(`${SITE}/creatures/rex`)
    expect(locs).toContain(`${SITE}/maps/ragnarok`)
  }, TIMEOUT)

  it('spawn pages are served with a canonical URL', async () => {
    const page = await html('/maps/the_island/rex')
    expect(page).toContain(`<link rel="canonical" href="${SITE}/maps/the_island/rex"/>`)
  }, TIMEOUT)

  it('map query-string URLs still work and canonicalise to the static page', async () => {
    const page = await html('/maps/the_island?creature=rex')
    expect(page).toContain(`<link rel="canonical" href="${SITE}/maps/the_island/rex"/>`)
  }, TIMEOUT)

  it('unknown spawn pages 404', async () => {
    expect((await get('/maps/the_island/not-a-creature')).status).toBe(404)
  }, TIMEOUT)
})
