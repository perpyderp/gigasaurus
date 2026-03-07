#!/usr/bin/env bun
/**
 * scripts/scrape.ts — Interactive ARK: Survival Evolved wiki scraper
 *
 * Usage:  bun scripts/scrape.ts
 *
 * Scraped data is saved to:
 *   data/{type}/{slug}.json                    — complete, schema-valid entries
 *   data/{type}/incomplete/{slug}.json          — entries with missing required fields
 *   data/{type}/incomplete/{slug}__missing.txt  — notes on what needs manual work
 *
 * Images are saved to:
 *   public/images/{type}/{slug}.png
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { parse as parseHtml, type HTMLElement } from 'node-html-parser'
import { createInterface } from 'readline'
import { z } from 'zod'
import { CreatureSchema } from '../src/schemas/creature'
import { ArmorSchema } from '../src/schemas/armor'
import { ResourceSchema } from '../src/schemas/resource'
import { WeaponSchema } from '../src/schemas/weapon'

// ─── Constants ─────────────────────────────────────────────────────────────────

const WIKI = 'https://ark.wiki.gg'
const ROOT = join(import.meta.dir, '..')
const DELAY_MS = 900

// ─── CLI helpers ───────────────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, output: process.stdout })

function ask(question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve))
}

async function confirm(question: string): Promise<boolean> {
  const answer = await ask(`${question} [y/N] `)
  return answer.trim().toLowerCase() === 'y'
}

function log(msg: string) { process.stdout.write(msg + '\n') }
function info(msg: string) { log(`  ${msg}`) }
function ok(msg: string) { log(`  \x1b[32m✓\x1b[0m ${msg}`) }
function warn(msg: string) { log(`  \x1b[33m⚠\x1b[0m ${msg}`) }
function err(msg: string) { log(`  \x1b[31m✗\x1b[0m ${msg}`) }

// ─── Rate-limited fetch ────────────────────────────────────────────────────────

let lastFetch = 0

async function fetchHtml(url: string): Promise<HTMLElement | null> {
  const now = Date.now()
  const wait = Math.max(0, DELAY_MS - (now - lastFetch))
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastFetch = Date.now()

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Gigasaurus/1.0 (ARK wiki research tool; contact via GitHub)' },
    })
    if (!res.ok) {
      warn(`HTTP ${res.status} for ${url}`)
      return null
    }
    const html = await res.text()
    return parseHtml(html)
  } catch (e) {
    warn(`Fetch failed for ${url}: ${e}`)
    return null
  }
}

async function fetchBytes(url: string): Promise<ArrayBuffer | null> {
  const now = Date.now()
  const wait = Math.max(0, DELAY_MS - (now - lastFetch))
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastFetch = Date.now()

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Gigasaurus/1.0 (ARK wiki research tool)' },
    })
    if (!res.ok) return null
    return res.arrayBuffer()
  } catch {
    return null
  }
}

// ─── Filesystem helpers ────────────────────────────────────────────────────────

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function dataDir(type: string) { return join(ROOT, 'data', type) }
function incompleteDir(type: string) { return join(ROOT, 'data', type, 'incomplete') }
function imageDir(type: string) { return join(ROOT, 'public', 'images', type) }

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

// ─── Image download ────────────────────────────────────────────────────────────

/** Extract highest-quality image URL from a wiki thumbnail src. */
function resolveImageUrl(src: string): string {
  // Convert relative to absolute
  if (src.startsWith('//')) src = 'https:' + src
  if (src.startsWith('/')) src = WIKI + src
  // Strip thumbnail scaling: /thumb/a/b/Foo.png/200px-Foo.png → /a/b/Foo.png
  const thumbMatch = src.match(/\/thumb(\/[a-f0-9]\/[a-f0-9a-f]+\/[^/]+\.[a-z]+)/)
  if (thumbMatch) {
    src = WIKI + '/images' + thumbMatch[1]
  }
  return src
}

function extractFirstImageUrl(root: HTMLElement): string | null {
  // Try infobox image first
  for (const sel of ['.infobox img', '.portable-infobox img', 'table.wikitable img', '.thumb img', 'img']) {
    const img = root.querySelector(sel)
    if (img) {
      const src = img.getAttribute('src') || img.getAttribute('data-src') || ''
      if (src && !src.includes('wiki.png') && !src.includes('Question_mark')) {
        return resolveImageUrl(src)
      }
    }
  }
  return null
}

async function downloadImage(type: string, slug: string, imageUrl: string): Promise<boolean> {
  const dir = imageDir(type)
  ensureDir(dir)
  const ext = imageUrl.split('?')[0].split('.').pop() ?? 'png'
  const dest = join(dir, `${slug}.${ext}`)
  if (existsSync(dest)) return true // already have it
  const buf = await fetchBytes(imageUrl)
  if (!buf) return false
  writeFileSync(dest, Buffer.from(buf))
  return true
}

// ─── Data persistence ──────────────────────────────────────────────────────────

interface SaveReport {
  slug: string
  complete: boolean
  missing: string[]
  skipped: boolean
}

