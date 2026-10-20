#!/usr/bin/env bun
/**
 * Download spawn-map overlays and map backgrounds from the ARK Wiki and record
 * which maps each creature has in its JSON (`spawn_maps`).
 *
 * The wiki renders spawn maps as an SVG overlay ("Spawning <Creature> <Map>.svg",
 * named after the creature's page) on a topographic background, both generated
 * from ARK: Survival Evolved data by arkutils' Purlovia. ASA-only creatures have
 * no overlays. Content is CC BY-NC-SA 4.0 — the creature page credits it.
 *
 * Usage:
 *   bun scripts/download-spawn-maps.ts            # all creatures
 *   bun scripts/download-spawn-maps.ts rex dodo   # only these slugs
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { SPAWN_MAPS } from '../src/lib/spawn-maps'

const ROOT = join(import.meta.dir, '..')
const DATA_DIR = join(ROOT, 'data', 'creatures')
const MAPS_DIR = join(ROOT, 'public', 'images', 'spawn-maps', '_backgrounds')
const OVERLAY_DIR = join(ROOT, 'public', 'images', 'spawn-maps')
const WIKI_API = 'https://ark.wiki.gg/api.php'
const UA = 'Gigasaurus/1.0 (ARK wiki research; contact via GitHub)'
const DELAY_MS = 300
const BATCH = 50

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** File name → download URL for the files that exist (one API call per 50 titles). */
async function fileUrls(fileNames: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>()
  for (let i = 0; i < fileNames.length; i += BATCH) {
    const titles = fileNames.slice(i, i + BATCH).map((f) => `File:${f}`)
    const qs = new URLSearchParams({ action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'url', titles: titles.join('|') })
    const res = (await (await fetch(`${WIKI_API}?${qs}`, { headers: { 'User-Agent': UA } })).json()) as {
      query: { pages: Record<string, { title: string; imageinfo?: { url: string }[] }> }
    }
    for (const page of Object.values(res.query.pages)) {
      const url = page.imageinfo?.[0]?.url
      if (url) found.set(page.title.replace(/^File:/, ''), url)
    }
    await sleep(DELAY_MS)
  }
  return found
}

async function download(url: string, path: string) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  writeFileSync(path, new Uint8Array(await res.arrayBuffer()))
  await sleep(DELAY_MS)
}

// 1. Backgrounds (shared by every creature)
mkdirSync(MAPS_DIR, { recursive: true })
const backgrounds = await fileUrls(SPAWN_MAPS.map((m) => m.background))
for (const m of SPAWN_MAPS) {
  const path = join(MAPS_DIR, `${m.key}.jpg`)
  if (existsSync(path)) continue
  const url = backgrounds.get(m.background)
  if (!url) {
    console.warn(`  ✗ background missing on wiki: ${m.background}`)
    continue
  }
  await download(url, path)
  console.log(`  ✓ background ${m.name}`)
}

// 2. Overlays per creature, named after its wiki page title
const only = process.argv.slice(2)
const slugs = readdirSync(DATA_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -5))
  .filter((s) => !only.length || only.includes(s))

type Creature = { name: string; wiki_url?: string; spawn_maps?: string[]; [k: string]: unknown }
const creatures = new Map<string, Creature>(
  slugs.map((s) => [s, JSON.parse(readFileSync(join(DATA_DIR, `${s}.json`), 'utf-8')) as Creature]),
)
const pageTitle = (c: Creature) =>
  (c.wiki_url ? decodeURIComponent(c.wiki_url.split('/wiki/')[1] ?? '') : c.name).replace(/_/g, ' ')
const overlayName = (title: string, wikiName: string) => `Spawning ${title} ${wikiName}.svg`

const wanted = [...creatures].flatMap(([, c]) => SPAWN_MAPS.map((m) => overlayName(pageTitle(c), m.wikiName)))
console.log(`Checking ${wanted.length} possible overlays…`)
const overlays = await fileUrls(wanted)

let files = 0
let withMaps = 0
for (const [slug, c] of creatures) {
  const keys: string[] = []
  for (const m of SPAWN_MAPS) {
    const url = overlays.get(overlayName(pageTitle(c), m.wikiName))
    if (!url) continue
    const dir = join(OVERLAY_DIR, slug)
    mkdirSync(dir, { recursive: true })
    const path = join(dir, `${m.key}.svg`)
    if (!existsSync(path)) {
      await download(url, path)
      files++
    }
    keys.push(m.key)
  }
  if (keys.length) withMaps++
  if (JSON.stringify(keys) === JSON.stringify(c.spawn_maps ?? [])) continue
  const next: Creature = { ...c }
  if (keys.length) next.spawn_maps = keys
  else delete next.spawn_maps
  writeFileSync(join(DATA_DIR, `${slug}.json`), JSON.stringify(next, null, 4) + '\n')
  console.log(`  ${slug}: ${keys.length ? keys.join(', ') : 'no spawn maps'}`)
}

console.log(`\n${withMaps} of ${creatures.size} creatures have spawn maps; downloaded ${files} overlays.`)
