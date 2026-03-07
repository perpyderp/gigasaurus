#!/usr/bin/env bun
/**
 * scripts/scrape.ts — Interactive ARK wiki scraper
 *
 * Usage:  bun scripts/scrape.ts
 *
 * Uses the MediaWiki API (/api.php?action=parse) to avoid Cloudflare blocks.
 *
 * Outputs:
 *   data/{type}/{slug}.json                   — schema-valid entries
 *   data/{type}/incomplete/{slug}.json         — entries missing required fields
 *   data/{type}/incomplete/{slug}__missing.txt — manual todo list
 *   public/images/{type}/{slug}.png            — downloaded images
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { parse as parseHtml, type HTMLElement } from 'node-html-parser'
import { createInterface } from 'readline'
import { CreatureSchema } from '../src/schemas/creature'
import { ArmorSchema } from '../src/schemas/armor'
import { ResourceSchema } from '../src/schemas/resource'
import { WeaponSchema } from '../src/schemas/weapon'
import type { ZodSchema } from 'zod'

// ─── Config ────────────────────────────────────────────────────────────────────

const WIKI      = 'https://ark.wiki.gg'
const WIKI_API  = `${WIKI}/api.php`
const ROOT      = join(import.meta.dir, '..')
const DELAY_MS  = 800
const UA        = 'Gigasaurus/1.0 (ARK wiki research; contact via GitHub)'

// ─── CLI helpers ───────────────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask  = (q: string)  => new Promise<string>(r => rl.question(q, r))
const confirm = async (q: string) => (await ask(`${q} [y/N] `)).trim().toLowerCase() === 'y'
const log  = (m: string)  => process.stdout.write(m + '\n')
const info = (m: string)  => log(`  ${m}`)
const ok   = (m: string)  => log(`  \x1b[32m✓\x1b[0m ${m}`)
const warn = (m: string)  => log(`  \x1b[33m⚠\x1b[0m ${m}`)
const fail = (m: string)  => log(`  \x1b[31m✗\x1b[0m ${m}`)

// ─── Rate-limited MediaWiki API fetch ─────────────────────────────────────────

let lastFetch = 0

async function fetchPage(wikiTitle: string): Promise<HTMLElement | null> {
  const wait = Math.max(0, DELAY_MS - (Date.now() - lastFetch))
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastFetch = Date.now()

  const url = `${WIKI_API}?action=parse&page=${encodeURIComponent(wikiTitle)}&format=json&prop=text`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) { warn(`HTTP ${res.status} for "${wikiTitle}"`); return null }
    const json = await res.json() as { parse?: { text?: { '*': string } }; error?: unknown }
    if (json.error || !json.parse?.text?.['*']) { warn(`API error for "${wikiTitle}"`); return null }
    return parseHtml(json.parse.text['*'])
  } catch (e) {
    warn(`Fetch failed for "${wikiTitle}": ${e}`)
    return null
  }
}

async function fetchBytes(url: string): Promise<ArrayBuffer | null> {
  const wait = Math.max(0, DELAY_MS - (Date.now() - lastFetch))
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastFetch = Date.now()
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    return res.ok ? res.arrayBuffer() : null
  } catch { return null }
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function clean(el: HTMLElement | null): string {
  if (!el) return ''
  return el.text.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim()
}

function parseNum(s: string): number | null {
  const n = parseFloat(s.replace(/,/g, '').replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? null : n
}

function parseIntNum(s: string): number | null {
  const n = parseInt(s.replace(/,/g, '').replace(/[^0-9\-]/g, ''), 10)
  return isNaN(n) ? null : n
}

function hasCheckmark(el: HTMLElement): boolean {
  return el.querySelector('img[alt="Check mark.svg"]') !== null
}

/** Resolve a thumbnail img src to the full-resolution image URL. */
function resolveImgUrl(src: string): string {
  if (!src) return src
  if (src.startsWith('//')) src = 'https:' + src
  if (src.startsWith('/'))  src = WIKI + src
  // /images/thumb/File.png/320px-File.png → /images/File.png
  const m = src.match(/\/images\/thumb\/(.+?\.[a-z]+)\/[^/]+$/)
  if (m) src = `${WIKI}/images/${m[1]}`
  return src
}

/** Get the primary content image from an info-arkitex infobox. */
function extractItemImage(root: HTMLElement): string | null {
  // Items (resources, armor, weapons): inside .info-nodescquotes or .info-column
  for (const sel of ['.info-nodescquotes a.image img', '.info-column a.image img']) {
    const img = root.querySelector(sel)
    if (img) {
      const src = img.getAttribute('src') || img.getAttribute('data-src') || ''
      if (src && !src.includes('Question_mark') && !src.includes('noimage')) {
        return resolveImgUrl(src)
      }
    }
  }
  return null
}

/** Get the dossier card image for a creature. */
function extractCreatureImage(root: HTMLElement): string | null {
  // Dossier image has alt="Dossier X.png" and is inside an a.image
  const dossierLink = root.querySelector('a.image[href*="Dossier_"]')
  if (dossierLink) {
    const img = dossierLink.querySelector('img')
    if (img) {
      const src = img.getAttribute('src') || img.getAttribute('data-src') || ''
      if (src) return resolveImgUrl(src)
    }
  }
  // Fallback: first creature icon (dinolink class)
  const icon = root.querySelector('img.dinolink')
  if (icon) {
    const src = icon.getAttribute('src') || ''
    if (src) return resolveImgUrl(src)
  }
  return null
}

// ─── info-arkitex infobox parser ───────────────────────────────────────────────

interface InfoRow { label: string; value: string; isCheck: boolean | null }

function parseArkInfo(root: HTMLElement): InfoRow[] {
  const rows: InfoRow[] = []
  for (const row of root.querySelectorAll('.info-unit-row')) {
    const left  = row.querySelector('.info-arkitex-left, .info-X2-25')
    const right = row.querySelector('.info-arkitex-right, .info-X2-75')
    if (!left || !right) continue

    const label = clean(left).replace(/\s*\d+$/, '').trim()
    const value = clean(right)
    if (!label) continue

    // Detect check/cross mark
    const hasCheck = right.querySelector('img[alt="Check mark.svg"]') !== null
    const hasCross = right.querySelector('img[alt="X mark.svg"]') !== null
    const isCheck  = hasCheck ? true : hasCross ? false : null

    rows.push({ label, value, isCheck })
  }
  return rows
}