function saveEntity(
  type: string,
  entitySlug: string,
  data: Record<string, unknown>,
  missing: string[],
  overwrite: boolean,
): SaveReport {
  const complete = missing.length === 0
  const dir = complete ? dataDir(type) : incompleteDir(type)
  ensureDir(dir)

  const filePath = join(dir, `${entitySlug}.json`)
  if (existsSync(filePath) && !overwrite) {
    return { slug: entitySlug, complete, missing, skipped: true }
  }

  writeFileSync(filePath, JSON.stringify(data, null, 4) + '\n')

  if (!complete) {
    const notesPath = join(dir, `${entitySlug}__missing.txt`)
    const lines = [
      `Incomplete data for: ${entitySlug}`,
      `Scraped: ${new Date().toISOString()}`,
      `Source: ${WIKI}/wiki/${encodeURIComponent(entitySlug.replace(/_/g, ' '))}`,
      '',
      'Fields requiring manual population:',
      ...missing.map(f => `  - ${f}`),
      '',
      `When complete, move file to: data/${type}/${entitySlug}.json`,
    ]
    writeFileSync(notesPath, lines.join('\n') + '\n')
  }

  return { slug: entitySlug, complete, missing, skipped: false }
}

// ─── HTML parsing utilities ────────────────────────────────────────────────────

function cleanText(el: HTMLElement | null): string {
  if (!el) return ''
  return el.text.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim()
}

/** Get all label→value pairs from a MediaWiki infobox (th→td rows). */
function parseInfobox(root: HTMLElement): Record<string, string> {
  const result: Record<string, string> = {}
  // ARK wiki uses aside.portable-infobox or table.infobox
  const containers = root.querySelectorAll('aside, .infobox, table.wikitable')
  for (const container of containers) {
    for (const row of container.querySelectorAll('tr, .pi-item')) {
      const th = row.querySelector('th, .pi-data-label')
      const td = row.querySelector('td, .pi-data-value')
      if (th && td) {
        const key = cleanText(th).toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
        const val = cleanText(td)
        if (key && val) result[key] = val
      }
    }
  }
  return result
}

function parseBool(v: string | undefined): boolean {
  if (!v) return false
  return /^(yes|true|✓|1)$/i.test(v.trim())
}

function parseNum(v: string | undefined): number | null {
  if (!v) return null
  const n = parseFloat(v.replace(/,/g, '').replace(/[^\d.-]/g, ''))
  return isNaN(n) ? null : n
}

function parseIntNum(v: string | undefined): number | null {
  if (!v) return null
  const n = parseInt(v.replace(/,/g, '').replace(/[^\d-]/g, ''), 10)
  return isNaN(n) ? null : n
}

// ─── Creature scraper ──────────────────────────────────────────────────────────

interface CreatureEntry { name: string; slug: string; wikiPath: string }

async function fetchCreatureList(): Promise<CreatureEntry[]> {
  info('Fetching creature list from wiki…')
  const root = await fetchHtml(`${WIKI}/wiki/Creatures`)
  if (!root) return []

  const entries: CreatureEntry[] = []
  const seen = new Set<string>()

  // The creatures page has a wikitable with links to each creature
  for (const link of root.querySelectorAll('.wikitable a, #content a')) {
    const href = link.getAttribute('href') ?? ''
    const title = link.getAttribute('title') ?? link.text.trim()
    if (!href.startsWith('/wiki/') || href.includes(':') || href.includes('#')) continue
    if (!title || seen.has(href)) continue
    // Filter out navigation/category links
    if (/^(Creatures|Category|Template|Help|ARK|DLC|Mod)/i.test(title)) continue
    seen.add(href)
    const slug = slugify(title)
    if (slug) entries.push({ name: title, slug, wikiPath: href })
  }

  return entries
}

const CREATURE_CATEGORY_MAP: Record<string, string> = {
  dinosaur: 'dinosaur', dinosaurs: 'dinosaur',
  bird: 'bird', birds: 'bird',
  fish: 'fish',
  invertebrate: 'invertebrate', invertebrates: 'invertebrate', invertebrate_: 'invertebrate',
  mammal: 'mammal', mammals: 'mammal',
  reptile: 'reptile', reptiles: 'reptile',
  fantasy: 'fantasy',
  boss: 'other', bosses: 'other',
}

function inferCategory(root: HTMLElement, infobox: Record<string, string>): string {
  // Try categories section at bottom of page
  const catLinks = root.querySelectorAll('#mw-normal-catlinks a, .catlinks a')
  for (const link of catLinks) {
    const text = link.text.trim().toLowerCase().replace(/\s+/g, '_')
    if (CREATURE_CATEGORY_MAP[text]) return CREATURE_CATEGORY_MAP[text]
  }
  // Try infobox
  const group = (infobox['group'] || infobox['creature_type'] || '').toLowerCase()
  if (CREATURE_CATEGORY_MAP[group]) return CREATURE_CATEGORY_MAP[group]
  return 'other'
}

