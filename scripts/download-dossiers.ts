#!/usr/bin/env bun
/**
 * Replace creature images that aren't dossiers (small infobox icons the scraper
 * picked up) with the dossier from the creature's ARK Wiki page.
 *
 * Dossier file names on the wiki vary ("Dossier_Rex.png", "Gigadesmodus_Dossier.webp",
 * "Mod_AA_Acro_Dossier.png"), so this asks the wiki which images the page uses and
 * takes the one named "Dossier". Files keep their real format; run
 * `bun run names` afterwards so the creature index points at the new file.
 *
 * Wiki content is CC BY-NC-SA 4.0 (https://ark.wiki.gg).
 *
 * Usage:
 *   bun scripts/download-dossiers.ts             # every creature without a dossier
 *   bun scripts/download-dossiers.ts acrocanthosaurus malwyn
 */

import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { imageSize, looksLikeDossier } from './lib/image-size'
import { toWebp } from './lib/optimize-image'

const ROOT = join(import.meta.dir, '..')
const DATA_DIR = join(ROOT, 'data', 'creatures')
const IMG_DIR = join(ROOT, 'public', 'images', 'creatures')
const WIKI_API = 'https://ark.wiki.gg/api.php'
const UA = 'Gigasaurus/1.0 (ARK wiki research; contact via GitHub)'
const DELAY_MS = 800
const EXTS = ['png', 'jpg', 'webp'] as const

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function api(params: Record<string, string>): Promise<unknown> {
  const url = `${WIKI_API}?${new URLSearchParams({ format: 'json', ...params })}`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${res.status} for ${url}`)
  return res.json()
}

function currentImage(slug: string): { path: string; bytes: Uint8Array } | null {
  for (const ext of EXTS) {
    const path = join(IMG_DIR, `${slug}.${ext}`)
    if (existsSync(path)) return { path, bytes: new Uint8Array(readFileSync(path)) }
  }
  return null
}

/** Pick the page's dossier image: names containing "Dossier", preferring ones that mention the creature. */
function pickDossier(images: string[], name: string): string | null {
  const dossiers = images.filter((i) => /dossier/i.test(i))
  if (!dossiers.length) return null
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  const named = dossiers.find((d) => d.toLowerCase().replace(/[^a-z0-9]/g, '').includes(key))
  return named ?? dossiers[0]
}

const only = process.argv.slice(2)
const slugs = readdirSync(DATA_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -5))
  .filter((s) => !only.length || only.includes(s))

let replaced = 0
const notFound: string[] = []
for (const slug of slugs) {
  const current = currentImage(slug)
  if (!only.length && current && looksLikeDossier(imageSize(current.bytes))) continue

  const json = JSON.parse(readFileSync(join(DATA_DIR, `${slug}.json`), 'utf-8')) as { name: string; wiki_url?: string }
  const title = json.wiki_url ? decodeURIComponent(json.wiki_url.split('/wiki/')[1] ?? '') : json.name
  process.stdout.write(`  ${slug} (${title}) … `)

  try {
    const parsed = (await api({ action: 'parse', page: title, prop: 'images', redirects: '1' })) as { parse?: { images: string[] } }
    await sleep(DELAY_MS)
    const file = pickDossier(parsed.parse?.images ?? [], json.name)
    if (!file) {
      process.stdout.write('no dossier on the wiki page\n')
      notFound.push(slug)
      continue
    }
    const info = (await api({ action: 'query', titles: `File:${file}`, prop: 'imageinfo', iiprop: 'url' })) as {
      query: { pages: Record<string, { imageinfo?: { url: string }[] }> }
    }
    await sleep(DELAY_MS)
    const url = Object.values(info.query.pages)[0]?.imageinfo?.[0]?.url
    if (!url) throw new Error('no file URL')
    const bytes = new Uint8Array(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer())
    const size = imageSize(bytes)
    if (!size || !looksLikeDossier(size)) {
      process.stdout.write(`skipped: ${file} isn't dossier-shaped (${size ? `${size.width}×${size.height}` : 'unknown'})\n`)
      notFound.push(slug)
      continue
    }
    for (const ext of EXTS) {
      const p = join(IMG_DIR, `${slug}.${ext}`)
      if (existsSync(p)) unlinkSync(p)
    }
    // Stored as ≤1600px WebP: the 4000px wiki originals are ~3 MB each and never shown that large.
    writeFileSync(join(IMG_DIR, `${slug}.webp`), await toWebp(bytes))
    replaced++
    process.stdout.write(`\x1b[32m✓\x1b[0m ${file} ${size.width}×${size.height}\n`)
    await sleep(DELAY_MS)
  } catch (err) {
    process.stdout.write(`\x1b[31m✗\x1b[0m ${err instanceof Error ? err.message : err}\n`)
    notFound.push(slug)
  }
}

console.log(`\nReplaced ${replaced}. Still without a dossier: ${notFound.length ? notFound.join(', ') : 'none'}`)