function getInfoValue(rows: InfoRow[], ...patterns: string[]): string | null {
  const targets = patterns.map(p => p.toLowerCase())
  for (const row of rows) {
    const lbl = row.label.toLowerCase()
    if (targets.some(t => lbl.includes(t))) return row.value || null
  }
  return null
}

function getInfoBool(rows: InfoRow[], ...patterns: string[]): boolean {
  const targets = patterns.map(p => p.toLowerCase())
  for (const row of rows) {
    const lbl = row.label.toLowerCase()
    if (targets.some(t => lbl.includes(t))) {
      if (row.isCheck !== null) return row.isCheck
      const v = row.value.toLowerCase()
      return v === 'yes' || v === 'true'
    }
  }
  return false
}

// ─── Ingredient parser ─────────────────────────────────────────────────────────

interface Ingredient { name: string; quantity: number; resource_id: string }

function parseIngredients(root: HTMLElement): Ingredient[] {
  const ingredients: Ingredient[] = []
  // Find the "Ingredients" caption and get its parent's content
  for (const caption of root.querySelectorAll('.info-unit-caption')) {
    if (!clean(caption).toLowerCase().includes('ingredient')) continue
    const container = caption.closest('.info-unit')
    if (!container) continue
    // Pattern: bold elements "N × ItemName"
    for (const b of container.querySelectorAll('b')) {
      const text = b.text.trim()
      const m = text.match(/^(\d+)\s*[×x]\s*(.+)/)
      if (m) {
        const qty  = parseInt(m[1], 10)
        const name = m[2].replace(/\s+/g, ' ').trim()
        if (!isNaN(qty) && name) {
          ingredients.push({ name, quantity: qty, resource_id: slugify(name) })
        }
      }
    }
    break
  }
  return ingredients
}

// ─── Save helpers ──────────────────────────────────────────────────────────────

interface ScrapeStats { total: number; complete: number; incomplete: number; skipped: number; images: number }

function ensureDir(d: string) { if (!existsSync(d)) mkdirSync(d, { recursive: true }) }

function saveEntity(
  type: string, slug: string,
  data: Record<string, unknown>, missing: string[],
  overwrite: boolean,
): { saved: boolean; complete: boolean } {
  const complete = missing.length === 0
  const dir = complete ? join(ROOT, 'data', type) : join(ROOT, 'data', type, 'incomplete')
  ensureDir(dir)

  const filePath = join(dir, `${slug}.json`)
  if (existsSync(filePath) && !overwrite) return { saved: false, complete }

  writeFileSync(filePath, JSON.stringify(data, null, 4) + '\n')

  if (!complete) {
    writeFileSync(join(dir, `${slug}__missing.txt`), [
      `Incomplete data for: ${slug}`,
      `Scraped: ${new Date().toISOString()}`,
      `Source: ${WIKI}/wiki/${encodeURIComponent(slug.replace(/_/g, ' '))}`,
      '',
      'Fields requiring manual population:',
      ...missing.map(f => `  - ${f}`),
      '',
      `When complete, move to: data/${type}/${slug}.json`,
    ].join('\n') + '\n')
  }
  return { saved: true, complete }
}

async function saveImage(type: string, slug: string, url: string): Promise<boolean> {
  const dir = join(ROOT, 'public', 'images', type)
  ensureDir(dir)
  const ext  = url.split('?')[0].split('.').pop() ?? 'png'
  const dest = join(dir, `${slug}.${ext}`)
  if (existsSync(dest)) return true
  const buf = await fetchBytes(url)
  if (!buf) return false
  writeFileSync(dest, Buffer.from(buf))
  return true
}

function validateAndMerge(schema: ZodSchema, data: Record<string, unknown>, baseMissing: string[]): string[] {
  const result = schema.safeParse(data)
  if (result.success) return baseMissing
  const zodErrors = result.error.issues.map((i: { path: (string | number)[]; message: string }) =>
    `${i.path.join('.')}: ${i.message}`)
  return [...baseMissing, ...zodErrors.filter(e => !baseMissing.some(m => e.startsWith(m.split(':')[0])))]
}

// ─── CREATURE SCRAPER ──────────────────────────────────────────────────────────

interface CreatureListEntry {
  name: string; slug: string
  diet: string; temperament: string
  tameable: boolean; rideable: boolean; breedable: boolean
  saddle_level: number | null; entity_id: string | null
}

const GROUP_TO_CATEGORY: Record<string, string> = {
  'dinosaurs': 'dinosaur', 'dinosaur': 'dinosaur',
  'birds': 'bird', 'bird': 'bird',
  'fish': 'fish',
  'invertebrates': 'invertebrate', 'invertebrate': 'invertebrate',
  'mammals': 'mammal', 'mammal': 'mammal',
  'reptiles': 'reptile', 'reptile': 'reptile',
  'fantasy creatures': 'fantasy', 'fantasy': 'fantasy',
  'synapsids': 'other', 'bosses': 'other', 'titans': 'other',
  'amphibians': 'other', 'mechanical creatures': 'other',
}