function parseCreatureStats(root: HTMLElement): Record<string, { base: number | null; level_increase?: { wild?: number; tamed?: number } }> {
  const defaultStats = {
    health:    { base: null as number | null },
    stamina:   { base: null as number | null },
    oxygen:    { base: null as number | null },
    food:      { base: null as number | null },
    weight:    { base: null as number | null },
    melee:     { base: null as number | null },
    movement:  { base: null as number | null },
    torpidity: { base: null as number | null },
  }

  // ARK wiki stat tables have a specific structure
  // Look for the stats table (usually has headers like Health, Stamina, etc.)
  const statLabels: Record<string, keyof typeof defaultStats> = {
    health: 'health', hp: 'health',
    stamina: 'stamina',
    oxygen: 'oxygen',
    food: 'food',
    weight: 'weight',
    'melee damage': 'melee', melee: 'melee', damage: 'melee',
    'movement speed': 'movement', movement: 'movement', speed: 'movement',
    torpidity: 'torpidity', torpor: 'torpidity',
  }

  for (const table of root.querySelectorAll('table.wikitable, table')) {
    const headers: string[] = []
    const headerRow = table.querySelector('tr')
    if (!headerRow) continue
    for (const th of headerRow.querySelectorAll('th, td')) {
      headers.push(cleanText(th).toLowerCase())
    }
    // Check if this looks like a stats table
    const hasStatCols = headers.some(h => statLabels[h] !== undefined)
    if (!hasStatCols) continue

    // Parse each data row
    for (const row of table.querySelectorAll('tr:not(:first-child)')) {
      const cells = row.querySelectorAll('td, th')
      if (cells.length < 2) continue
      const rowLabel = cleanText(cells[0]).toLowerCase()
      const statKey = statLabels[rowLabel]
      if (!statKey) continue

      const base = parseNum(cleanText(cells[1]))
      const wildInc = cells[2] ? parseNum(cleanText(cells[2])) : null
      const tamedInc = cells[3] ? parseNum(cleanText(cells[3])) : null

      defaultStats[statKey] = {
        base,
        ...(wildInc !== null || tamedInc !== null ? {
          level_increase: {
            ...(wildInc !== null ? { wild: wildInc } : {}),
            ...(tamedInc !== null ? { tamed: tamedInc } : {}),
          }
        } : {}),
      }
    }
    break // use the first matching table
  }

  return defaultStats
}

