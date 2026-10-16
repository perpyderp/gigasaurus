#!/usr/bin/env bun
/**
 * scripts/scrape-creature-maps.ts
 *
 * Populates each creature's `maps` field (the maps its BASE variant spawns on)
 * by reading the wiki's spawn-region images, which are named
 * `Spawning_<Creature>_<Map>.svg`. Matching on the exact creature page title
 * excludes variant spawns (Tek/Corrupted/X/Ghost/etc.).
 *
 * Usage:
 *   bun scripts/scrape-creature-maps.ts            # all creatures missing maps
 *   bun scripts/scrape-creature-maps.ts --force    # re-scrape all
 *   bun scripts/scrape-creature-maps.ts rex dodo   # only named slugs
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dir, '..')
const DIR = join(ROOT, 'data', 'creatures')
const WIKI_API = 'https://ark.wiki.gg/api.php'
const UA = 'Gigasaurus/1.0 (ARK wiki research; contact via GitHub)'
const DELAY_MS = 400

/** Filename map-token → canonical display name. Fjordur sub-realms collapse to one. */
const MAP_TOKENS: [string, string][] = [
  ['The_Island', 'The Island'],
  ['The_Center', 'The Center'],
  ['Scorched_Earth', 'Scorched Earth'],
  ['Ragnarok', 'Ragnarok'],
  ['Aberration', 'Aberration'],
  ['Extinction', 'Extinction'],
  ['Valguero', 'Valguero'],
  ['Genesis_Part_1', 'Genesis: Part 1'],
  ['Genesis_Part_2', 'Genesis: Part 2'],
  ['Crystal_Isles', 'Crystal Isles'],
  ['Lost_Island', 'Lost Island'],
  ['Fjordur_Midgard', 'Fjordur'],
  ['Fjordur_Asgard', 'Fjordur'],
  ['Fjordur_Jotunheim', 'Fjordur'],
  ['Fjordur_Vanaheim', 'Fjordur'],
  ['Fjordur', 'Fjordur'],
  ['Astraeos', 'Astraeos'],
]

/** Canonical release order, used to present maps consistently. */
const MAP_ORDER = [
  'The Island', 'The Center', 'Scorched Earth', 'Ragnarok', 'Aberration',
  'Extinction', 'Valguero', 'Crystal Isles', 'Genesis: Part 1',
  'Genesis: Part 2', 'Lost Island', 'Fjordur', 'Astraeos',
]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchSpawnImageNames(title: string): Promise<Set<string>> {
  const url = `${WIKI_API}?action=parse&page=${encodeURIComponent(title)}&format=json&prop=text`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as { parse?: { text?: { '*': string } } }
  const html = json?.parse?.text?.['*'] ?? ''
  const names = new Set<string>()
  // e.g. ".../Spawning_Rex_The_Island.svg?8896aa" → "Rex_The_Island"
  for (const m of html.matchAll(/Spawning_([^"'?]+?)\.svg/g)) names.add(decodeURIComponent(m[1]))
  return names
}

function mapsFor(title: string, imageNames: Set<string>): string[] {
  const found = new Set<string>()
  for (const [token, canon] of MAP_TOKENS) {
    if (imageNames.has(`${title}_${token}`)) found.add(canon)
  }
  return MAP_ORDER.filter((m) => found.has(m))
}

function titleFromCreature(data: { wiki_url?: string | null; name: string }): string {
  const fromUrl = data.wiki_url?.split('/wiki/')[1]
  return fromUrl ? fromUrl : data.name.replace(/ /g, '_')
}

async function main() {
  const args = process.argv.slice(2)
  const force = args.includes('--force')
  const only = args.filter((a) => !a.startsWith('--'))

  let slugs = readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''))
  if (only.length) slugs = slugs.filter((s) => only.includes(s))

  let updated = 0
  let empty = 0
  const noMaps: string[] = []

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i]
    const path = join(DIR, `${slug}.json`)
    const data = JSON.parse(readFileSync(path, 'utf-8'))
    if (!force && Array.isArray(data.maps) && data.maps.length) continue

    const title = titleFromCreature(data)
    process.stdout.write(`  [${i + 1}/${slugs.length}] ${slug} (${title})… `)
    try {
      const imgs = await fetchSpawnImageNames(title)
      const maps = mapsFor(title, imgs)
      data.maps = maps
      writeFileSync(path, JSON.stringify(data, null, 4) + '\n')
      if (maps.length) { updated++; process.stdout.write(`${maps.length} maps\n`) }
      else { empty++; noMaps.push(slug); process.stdout.write('none\n') }
    } catch (e) {
      empty++; noMaps.push(slug)
      process.stdout.write(`ERROR ${String(e)}\n`)
    }
    await sleep(DELAY_MS)
  }

  console.log(`\nDone. ${updated} with maps, ${empty} without.`)
  if (noMaps.length) console.log(`No maps found for: ${noMaps.join(', ')}`)
}

main()