async function fetchCreatureList(): Promise<CreatureListEntry[]> {
  info('Fetching creature list…')
  const root = await fetchPage('Creatures')
  if (!root) return []

  const table = root.querySelector('table.cargo-creature-table')
  if (!table) { fail('Could not find cargo-creature-table on Creatures page'); return [] }

  // Parse header row to find column indices
  const headers = table.querySelectorAll('tr:first-child th').map(th => clean(th).toLowerCase())
  const colName   = headers.findIndex(h => h.includes('name'))
  const colDiet   = headers.findIndex(h => h === 'diet')
  const colTemp   = headers.findIndex(h => h.includes('temperament'))
  const colTame   = headers.findIndex(h => h.includes('tame'))
  const colRide   = headers.findIndex(h => h.includes('ride'))
  const colBreed  = headers.findIndex(h => h.includes('breed'))
  const colSaddle = headers.findIndex(h => h.includes('saddle'))
  const colEntity = headers.findIndex(h => h.includes('entity'))

  const entries: CreatureListEntry[] = []
  for (const row of table.querySelectorAll('tr:not(:first-child)')) {
    const cells = row.querySelectorAll('td')
    if (cells.length < 4) continue

    const nameCell = cells[colName >= 0 ? colName : 0]
    const link = nameCell.querySelector('a[href^="/wiki/"]')
    if (!link) continue
    const href = link.getAttribute('href') ?? ''
    const name = link.getAttribute('title') || clean(link)
    if (!name || href.includes(':')) continue

    const slug = slugify(name)
    if (!slug) continue

    const dietText = colDiet >= 0 ? clean(cells[colDiet]) : ''
    const tempText = colTemp >= 0 ? clean(cells[colTemp]) : ''
    const tameCell  = colTame  >= 0 ? cells[colTame]  : null
    const rideCell  = colRide  >= 0 ? cells[colRide]  : null
    const breedCell = colBreed >= 0 ? cells[colBreed] : null
    const saddleCell = colSaddle >= 0 ? cells[colSaddle] : null
    const entityCell = colEntity >= 0 ? cells[colEntity] : null

    entries.push({
      name, slug,
      diet:        dietText,
      temperament: tempText,
      tameable:  tameCell  ? (hasCheckmark(tameCell)  || /yes/i.test(clean(tameCell)))  : false,
      rideable:  rideCell  ? (hasCheckmark(rideCell)  || /yes/i.test(clean(rideCell)))  : false,
      breedable: breedCell ? (hasCheckmark(breedCell) || /yes/i.test(clean(breedCell))) : false,
      saddle_level: saddleCell ? parseIntNum(clean(saddleCell)) : null,
      entity_id:    entityCell ? (clean(entityCell) || null) : null,
    })
  }
  return entries
}

/** Parse base stats from the wikitable[data-description="Base Stats and Growth"]. */
function parseCreatureStats(root: HTMLElement) {
  const defaultStats = () => ({ base: null as number | null })
  const stats: Record<string, { base: number | null; level_increase?: { wild?: number; tamed?: number }; taming_bonus?: { additive?: number; multiplicative?: number } }> = {
    health: defaultStats(), stamina: defaultStats(), oxygen: defaultStats(),
    food: defaultStats(), weight: defaultStats(), melee: defaultStats(),
    movement: defaultStats(), torpidity: defaultStats(),
  }

  const STAT_MAP: Record<string, keyof typeof stats> = {
    'health': 'health', 'stamina': 'stamina', 'oxygen': 'oxygen', 'food': 'food',
    'weight': 'weight', 'melee damage': 'melee', 'movement speed': 'movement', 'torpidity': 'torpidity',
  }

  const table = root.querySelector('table.wikitable[data-description="Base Stats and Growth"]')
  if (!table) return stats

  for (const row of table.querySelectorAll('tr:not(:first-child):not(:nth-child(2))')) {
    const cells = row.querySelectorAll('td')
    if (cells.length < 2) continue

    // Attribute name is the link text or plain text in first cell
    const attrText = clean(cells[0]).toLowerCase().replace(/\s+/g, ' ').trim()
    const statKey = STAT_MAP[attrText]
    if (!statKey) continue

    const isNA = (cell: HTMLElement) => cell.classList.contains('gray') || clean(cell).trim() === 'N/A'

    const baseVal = isNA(cells[1]) ? null : parseNum(clean(cells[1]))
    const wildInc = cells[2] && !isNA(cells[2]) ? parseNum(clean(cells[2]).replace('+', '')) : null
    const tamedInc = cells[3] && !isNA(cells[3]) ? (() => {
      const v = clean(cells[3]).replace('+', '').replace('%', '')
      const n = parseNum(v)
      return n !== null ? n / 100 : null
    })() : null
    const addBonus = cells[4] && clean(cells[4]).trim() ? parseNum(clean(cells[4]).replace('%', '')) : null
    const multBonus = cells[5] && clean(cells[5]).trim() ? parseNum(clean(cells[5]).replace('%', '')) : null

    const entry: typeof stats[string] = { base: baseVal }
    if (wildInc !== null || tamedInc !== null) {
      entry.level_increase = {}
      if (wildInc !== null) entry.level_increase.wild = wildInc
      if (tamedInc !== null) entry.level_increase.tamed = tamedInc
    }
    if (addBonus !== null || multBonus !== null) {
      entry.taming_bonus = {}
      if (addBonus !== null) {
        // The wiki shows "7%" — convert to 0.07
        entry.taming_bonus.additive = addBonus > 1 ? addBonus / 100 : addBonus
      }
      if (multBonus !== null) {
        entry.taming_bonus.multiplicative = multBonus > 1 ? multBonus / 100 : multBonus
      }
    }
    stats[statKey] = entry
  }
  return stats
}