async function parseCreaturePage(entry: CreatureEntry): Promise<{ data: Record<string, unknown>; missing: string[] }> {
  const root = await fetchHtml(WIKI + entry.wikiPath)
  const missing: string[] = []

  if (!root) {
    return {
      data: {
        name: entry.name,
        category: 'other',
        dossier: null,
        base_stats_growth: {
          health: { base: null }, stamina: { base: null }, oxygen: { base: null },
          food: { base: null }, weight: { base: null }, melee: { base: null },
          movement: { base: null }, torpidity: { base: null },
        },
        tameable: false, rideable: false, breedable: false,
        taming: null, saddle: null, rider_weaponry: false,
        egg: null, drag_weight: null, cloneable: null, entity_id: null,
      },
      missing: ['ALL (page fetch failed — manual population required)'],
    }
  }

  const infobox = parseInfobox(root)

  // ── Dossier ──────────────────────────────────────────────────────────────────
  const species = infobox['species'] || infobox['binomial'] || null
  const timePeriod = infobox['time_period'] || infobox['period'] || infobox['time'] || null
  const diet = infobox['diet'] || null
  const temperament = infobox['temperament'] || infobox['behavior'] || null

  // Wild/domesticated dossier text
  let wildText: string | null = null
  let domesticatedText: string | null = null
  const dossierSection = root.querySelector('#Dossier, #dossier, [id*="dossier" i]')
  if (dossierSection) {
    const paras = dossierSection.querySelectorAll('p')
    if (paras[0]) wildText = cleanText(paras[0])
    if (paras[1]) domesticatedText = cleanText(paras[1])
  }
  // Fallback: first two substantial paragraphs in main content
  if (!wildText) {
    const paras = root.querySelectorAll('#mw-content-text > div > p, .mw-parser-output > p')
    const substantial = Array.from(paras).filter(p => p.text.trim().length > 80)
    if (substantial[0]) wildText = cleanText(substantial[0])
    if (substantial[1]) domesticatedText = cleanText(substantial[1])
  }

  const hasDossier = species && timePeriod && diet && temperament && wildText && domesticatedText
  if (!hasDossier) {
    if (!species) missing.push('dossier.species')
    if (!timePeriod) missing.push('dossier.time')
    if (!diet) missing.push('dossier.diet')
    if (!temperament) missing.push('dossier.temperament')
    if (!wildText) missing.push('dossier.wild')
    if (!domesticatedText) missing.push('dossier.domesticated')
  }

  const dossier = hasDossier ? {
    species: species!,
    time: timePeriod!,
    diet: diet!,
    temperament: temperament!,
    wild: wildText!,
    domesticated: domesticatedText!,
  } : null

  // ── Flags ─────────────────────────────────────────────────────────────────────
  const tameable = parseBool(infobox['tameable'] || infobox['taming'])
  const rideable = parseBool(infobox['rideable'] || infobox['ridable'])
  const breedable = parseBool(infobox['breedable'] || infobox['breeding'])

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const stats = parseCreatureStats(root)
  const hasAnyStats = Object.values(stats).some(s => s.base !== null)
  if (!hasAnyStats) {
    missing.push('base_stats_growth (all stats need manual population)')
  }

  // ── Taming ────────────────────────────────────────────────────────────────────
  let tamingMethod: string | null = null
  let tamingKibble: string | null = null
  const tamingSection = root.querySelector('#Taming, #taming, [id*="taming" i]')
  if (tamingSection) {
    const text = tamingSection.text
    if (/knockout/i.test(text)) tamingMethod = 'Knockout'
    else if (/passive/i.test(text)) tamingMethod = 'Passive'
    else if (/trap/i.test(text)) tamingMethod = 'Trap'

    const kibbleMatch = text.match(/(\w+)\s+kibble/i)
    if (kibbleMatch) tamingKibble = kibbleMatch[1]
  }
  const taming = tameable ? { method: tamingMethod, kibble: tamingKibble } : null
  if (tameable && !tamingMethod) missing.push('taming.method')

  // ── Saddle ────────────────────────────────────────────────────────────────────
  let saddle: Array<{ name: string | null; engram_level: number | null }> | null = null
  if (rideable) {
    const saddleName = infobox['saddle'] || null
    const saddleLevel = parseIntNum(infobox['saddle_level'] || infobox['saddle_engram'])
    if (saddleName) {
      saddle = [{ name: saddleName, engram_level: saddleLevel }]
    } else {
      // Try to find saddle in text
      const saddleMatch = root.text.match(/([A-Z][a-zA-Z\s]+Saddle)/g)
      if (saddleMatch) {
        saddle = saddleMatch.slice(0, 2).map(n => ({ name: n.trim(), engram_level: null }))
        if (!saddleMatch.some(s => s.includes('Tek'))) missing.push('saddle[].engram_level')
      } else {
        missing.push('saddle (name and engram_level)')
      }
    }
  }

  // ── Technical ─────────────────────────────────────────────────────────────────
  const entityId = infobox['entity_id'] || infobox['blueprint'] || null
  const dragWeight = parseNum(infobox['drag_weight'] || infobox['weight_for_unconscious'])
  const cloneable = parseBool(infobox['cloneable'])

  if (!entityId) missing.push('entity_id')

  // ── Category ──────────────────────────────────────────────────────────────────
  const category = inferCategory(root, infobox)

  // ── Egg / Breeding ────────────────────────────────────────────────────────────
  let egg: Record<string, unknown> | null = null
  if (breedable) {
    const breedSection = root.querySelector('#Breeding, #breeding, [id*="breed" i]')
    if (breedSection) {
      const text = breedSection.text
      const eggName = text.match(/([A-Z][a-zA-Z\s]+Egg)/)?.[1]?.trim() ?? null
      const tempRange = text.match(/(\d+\s*[–-]\s*\d+\s*°[CF][^,\n]*)/)?.[1]?.trim() ?? null
      const incTime = text.match(/incubation[^\d]*(\d+[hm\s\d]+)/i)?.[1]?.trim() ?? null
      const babyTime = text.match(/baby[^\d]*(\d+[hm\s\d]+)/i)?.[1]?.trim() ?? null
      const maturation = text.match(/maturation[^\d]*(\d+[hm\s\d]+)/i)?.[1]?.trim() ?? null

      if (eggName) {
        egg = {
          name: eggName,
          incubation: {
            range: tempRange ?? 'Unknown',
            incubation_range: tempRange ?? 'Unknown',
            incubation_time: incTime ?? 'Unknown',
          },
          baby_time: babyTime ?? 'Unknown',
          juvenile_time: 'Unknown',
          adolescent_time: 'Unknown',
          total_maturation: maturation ?? 'Unknown',
          breeding_interval: 'Unknown',
        }
        if (!tempRange) missing.push('egg.incubation.range')
        if (!incTime) missing.push('egg.incubation.incubation_time')
        if (!babyTime) missing.push('egg.baby_time')
        missing.push('egg.juvenile_time', 'egg.adolescent_time', 'egg.breeding_interval')
      } else {
        missing.push('egg (full breeding data)')
      }
    } else {
      missing.push('egg (breeding section not found)')
    }
  }

  const data: Record<string, unknown> = {
    name: entry.name,
    category,
    dossier,
    base_stats_growth: stats,
    tameable,
    rideable,
    breedable,
    taming,
    saddle: saddle ?? null,
    rider_weaponry: false,
    egg: egg ?? null,
    drag_weight: dragWeight,
    cloneable: cloneable,
    entity_id: entityId,
  }

  return { data, missing }
}

async function scrapeCreatures(overwrite: boolean): Promise<ScrapeStats> {
  const stats: ScrapeStats = { total: 0, complete: 0, incomplete: 0, skipped: 0, images: 0 }
  const entries = await fetchCreatureList()
  if (!entries.length) { err('No creatures found on list page'); return stats }
  log(`\nFound ${entries.length} creature entries. Starting scrape…\n`)

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    process.stdout.write(`[${i + 1}/${entries.length}] ${entry.name}… `)
    stats.total++

    const { data, missing } = await parseCreaturePage(entry)

    // Validate with Zod
    const parsed = CreatureSchema.safeParse(data)
    const finalMissing = parsed.success ? missing : [
      ...missing,
      ...parsed.error.issues.map(i => i.path.join('.') + ': ' + i.message),
    ]

    const report = saveEntity('creatures', entry.slug, data, finalMissing, overwrite)
    if (report.skipped) { process.stdout.write('skipped (exists)\n'); stats.skipped++; continue }

    // Image
    const root = await fetchHtml(WIKI + entry.wikiPath).catch(() => null)
    if (root) {
      const imgUrl = extractFirstImageUrl(root)
      if (imgUrl) {
        const saved = await downloadImage('creatures', entry.slug, imgUrl)
        if (saved) stats.images++
      }
    }

    if (report.complete) {
      process.stdout.write('complete\n')
      stats.complete++
    } else {
      process.stdout.write(`incomplete (${report.missing.length} fields)\n`)
      stats.incomplete++
    }
  }

  return stats
}

// ─── Resource scraper ──────────────────────────────────────────────────────────

interface WikiEntry { name: string; slug: string; wikiPath: string }

async function fetchWikiList(wikiPage: string, excludePatterns: RegExp[] = []): Promise<WikiEntry[]> {
  const root = await fetchHtml(`${WIKI}/wiki/${wikiPage}`)
  if (!root) return []

  const entries: WikiEntry[] = []
  const seen = new Set<string>()

  for (const link of root.querySelectorAll('.wikitable a, #mw-content-text a')) {
    const href = link.getAttribute('href') ?? ''
    const title = link.getAttribute('title') ?? link.text.trim()
    if (!href.startsWith('/wiki/') || href.includes(':') || href.includes('#')) continue
    if (!title || seen.has(href)) continue
    if (excludePatterns.some(p => p.test(title))) continue
    seen.add(href)
    const slug = slugify(title)
    if (slug) entries.push({ name: title, slug, wikiPath: href })
  }

  return entries
}

async function parseResourcePage(entry: WikiEntry): Promise<{ data: Record<string, unknown>; missing: string[] }> {
  const root = await fetchHtml(WIKI + entry.wikiPath)
  const missing: string[] = []

  if (!root) {
    return {
      data: {
        name: entry.name,
        rarity: 'common',
        renewable: false, refinable: false, combustible: false,
        weight: 0, stack_size: 100, found_in: [],
      },
      missing: ['ALL (page fetch failed)'],
    }
  }

  const infobox = parseInfobox(root)
  const text = root.text

  // Weight and stack size
  const weight = parseNum(infobox['weight'] || infobox['item_weight'])
  const stackSize = parseIntNum(infobox['stack_size'] || infobox['stack'])

  if (weight === null) missing.push('weight')
  if (stackSize === null) missing.push('stack_size')

  // Rarity — infer from page categories or infobox
  let rarity: 'common' | 'uncommon' | 'rare' = 'common'
  const rarityText = (infobox['rarity'] || '').toLowerCase()
  if (rarityText === 'rare') rarity = 'rare'
  else if (rarityText === 'uncommon') rarity = 'uncommon'
  else {
    // Try category links
    for (const cat of root.querySelectorAll('.catlinks a')) {
      const catText = cat.text.toLowerCase()
      if (catText.includes('rare')) { rarity = 'rare'; break }
      if (catText.includes('uncommon')) { rarity = 'uncommon'; break }
    }
  }

  // Booleans
  const renewable = parseBool(infobox['renewable']) || /renewable/i.test(text)
  const refinable = parseBool(infobox['refinable']) || /refinable|refine/i.test(text)
  const combustible = parseBool(infobox['combustible']) || /combustible|fuel/i.test(text)

  // Found in (biomes / sources)
  const foundIn: string[] = []
  const foundInText = infobox['found_in'] || infobox['drops_from'] || infobox['gathered_from'] || ''
  if (foundInText) {
    foundIn.push(...foundInText.split(/[,;\/]/).map(s => s.trim()).filter(Boolean))
  }
  if (!foundIn.length) missing.push('found_in')

  return {
    data: {
      name: entry.name,
      rarity,
      renewable,
      refinable,
      combustible,
      weight: weight ?? 0,
      stack_size: stackSize ?? 100,
      found_in: foundIn,
    },
    missing,
  }
}

async function scrapeResources(overwrite: boolean): Promise<ScrapeStats> {
  const stats: ScrapeStats = { total: 0, complete: 0, incomplete: 0, skipped: 0, images: 0 }
  info('Fetching resource list from wiki…')
  const entries = await fetchWikiList('Resources', [/^(Resources|Category|Template|ARK)/i])
  if (!entries.length) { err('No resources found'); return stats }
  log(`\nFound ${entries.length} resource entries. Starting scrape…\n`)

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    process.stdout.write(`[${i + 1}/${entries.length}] ${entry.name}… `)
    stats.total++

    const { data, missing } = await parseResourcePage(entry)
    const parsed = ResourceSchema.safeParse(data)
    const finalMissing = parsed.success ? missing : [
      ...missing,
      ...parsed.error.issues.map(i => i.path.join('.') + ': ' + i.message),
    ]

    const report = saveEntity('resources', entry.slug, data, finalMissing, overwrite)
    if (report.skipped) { process.stdout.write('skipped\n'); stats.skipped++; continue }

    // Image
    const root = await fetchHtml(WIKI + entry.wikiPath).catch(() => null)
    if (root) {
      const imgUrl = extractFirstImageUrl(root)
      if (imgUrl) {
        const saved = await downloadImage('resources', entry.slug, imgUrl)
        if (saved) stats.images++
      }
    }

    if (report.complete) { process.stdout.write('complete\n'); stats.complete++ }
    else { process.stdout.write(`incomplete (${report.missing.length} fields)\n`); stats.incomplete++ }
  }

  return stats
}