/** Parse the dossier text section. */
function parseDossier(root: HTMLElement) {
  const dossierDiv = root.querySelector('.dossier-text-note')
  if (!dossierDiv) return null

  const note = dossierDiv as HTMLElement
  let species: string | null = null
  let time: string | null = null
  let diet: string | null = null
  let temperament: string | null = null

  // Bold labels followed by paragraphs
  const bolds = note.querySelectorAll('b')
  for (const b of bolds) {
    const label = b.text.trim().toLowerCase()
    // The next element after <b> is a <p>
    let sibling = b.nextElementSibling
    if (sibling && sibling.tagName === 'P') {
      const val = clean(sibling as HTMLElement)
      if (label === 'species') species = val
      else if (label === 'time') time = val
      else if (label === 'diet') diet = val
      else if (label === 'temperament') temperament = val
    }
  }

  // Wild/Domesticated text come after <dl><dt> tags
  let wildText: string | null = null
  let domText: string | null = null

  // Find <dt> elements
  for (const dt of root.querySelectorAll('.dossier-text dl dt, .dossier-background dl dt')) {
    const label = dt.text.trim().toLowerCase()
    // Next sibling paragraph — look at the dl's next sibling
    let sib = dt.closest('dl')?.nextElementSibling ?? null
    if (sib && sib.tagName === 'P') {
      const val = clean(sib as HTMLElement)
      if (label === 'wild') wildText = val
      else if (label === 'domesticated') domText = val
    }
  }

  // Fallback: just get the two paragraphs in the dossier-background div
  if (!wildText || !domText) {
    const bgDiv = root.querySelector('.dossier-background')
    if (bgDiv) {
      const paras = bgDiv.querySelectorAll('p').map(p => clean(p)).filter(t => t.length > 40)
      if (!wildText && paras[0]) wildText = paras[0]
      if (!domText && paras[1]) domText = paras[1]
    }
  }

  return { species, time, diet, temperament, wild: wildText, domesticated: domText }
}

/** Extract entity ID from the first spawn command. */
function extractEntityId(root: HTMLElement): string | null {
  for (const code of root.querySelectorAll('.info-arkitex-spawn-commands-entry .copy-content')) {
    const text = code.text.trim()
    const m = text.match(/^cheat summon (\S+)/)
    if (m) return m[1]
  }
  return null
}

async function scrapeCreature(entry: CreatureListEntry): Promise<{ data: Record<string, unknown>; missing: string[] }> {
  const root = await fetchPage(entry.name)
  const missing: string[] = []

  if (!root) {
    return {
      data: {
        name: entry.name, category: 'other', dossier: null,
        base_stats_growth: {
          health: { base: null }, stamina: { base: null }, oxygen: { base: null },
          food: { base: null }, weight: { base: null }, melee: { base: null },
          movement: { base: null }, torpidity: { base: null },
        },
        tameable: entry.tameable, rideable: entry.rideable, breedable: entry.breedable,
        taming: null, saddle: null, rider_weaponry: false,
        egg: null, drag_weight: null, cloneable: null, entity_id: entry.entity_id,
      },
      missing: ['ALL (page fetch failed — manual population required)'],
    }
  }

  const arkInfo = parseArkInfo(root)

  // ── Category ──────────────────────────────────────────────────────────────────
  const groupRaw = (getInfoValue(arkInfo, 'group') ?? '').toLowerCase().trim()
  const category = GROUP_TO_CATEGORY[groupRaw] ?? 'other'

  // ── Dossier ───────────────────────────────────────────────────────────────────
  const dossierData = parseDossier(root)
  const dossier = dossierData?.species && dossierData.wild && dossierData.domesticated
    ? {
        species: dossierData.species,
        time: dossierData.time ?? 'Unknown',
        diet: dossierData.diet ?? entry.diet,
        temperament: dossierData.temperament ?? entry.temperament,
        wild: dossierData.wild,
        domesticated: dossierData.domesticated,
      }
    : null

  if (!dossier) {
    if (!dossierData?.species) missing.push('dossier.species')
    if (!dossierData?.wild) missing.push('dossier.wild')
    if (!dossierData?.domesticated) missing.push('dossier.domesticated')
  }

  // ── Base stats ────────────────────────────────────────────────────────────────
  const base_stats_growth = parseCreatureStats(root)
  const hasStats = Object.values(base_stats_growth).some(s => s.base !== null)
  if (!hasStats) missing.push('base_stats_growth (all stats)')

  // ── Technical ─────────────────────────────────────────────────────────────────
  const entity_id    = entry.entity_id || extractEntityId(root)
  const drag_weight  = parseNum(getInfoValue(arkInfo, 'drag weight') ?? '')
  const cloneable    = getInfoBool(arkInfo, 'cloneable')

  if (!entity_id) missing.push('entity_id')

  // ── Taming ────────────────────────────────────────────────────────────────────
  const tamingMethod = getInfoValue(arkInfo, 'taming method', 'taming')
  const preferredFood = getInfoValue(arkInfo, 'preferred food')
  // Infer kibble from preferred food name
  let kibble: string | null = null
  if (preferredFood) {
    const m = preferredFood.match(/^(\w+)\s+Kibble$/i)
    if (m) kibble = m[1]
  }
  const taming = entry.tameable ? { method: tamingMethod, kibble } : null
  if (entry.tameable && !tamingMethod) missing.push('taming.method')

  // ── Saddle ────────────────────────────────────────────────────────────────────
  let saddle: Array<{ name: string | null; engram_level: number | null }> | null = null
  if (entry.rideable) {
    const saddleName  = getInfoValue(arkInfo, 'equipment', 'saddle') ?? null
    const saddleLevel = entry.saddle_level
    if (saddleName || saddleLevel !== null) {
      saddle = [{ name: saddleName, engram_level: saddleLevel }]
    } else {
      missing.push('saddle')
    }
  }

  // ── Egg / Breeding ────────────────────────────────────────────────────────────
  // Egg data is very complex — mark as needing manual population
  const egg: null = null
  if (entry.breedable) missing.push('egg (incubation temps, times, maturation)')

  const data: Record<string, unknown> = {
    name: entry.name, category, dossier,
    base_stats_growth,
    tameable: entry.tameable, rideable: entry.rideable, breedable: entry.breedable,
    taming, saddle: saddle ?? null, rider_weaponry: false,
    egg, drag_weight, cloneable, entity_id,
  }

  return { data, missing }
}