// ─── Armor scraper ─────────────────────────────────────────────────────────────

async function parseArmorPage(entry: WikiEntry): Promise<{ data: Record<string, unknown>; missing: string[] }> {
  const root = await fetchHtml(WIKI + entry.wikiPath)
  const missing: string[] = []

  if (!root) {
    return {
      data: {
        set_name: entry.name,
        unlock_level: null, engram_points: null,
        armor_rating: 0, cold_protection: 0, heat_protection: 0,
        weight: 0, durability: null,
        found_in: [], set_ingredients: [],
      },
      missing: ['ALL (page fetch failed)'],
    }
  }

  const infobox = parseInfobox(root)

  const unlockLevel = parseIntNum(infobox['required_level'] || infobox['engram_level'] || infobox['unlock_level'])
  const engramPoints = parseIntNum(infobox['engram_points'] || infobox['ep'])
  const armorRating = parseNum(infobox['armor'] || infobox['armor_rating'])
  const coldProt = parseNum(infobox['cold_protection'] || infobox['cold'] || infobox['hypothermal_insulation'])
  const heatProt = parseNum(infobox['heat_protection'] || infobox['heat'] || infobox['hyperthermal_insulation'])
  const weight = parseNum(infobox['weight'])
  const durability = parseNum(infobox['durability'])

  if (armorRating === null) missing.push('armor_rating')
  if (coldProt === null) missing.push('cold_protection')
  if (heatProt === null) missing.push('heat_protection')
  if (weight === null) missing.push('weight')

  // Found in
  const foundIn: string[] = []
  const foundInText = infobox['found_in'] || infobox['dlc'] || ''
  if (foundInText) foundIn.push(...foundInText.split(/[,;]/).map(s => s.trim()).filter(Boolean))
  if (!foundIn.length) {
    // infer from categories
    for (const cat of root.querySelectorAll('.catlinks a')) {
      const t = cat.text.trim()
      if (t && !/(armor|category|items)/i.test(t)) foundIn.push(t)
    }
  }

  // Ingredients — look for crafting table
  const ingredients: Array<{ name: string; quantity: number; resource_id: string }> = []
  for (const table of root.querySelectorAll('table.wikitable')) {
    const headers = table.querySelectorAll('tr:first-child th, tr:first-child td')
    const headerTexts = Array.from(headers).map(h => cleanText(h).toLowerCase())
    if (!headerTexts.some(h => /ingredient|material|resource|craft/i.test(h))) continue

    for (const row of table.querySelectorAll('tr:not(:first-child)')) {
      const cells = row.querySelectorAll('td')
      if (cells.length < 2) continue
      const name = cleanText(cells[0])
      const qty = parseIntNum(cleanText(cells[1]))
      if (name && qty !== null) {
        ingredients.push({ name, quantity: qty, resource_id: slugify(name) })
      }
    }
    if (ingredients.length) break
  }

  if (!ingredients.length) missing.push('set_ingredients')

  return {
    data: {
      set_name: entry.name,
      unlock_level: unlockLevel,
      engram_points: engramPoints,
      armor_rating: armorRating ?? 0,
      cold_protection: coldProt ?? 0,
      heat_protection: heatProt ?? 0,
      weight: weight ?? 0,
      durability,
      found_in: foundIn,
      set_ingredients: ingredients,
    },
    missing,
  }
}

async function scrapeArmor(overwrite: boolean): Promise<ScrapeStats> {
  const stats: ScrapeStats = { total: 0, complete: 0, incomplete: 0, skipped: 0, images: 0 }
  info('Fetching armor list from wiki…')
  const entries = await fetchWikiList('Armor', [/^(Armor|Category|Template|ARK|DLC)/i])
  if (!entries.length) { err('No armor entries found'); return stats }
  log(`\nFound ${entries.length} armor entries. Starting scrape…\n`)

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    process.stdout.write(`[${i + 1}/${entries.length}] ${entry.name}… `)
    stats.total++

    const { data, missing } = await parseArmorPage(entry)
    const parsed = ArmorSchema.safeParse(data)
    const finalMissing = parsed.success ? missing : [
      ...missing,
      ...parsed.error.issues.map(i => i.path.join('.') + ': ' + i.message),
    ]

    const report = saveEntity('armor', entry.slug, data, finalMissing, overwrite)
    if (report.skipped) { process.stdout.write('skipped\n'); stats.skipped++; continue }

    const root = await fetchHtml(WIKI + entry.wikiPath).catch(() => null)
    if (root) {
      const imgUrl = extractFirstImageUrl(root)
      if (imgUrl) {
        const saved = await downloadImage('armor', entry.slug, imgUrl)
        if (saved) stats.images++
      }
    }

    if (report.complete) { process.stdout.write('complete\n'); stats.complete++ }
    else { process.stdout.write(`incomplete (${report.missing.length} fields)\n`); stats.incomplete++ }
  }

  return stats
}

// ─── Weapon scraper ────────────────────────────────────────────────────────────

const WEAPON_CATEGORIES = ['tool', 'melee', 'ranged', 'firearm', 'explosive', 'tek', 'shield', 'turret', 'attachment'] as const
type WeaponCategory = typeof WEAPON_CATEGORIES[number]

function inferWeaponCategory(root: HTMLElement, infobox: Record<string, string>): WeaponCategory {
  const text = (infobox['type'] || infobox['category'] || '').toLowerCase()
  if (/tek/i.test(text)) return 'tek'
  if (/explosive|grenade|rocket/i.test(text)) return 'explosive'
  if (/firearm|gun|pistol|rifle|shotgun/i.test(text)) return 'firearm'
  if (/ranged|bow|crossbow|slingshot/i.test(text)) return 'ranged'
  if (/melee|sword|club|pike/i.test(text)) return 'melee'
  if (/shield/i.test(text)) return 'shield'
  if (/turret/i.test(text)) return 'turret'
  if (/attachment|scope|silencer/i.test(text)) return 'attachment'
  // Try page categories
  for (const cat of root.querySelectorAll('.catlinks a')) {
    const c = cat.text.toLowerCase()
    if (/tek/i.test(c)) return 'tek'
    if (/explosive/i.test(c)) return 'explosive'
    if (/firearm/i.test(c)) return 'firearm'
    if (/ranged/i.test(c)) return 'ranged'
    if (/melee/i.test(c)) return 'melee'
  }
  return 'tool'
}

async function parseWeaponPage(entry: WikiEntry): Promise<{ data: Record<string, unknown>; missing: string[] }> {
  const root = await fetchHtml(WIKI + entry.wikiPath)
  const missing: string[] = []

  if (!root) {
    return {
      data: {
        name: entry.name, category: 'tool',
        damage: null, unlock_level: null, engram_points: null,
        ammo_type: null, ingredients: [],
      },
      missing: ['ALL (page fetch failed)'],
    }
  }

  const infobox = parseInfobox(root)
  const category = inferWeaponCategory(root, infobox)

  const damage = parseNum(infobox['damage'] || infobox['base_damage'])
  const unlockLevel = parseIntNum(infobox['required_level'] || infobox['unlock_level'] || infobox['engram_level'])
  const engramPoints = parseIntNum(infobox['engram_points'] || infobox['ep'])
  const ammoType = infobox['ammo'] || infobox['ammo_type'] || null

  // Ingredients
  const ingredients: Array<{ name: string; quantity: number; resource_id: string }> = []
  for (const table of root.querySelectorAll('table.wikitable')) {
    const headers = table.querySelectorAll('tr:first-child th, tr:first-child td')
    const headerTexts = Array.from(headers).map(h => cleanText(h).toLowerCase())
    if (!headerTexts.some(h => /ingredient|material|resource|craft/i.test(h))) continue

    for (const row of table.querySelectorAll('tr:not(:first-child)')) {
      const cells = row.querySelectorAll('td')
      if (cells.length < 2) continue
      const name = cleanText(cells[0])
      const qty = parseIntNum(cleanText(cells[1]))
      if (name && qty !== null) {
        ingredients.push({ name, quantity: qty, resource_id: slugify(name) })
      }
    }
    if (ingredients.length) break
  }

  if (!ingredients.length) missing.push('ingredients')

  return {
    data: {
      name: entry.name,
      category,
      damage,
      unlock_level: unlockLevel,
      engram_points: engramPoints,
      ammo_type: ammoType,
      ingredients,
    },
    missing,
  }
}

async function scrapeWeapons(overwrite: boolean): Promise<ScrapeStats> {
  const stats: ScrapeStats = { total: 0, complete: 0, incomplete: 0, skipped: 0, images: 0 }
  info('Fetching weapon list from wiki…')
  const entries = await fetchWikiList('Weapons', [/^(Weapons|Category|Template|ARK|DLC|Ammo)/i])
  if (!entries.length) { err('No weapons found'); return stats }
  log(`\nFound ${entries.length} weapon entries. Starting scrape…\n`)

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    process.stdout.write(`[${i + 1}/${entries.length}] ${entry.name}… `)
    stats.total++

    const { data, missing } = await parseWeaponPage(entry)
    const parsed = WeaponSchema.safeParse(data)
    const finalMissing = parsed.success ? missing : [
      ...missing,
      ...parsed.error.issues.map(i => i.path.join('.') + ': ' + i.message),
    ]

    const report = saveEntity('weapons', entry.slug, data, finalMissing, overwrite)
    if (report.skipped) { process.stdout.write('skipped\n'); stats.skipped++; continue }

    const root = await fetchHtml(WIKI + entry.wikiPath).catch(() => null)
    if (root) {
      const imgUrl = extractFirstImageUrl(root)
      if (imgUrl) {
        const saved = await downloadImage('weapons', entry.slug, imgUrl)
        if (saved) stats.images++
      }
    }

    if (report.complete) { process.stdout.write('complete\n'); stats.complete++ }
    else { process.stdout.write(`incomplete (${report.missing.length} fields)\n`); stats.incomplete++ }
  }

  return stats
}

// ─── Single-entity scrape ──────────────────────────────────────────────────────