async function scrapeCreatures(overwrite: boolean): Promise<ScrapeStats> {
  const stats: ScrapeStats = { total: 0, complete: 0, incomplete: 0, skipped: 0, images: 0 }
  const entries = await fetchCreatureList()
  if (!entries.length) { fail('No creatures found'); return stats }
  log(`\nFound ${entries.length} creatures. Scraping…\n`)

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    process.stdout.write(`  [${i + 1}/${entries.length}] ${entry.name}… `)
    stats.total++

    const { data, missing } = await scrapeCreature(entry)
    const finalMissing = validateAndMerge(CreatureSchema, data, missing)

    const { saved, complete } = saveEntity('creatures', entry.slug, data, finalMissing, overwrite)
    if (!saved) { process.stdout.write('skipped\n'); stats.skipped++; continue }

    // Image — re-use the already fetched page by passing root
    const root = await fetchPage(entry.name)
    if (root) {
      const url = extractCreatureImage(root)
      if (url) { const ok2 = await saveImage('creatures', entry.slug, url); if (ok2) stats.images++ }
    }

    if (complete) { process.stdout.write('complete\n'); stats.complete++ }
    else { process.stdout.write(`incomplete (${finalMissing.length} fields)\n`); stats.incomplete++ }
  }
  return stats
}

// ─── RESOURCE SCRAPER ──────────────────────────────────────────────────────────

interface ResourceListEntry {
  name: string; slug: string
  rarity: 'common' | 'uncommon' | 'rare'
  renewable: boolean; refinable: boolean; combustible: boolean
}

async function fetchResourceList(): Promise<ResourceListEntry[]> {
  info('Fetching resource list…')
  const root = await fetchPage('Resources')
  if (!root) return []

  const table = root.querySelector('table.cargo-item-table')
  if (!table) { fail('Could not find cargo-item-table on Resources page'); return [] }

  const entries: ResourceListEntry[] = []
  for (const row of table.querySelectorAll('tr:not(:first-child)')) {
    const cells = row.querySelectorAll('td')
    if (cells.length < 5) continue

    const link = cells[0].querySelector('a[href^="/wiki/"]')
    if (!link) continue
    const name = link.getAttribute('title') || clean(link)
    if (!name) continue
    const slug = slugify(name)

    const rarityText = clean(cells[1]).toLowerCase().trim()
    const rarity: 'common' | 'uncommon' | 'rare' =
      rarityText === 'rare' ? 'rare' : rarityText === 'uncommon' ? 'uncommon' : 'common'

    entries.push({
      name, slug, rarity,
      renewable: hasCheckmark(cells[2]),
      refinable: hasCheckmark(cells[3]),
      combustible: hasCheckmark(cells[4]),
    })
  }
  return entries
}

async function scrapeResource(entry: ResourceListEntry): Promise<{ data: Record<string, unknown>; missing: string[] }> {
  const root = await fetchPage(entry.name)
  const missing: string[] = []

  if (!root) {
    return {
      data: { name: entry.name, rarity: entry.rarity, renewable: entry.renewable,
              refinable: entry.refinable, combustible: entry.combustible,
              weight: 0, stack_size: 100, found_in: [] },
      missing: ['weight', 'stack_size', 'found_in (page fetch failed)'],
    }
  }

  const arkInfo = parseArkInfo(root)

  const weight    = parseNum(getInfoValue(arkInfo, 'weight') ?? '')
  const stackSize = parseIntNum(getInfoValue(arkInfo, 'stack size', 'stack') ?? '')

  if (weight === null)    missing.push('weight')
  if (stackSize === null) missing.push('stack_size')

  // "Found in" — look for harvested from / drops from text
  const found_in: string[] = []
  const foundInVal = getInfoValue(arkInfo, 'found in', 'drops from', 'gathered from', 'obtained from')
  if (foundInVal) {
    found_in.push(...foundInVal.split(/[,;\/]/).map(s => s.trim()).filter(Boolean))
  }
  // Check categories for biome info
  if (!found_in.length) {
    for (const cat of root.querySelectorAll('#mw-normal-catlinks a')) {
      const t = cat.text.trim()
      if (t && !/^(Category|Resources|Items)/i.test(t) && !t.includes('ARK')) {
        found_in.push(t)
      }
    }
  }
  if (!found_in.length) missing.push('found_in')

  // Hexagon exchange
  let hexagon_exchange: { exchange_yields: number; hexagons: number } | null = null
  const hexVal = getInfoValue(arkInfo, 'hexagon', 'hexagons')
  if (hexVal) {
    const hexNum = parseIntNum(hexVal.replace(/,/g, ''))
    if (hexNum !== null) hexagon_exchange = { exchange_yields: 1, hexagons: hexNum }
  }

  return {
    data: {
      name: entry.name, rarity: entry.rarity,
      renewable: entry.renewable, refinable: entry.refinable, combustible: entry.combustible,
      weight: weight ?? 0, stack_size: stackSize ?? 100,
      found_in, ...(hexagon_exchange ? { hexagon_exchange } : {}),
    },
    missing,
  }
}

async function scrapeResources(overwrite: boolean): Promise<ScrapeStats> {
  const stats: ScrapeStats = { total: 0, complete: 0, incomplete: 0, skipped: 0, images: 0 }
  const entries = await fetchResourceList()
  if (!entries.length) { fail('No resources found'); return stats }
  log(`\nFound ${entries.length} resources. Scraping…\n`)

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    process.stdout.write(`  [${i + 1}/${entries.length}] ${entry.name}… `)
    stats.total++

    const { data, missing } = await scrapeResource(entry)
    const finalMissing = validateAndMerge(ResourceSchema, data, missing)

    const { saved, complete } = saveEntity('resources', entry.slug, data, finalMissing, overwrite)
    if (!saved) { process.stdout.write('skipped\n'); stats.skipped++; continue }

    const root = await fetchPage(entry.name)
    if (root) {
      const url = extractItemImage(root)
      if (url) { const ok2 = await saveImage('resources', entry.slug, url); if (ok2) stats.images++ }
    }

    if (complete) { process.stdout.write('complete\n'); stats.complete++ }
    else { process.stdout.write(`incomplete (${finalMissing.length})\n`); stats.incomplete++ }
  }
  return stats
}

// ─── ARMOR SCRAPER ─────────────────────────────────────────────────────────────

interface ArmorListEntry {
  name: string; slug: string
  unlock_level: number | null; armor_rating: number
  cold_protection: number; heat_protection: number
  weight: number; durability: number | null
  found_in: string[]
  ingredients: Ingredient[]
}