async function scrapeSingle(type: string, nameOrSlug: string, overwrite: boolean): Promise<void> {
  const slug = slugify(nameOrSlug)
  const wikiName = nameOrSlug.replace(/_/g, ' ')
  const entry: WikiEntry = { name: wikiName, slug, wikiPath: `/wiki/${encodeURIComponent(wikiName)}` }

  log(`\nScraping ${type}: "${wikiName}" (slug: ${slug})\n`)

  let data: Record<string, unknown>
  let missing: string[]
  let schema: z.ZodSchema

  switch (type) {
    case 'creatures':
      ;({ data, missing } = await parseCreaturePage(entry as CreatureEntry)); schema = CreatureSchema; break
    case 'resources':
      ;({ data, missing } = await parseResourcePage(entry)); schema = ResourceSchema; break
    case 'armor':
      ;({ data, missing } = await parseArmorPage(entry)); schema = ArmorSchema; break
    case 'weapons':
      ;({ data, missing } = await parseWeaponPage(entry)); schema = WeaponSchema; break
    default:
      err(`Unknown type: ${type}`); return
  }

  const parsed = schema.safeParse(data)
  const finalMissing = parsed.success ? missing : [
    ...missing,
    ...parsed.error.issues.map((i: z.ZodIssue) => i.path.join('.') + ': ' + i.message),
  ]

  const report = saveEntity(type, slug, data, finalMissing, overwrite)

  // Image
  const root = await fetchHtml(WIKI + entry.wikiPath).catch(() => null)
  if (root) {
    const imgUrl = extractFirstImageUrl(root)
    if (imgUrl) await downloadImage(type, slug, imgUrl)
  }

  if (report.skipped) { warn(`Skipped — file already exists (use overwrite to force)`); return }
  if (report.complete) ok(`Saved complete data to data/${type}/${slug}.json`)
  else {
    warn(`Saved incomplete data to data/${type}/incomplete/${slug}.json`)
    warn(`Missing fields:`)
    for (const f of report.missing) warn(`  - ${f}`)
  }
}

// ─── Stats summary ─────────────────────────────────────────────────────────────

interface ScrapeStats {
  total: number
  complete: number
  incomplete: number
  skipped: number
  images: number
}

function printStats(label: string, s: ScrapeStats) {
  log(`\n── ${label} results ─────────────────────────────────`)
  log(`   Total processed : ${s.total}`)
  log(`   Complete        : ${s.complete}`)
  log(`   Incomplete      : ${s.incomplete}`)
  log(`   Skipped (exist) : ${s.skipped}`)
  log(`   Images saved    : ${s.images}`)
  if (s.incomplete > 0) {
    warn(`${s.incomplete} entries need manual review — check data/{type}/incomplete/`)
  }
}

// ─── Main menu ─────────────────────────────────────────────────────────────────

async function main() {
  log('\n\x1b[1mGigasaurus — ARK Wiki Scraper\x1b[0m')
  log('─────────────────────────────────────\n')

  const overwrite = await confirm('Overwrite existing files?')
  log('')

  log('What would you like to scrape?')
  log('  1) Creatures')
  log('  2) Resources')
  log('  3) Armor')
  log('  4) Weapons')
  log('  5) All of the above')
  log('  6) Single entity (by name/slug)')
  log('  q) Quit')
  log('')

  const choice = (await ask('Choice: ')).trim().toLowerCase()
  log('')

  const allStats: ScrapeStats[] = []

  if (choice === 'q') {
    log('Bye!'); rl.close(); return
  }

  if (choice === '6') {
    log('Types: creatures, resources, armor, weapons')
    const type = (await ask('Type: ')).trim()
    const name = (await ask('Name or slug: ')).trim()
    log('')
    await scrapeSingle(type, name, overwrite)
    rl.close()
    return
  }

  const runCreatures  = choice === '1' || choice === '5'
  const runResources  = choice === '2' || choice === '5'
  const runArmor      = choice === '3' || choice === '5'
  const runWeapons    = choice === '4' || choice === '5'

  if (!runCreatures && !runResources && !runArmor && !runWeapons) {
    err('Invalid choice'); rl.close(); return
  }

  if (runCreatures) {
    log('── Creatures ─────────────────────────────────────\n')
    allStats.push(await scrapeCreatures(overwrite))
  }
  if (runResources) {
    log('\n── Resources ─────────────────────────────────────\n')
    allStats.push(await scrapeResources(overwrite))
  }
  if (runArmor) {
    log('\n── Armor ─────────────────────────────────────────\n')
    allStats.push(await scrapeArmor(overwrite))
  }
  if (runWeapons) {
    log('\n── Weapons ───────────────────────────────────────\n')
    allStats.push(await scrapeWeapons(overwrite))
  }

  // Aggregate
  if (allStats.length > 1) {
    const total = allStats.reduce((a, s) => ({
      total: a.total + s.total,
      complete: a.complete + s.complete,
      incomplete: a.incomplete + s.incomplete,
      skipped: a.skipped + s.skipped,
      images: a.images + s.images,
    }))
    printStats('Overall', total)
  } else if (allStats.length === 1) {
    printStats('Run', allStats[0])
  }

  log('')
  rl.close()
}

main().catch(e => { err(String(e)); rl.close(); process.exit(1) })