async function fetchArmorList(): Promise<ArmorListEntry[]> {
  info('Fetching armor list…')
  const root = await fetchPage('Armor')
  if (!root) return []

  // The armor list has a nice sortable wikitable with all data
  // Columns: Armor Type | Unlock Level | Armor rating | Cold | Heat | Weight | Durability | Found in | Ingredients
  const table = root.querySelector('table.wikitable.sortable')
  if (!table) { fail('Could not find armor table on Armor page'); return [] }

  const entries: ArmorListEntry[] = []
  for (const row of table.querySelectorAll('tr:not(:first-child)')) {
    const cells = row.querySelectorAll('td')
    if (cells.length < 8) continue

    const link = cells[0].querySelector('a[href^="/wiki/"]')
    if (!link) continue
    const name = link.getAttribute('title') || clean(link)
    if (!name) continue
    const slug = slugify(name)

    const unlock_level     = parseIntNum(clean(cells[1]))
    const armor_rating     = parseNum(clean(cells[2])) ?? 0
    const cold_protection  = parseNum(clean(cells[3])) ?? 0
    const heat_protection  = parseNum(clean(cells[4])) ?? 0
    const weight           = parseNum(clean(cells[5])) ?? 0
    const durability       = parseNum(clean(cells[6]))
    const found_in_text    = clean(cells[7])
    const found_in         = found_in_text ? [found_in_text] : []

    // Ingredients cell: "N × ItemName, M × ItemName2"
    const ingredients: Ingredient[] = []
    for (const link of cells[8]?.querySelectorAll('a') ?? []) {
      const itemName = link.getAttribute('title') || clean(link)
      if (!itemName || itemName.includes('Supply')) continue
      // Find preceding text for quantity
      const parentText = clean(link.closest('td, div, li') ?? link)
      const m = parentText.match(/(\d+)\s*[×x]\s*/)
      if (m) {
        ingredients.push({ name: itemName, quantity: parseInt(m[1], 10), resource_id: slugify(itemName) })
      }
    }
    // Fallback: parse full cell text "145 × Fiber, 10 × Hide"
    if (!ingredients.length && cells[8]) {
      const cellText = clean(cells[8])
      for (const part of cellText.split(',')) {
        const m = part.trim().match(/^(\d+)\s*[×x]\s*(.+)/)
        if (m) {
          ingredients.push({ name: m[2].trim(), quantity: parseInt(m[1], 10), resource_id: slugify(m[2].trim()) })
        }
      }
    }

    entries.push({ name, slug, unlock_level, armor_rating, cold_protection, heat_protection, weight, durability, found_in, ingredients })
  }
  return entries
}

async function scrapeArmor(overwrite: boolean): Promise<ScrapeStats> {
  const stats: ScrapeStats = { total: 0, complete: 0, incomplete: 0, skipped: 0, images: 0 }
  const entries = await fetchArmorList()
  if (!entries.length) { fail('No armor entries found'); return stats }
  log(`\nFound ${entries.length} armor sets. Scraping images…\n`)

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    process.stdout.write(`  [${i + 1}/${entries.length}] ${entry.name}… `)
    stats.total++

    const missing: string[] = []
    if (entry.armor_rating === 0) missing.push('armor_rating')
    if (!entry.ingredients.length) missing.push('set_ingredients')

    const data: Record<string, unknown> = {
      set_name: entry.name,
      unlock_level: entry.unlock_level,
      engram_points: null,           // not on list page, mark incomplete
      armor_rating: entry.armor_rating,
      cold_protection: entry.cold_protection,
      heat_protection: entry.heat_protection,
      weight: entry.weight,
      durability: entry.durability,
      found_in: entry.found_in,
      set_ingredients: entry.ingredients,
    }
    if (data.engram_points === null) missing.push('engram_points')

    // Fetch individual page for engram_points + image
    const root = await fetchPage(entry.name)
    if (root) {
      const arkInfo = parseArkInfo(root)
      const ep = parseIntNum(getInfoValue(arkInfo, 'engram points', 'ep') ?? '')
      if (ep !== null) { data.engram_points = ep; missing.splice(missing.indexOf('engram_points'), 1) }

      const url = extractItemImage(root)
      if (url) { const ok2 = await saveImage('armor', entry.slug, url); if (ok2) stats.images++ }
    }

    const finalMissing = validateAndMerge(ArmorSchema, data, missing)
    const { saved, complete } = saveEntity('armor', entry.slug, data, finalMissing, overwrite)
    if (!saved) { process.stdout.write('skipped\n'); stats.skipped++; continue }

    if (complete) { process.stdout.write('complete\n'); stats.complete++ }
    else { process.stdout.write(`incomplete (${finalMissing.length})\n`); stats.incomplete++ }
  }
  return stats
}

// ─── WEAPON SCRAPER ────────────────────────────────────────────────────────────

interface WeaponListEntry { name: string; slug: string; category: string }

const NAVBOX_CATEGORY_MAP: Record<string, string> = {
  'melee': 'melee', 'tools': 'tool', 'tool': 'tool',
  'ranged': 'ranged', 'primitive': 'ranged', 'firearms': 'firearm',
  'explosives': 'explosive', 'explosive': 'explosive',
  'attachments': 'attachment', 'attachment': 'attachment',
  'tek': 'tek', 'shields': 'shield', 'turrets': 'turret',
}

async function fetchWeaponList(): Promise<WeaponListEntry[]> {
  info('Fetching weapon list…')
  const root = await fetchPage('Weapons')
  if (!root) return []

  const entries: WeaponListEntry[] = []
  const seen = new Set<string>()

  // Extract from the navbox which has weapons grouped by category
  for (const navGroup of root.querySelectorAll('th.navbox-group')) {
    const groupText = clean(navGroup).toLowerCase().replace(/[^a-z]/g, '')
    const category = NAVBOX_CATEGORY_MAP[groupText] ?? 'tool'

    // Get the sibling td.navbox-list
    const listCell = navGroup.nextElementSibling
    if (!listCell) continue

    // Also handle sub-groups (Primitive/Firearms/Attachments under Ranged)
    for (const link of listCell.querySelectorAll('a[href^="/wiki/"]')) {
      const href  = link.getAttribute('href') ?? ''
      const title = link.getAttribute('title') || clean(link)
      if (!title || href.includes(':') || seen.has(href)) continue
      // Skip non-weapon links
      if (/^(Category|Template|ARK|Ammunition|Ammo)/i.test(title)) continue
      seen.add(href)
      const slug = slugify(title)
      if (slug) entries.push({ name: title, slug, category })
    }
  }

  // If navbox didn't work, fallback to page section links
  if (!entries.length) {
    for (const link of root.querySelectorAll('#mw-content-text a[href^="/wiki/"]')) {
      const href  = link.getAttribute('href') ?? ''
      const title = link.getAttribute('title') || clean(link)
      if (!title || href.includes(':') || seen.has(href)) continue
      if (/^(Weapons|Category|Ammo|Patch|ARK|Template)/i.test(title)) continue
      seen.add(href)
      const slug = slugify(title)
      if (slug) entries.push({ name: title, slug, category: 'tool' })
    }
  }

  return entries
}

async function scrapeWeapon(entry: WeaponListEntry): Promise<{ data: Record<string, unknown>; missing: string[] }> {
  const root = await fetchPage(entry.name)
  const missing: string[] = []

  if (!root) {
    return {
      data: { name: entry.name, category: entry.category, damage: null, unlock_level: null,
              engram_points: null, ammo_type: null, ingredients: [] },
      missing: ['ALL (page fetch failed)'],
    }
  }

  const arkInfo = parseArkInfo(root)

  // Damage
  const damageRaw = getInfoValue(arkInfo, 'melee damage', 'damage', 'base damage')
  const damage = damageRaw ? parseNum(damageRaw) : null

  // Level and engram points
  const levelRaw = getInfoValue(arkInfo, 'required level', 'unlock level', 'engram level')
  const unlock_level = levelRaw ? parseIntNum(levelRaw.replace(/level/i, '').trim()) : null
  const epRaw = getInfoValue(arkInfo, 'engram points', 'ep')
  const engram_points = epRaw ? parseIntNum(epRaw) : null

  // Ammo
  const ammo_type = getInfoValue(arkInfo, 'ammo type', 'ammo', 'uses ammo') ?? null

  // Infer category from page if possible
  const typeRaw = getInfoValue(arkInfo, 'type') ?? ''
  let category = entry.category
  if (/tool/i.test(typeRaw)) category = 'tool'
  else if (/melee/i.test(typeRaw)) category = 'melee'
  else if (/ranged/i.test(typeRaw)) category = 'ranged'
  else if (/firearm|gun|rifle|pistol|shotgun/i.test(typeRaw)) category = 'firearm'
  else if (/explosive|grenade|rocket/i.test(typeRaw)) category = 'explosive'
  else if (/tek/i.test(typeRaw)) category = 'tek'
  else if (/shield/i.test(typeRaw)) category = 'shield'
  else if (/turret/i.test(typeRaw)) category = 'turret'
  else if (/attachment/i.test(typeRaw)) category = 'attachment'

  const ingredients = parseIngredients(root)
  if (!ingredients.length) missing.push('ingredients')

  return {
    data: { name: entry.name, category, damage, unlock_level, engram_points, ammo_type, ingredients },
    missing,
  }
}

async function scrapeWeapons(overwrite: boolean): Promise<ScrapeStats> {
  const stats: ScrapeStats = { total: 0, complete: 0, incomplete: 0, skipped: 0, images: 0 }
  const entries = await fetchWeaponList()
  if (!entries.length) { fail('No weapons found'); return stats }
  log(`\nFound ${entries.length} weapons. Scraping…\n`)

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    process.stdout.write(`  [${i + 1}/${entries.length}] ${entry.name}… `)
    stats.total++

    const { data, missing } = await scrapeWeapon(entry)
    const finalMissing = validateAndMerge(WeaponSchema, data, missing)

    const { saved, complete } = saveEntity('weapons', entry.slug, data, finalMissing, overwrite)
    if (!saved) { process.stdout.write('skipped\n'); stats.skipped++; continue }

    const root = await fetchPage(entry.name)
    if (root) {
      const url = extractItemImage(root)
      if (url) { const ok2 = await saveImage('weapons', entry.slug, url); if (ok2) stats.images++ }
    }

    if (complete) { process.stdout.write('complete\n'); stats.complete++ }
    else { process.stdout.write(`incomplete (${finalMissing.length})\n`); stats.incomplete++ }
  }
  return stats
}

// ─── Single entity scrape ──────────────────────────────────────────────────────

async function scrapeSingle(type: string, nameInput: string, overwrite: boolean) {
  const name = nameInput.replace(/_/g, ' ').trim()
  const slug = slugify(name)
  log(`\nScraping ${type}: "${name}" (slug: ${slug})\n`)

  let data: Record<string, unknown>
  let missing: string[]
  let schema: ZodSchema
  let imageUrl: string | null = null

  const root = await fetchPage(name)

  if (type === 'creatures') {
    const fakeEntry: CreatureListEntry = {
      name, slug, diet: '', temperament: '',
      tameable: false, rideable: false, breedable: false,
      saddle_level: null, entity_id: null,
    }
    if (root) {
      const info = parseArkInfo(root)
      fakeEntry.tameable  = getInfoBool(info, 'tameable')
      fakeEntry.rideable  = getInfoBool(info, 'rideable')
      fakeEntry.breedable = getInfoBool(info, 'breedable')
    }
    ;({ data, missing } = await scrapeCreature(fakeEntry))
    schema = CreatureSchema
    if (root) imageUrl = extractCreatureImage(root)
  } else if (type === 'resources') {
    const fakeEntry: ResourceListEntry = { name, slug, rarity: 'common', renewable: false, refinable: false, combustible: false }
    if (root) {
      const info = parseArkInfo(root)
      const rarityRaw = (getInfoValue(info, 'rarity') ?? '').toLowerCase()
      fakeEntry.rarity = rarityRaw === 'rare' ? 'rare' : rarityRaw === 'uncommon' ? 'uncommon' : 'common'
      fakeEntry.renewable  = getInfoBool(info, 'renewable')
      fakeEntry.refinable  = getInfoBool(info, 'refinable', 'refineable')
      fakeEntry.combustible = getInfoBool(info, 'combustible')
    }
    ;({ data, missing } = await scrapeResource(fakeEntry))
    schema = ResourceSchema
    if (root) imageUrl = extractItemImage(root)
  } else if (type === 'armor') {
    const fakeEntry: ArmorListEntry = {
      name, slug, unlock_level: null, armor_rating: 0,
      cold_protection: 0, heat_protection: 0, weight: 0, durability: null,
      found_in: [], ingredients: [],
    }
    if (root) {
      const info = parseArkInfo(root)
      fakeEntry.unlock_level    = parseIntNum(getInfoValue(info, 'required level', 'unlock level') ?? '')
      fakeEntry.armor_rating    = parseNum(getInfoValue(info, 'armor rating', 'armor') ?? '') ?? 0
      fakeEntry.cold_protection = parseNum(getInfoValue(info, 'cold protection') ?? '') ?? 0
      fakeEntry.heat_protection = parseNum(getInfoValue(info, 'heat protection') ?? '') ?? 0
      fakeEntry.weight          = parseNum(getInfoValue(info, 'weight') ?? '') ?? 0
      fakeEntry.durability      = parseNum(getInfoValue(info, 'durability') ?? '')
      fakeEntry.ingredients     = parseIngredients(root)
    }
    data = {
      set_name: name,
      unlock_level: fakeEntry.unlock_level,
      engram_points: root ? parseIntNum(getInfoValue(parseArkInfo(root), 'engram points') ?? '') : null,
      armor_rating: fakeEntry.armor_rating,
      cold_protection: fakeEntry.cold_protection,
      heat_protection: fakeEntry.heat_protection,
      weight: fakeEntry.weight,
      durability: fakeEntry.durability,
      found_in: fakeEntry.found_in,
      set_ingredients: fakeEntry.ingredients,
    }
    missing = []
    if (!fakeEntry.ingredients.length) missing.push('set_ingredients')
    schema = ArmorSchema
    if (root) imageUrl = extractItemImage(root)
  } else if (type === 'weapons') {
    const fakeEntry: WeaponListEntry = { name, slug, category: 'tool' }
    ;({ data, missing } = await scrapeWeapon(fakeEntry))
    schema = WeaponSchema
    if (root) imageUrl = extractItemImage(root)
  } else {
    fail(`Unknown type: ${type}`); return
  }

  const finalMissing = validateAndMerge(schema, data, missing)
  const { saved, complete } = saveEntity(type, slug, data, finalMissing, overwrite)

  if (imageUrl) await saveImage(type, slug, imageUrl)

  if (!saved) { warn('Skipped — file exists (run with overwrite=yes to force)'); return }
  if (complete) ok(`Saved to data/${type}/${slug}.json`)
  else {
    warn(`Saved incomplete to data/${type}/incomplete/${slug}.json`)
    for (const f of finalMissing) warn(`  - ${f}`)
  }
}

// ─── Summary ───────────────────────────────────────────────────────────────────

function printStats(label: string, s: ScrapeStats) {
  log(`\n── ${label} ────────────────────────────────────────`)
  log(`   Processed : ${s.total}`)
  log(`   Complete  : ${s.complete}`)
  log(`   Incomplete: ${s.incomplete}`)
  log(`   Skipped   : ${s.skipped}`)
  log(`   Images    : ${s.images}`)
  if (s.incomplete > 0) warn(`${s.incomplete} items need manual review in data/{type}/incomplete/`)
}

// ─── Main menu ─────────────────────────────────────────────────────────────────

async function main() {
  log('\n\x1b[1mGigasaurus — ARK Wiki Scraper\x1b[0m')
  log('────────────────────────────────────\n')

  const overwrite = await confirm('Overwrite existing files?')
  log('')
  log('What to scrape?')
  log('  1) Creatures')
  log('  2) Resources')
  log('  3) Armor')
  log('  4) Weapons')
  log('  5) All')
  log('  6) Single entity')
  log('  q) Quit')
  log('')

  const choice = (await ask('Choice: ')).trim().toLowerCase()
  log('')

  if (choice === 'q') { rl.close(); return }

  if (choice === '6') {
    log('Types: creatures, resources, armor, weapons')
    const type = (await ask('Type: ')).trim()
    const name = (await ask('Name: ')).trim()
    log('')
    await scrapeSingle(type, name, overwrite)
    rl.close()
    return
  }

  const runs = choice === '5'
    ? ['creatures', 'resources', 'armor', 'weapons'] as const
    : choice === '1' ? ['creatures'] as const
    : choice === '2' ? ['resources'] as const
    : choice === '3' ? ['armor'] as const
    : choice === '4' ? ['weapons'] as const
    : null

  if (!runs) { fail('Invalid choice'); rl.close(); return }

  const allStats: ScrapeStats[] = []
  for (const run of runs) {
    log(`── ${run.charAt(0).toUpperCase() + run.slice(1)} ──────────────────────────────────────────\n`)
    const s =
      run === 'creatures' ? await scrapeCreatures(overwrite) :
      run === 'resources' ? await scrapeResources(overwrite) :
      run === 'armor'     ? await scrapeArmor(overwrite)     :
                            await scrapeWeapons(overwrite)
    allStats.push(s)
    log('')
  }

  if (allStats.length > 1) {
    const total = allStats.reduce((a, b) => ({
      total: a.total + b.total, complete: a.complete + b.complete,
      incomplete: a.incomplete + b.incomplete, skipped: a.skipped + b.skipped,
      images: a.images + b.images,
    }))
    printStats('Overall', total)
  } else if (allStats.length === 1) {
    printStats('Results', allStats[0])
  }

  log('')
  rl.close()
}

main().catch(e => { fail(String(e)); rl.close(); process.exit(1) })
