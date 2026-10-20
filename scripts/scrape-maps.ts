#!/usr/bin/env bun
/**
 * scripts/scrape-maps.ts
 *
 * Builds data/maps/<slug>.json and public/images/world-maps/<slug>.jpg from the ARK
 * wiki's interactive DataMaps, then records on each data/resources entry which
 * maps it's found on.
 *
 * Sources per map (ASA data where the wiki has it, ASE otherwise):
 *   Data:Maps/Creature Spawns/<Map>[/ASA]  background image + pointer to…
 *   Data:Spawn Map/<Map>[/ASA]             spawn containers mined from the game
 *   Data:Maps/Resources/<Map>[/ASA]        resource node markers
 *   <Map> (article)                        infobox: release dates, content type
 *
 * Spawn coordinates are in-game lat/lon (0–100); a region's rarity (0 very
 * rare … 5 very common) uses the same formula as the wiki's spawn map gadget
 * (MediaWiki:Gadget-CreatureDataMaps.js).
 *
 * Resource maps: a resource whose wiki infobox has a `dlc` field is found on
 * those maps plus any map with its nodes; one without is in the base game and
 * found everywhere.
 *
 * Usage:
 *   bun scripts/scrape-maps.ts            # everything, keeping existing images
 *   bun scripts/scrape-maps.ts --images   # also re-download map images
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import sharp from 'sharp'
import { GameMapSchema, MAP_ORDER, type GameMap } from '../src/schemas/map'
import { articleDetails, places, regions } from './map-details'
import { download, fileUrls, infoboxFields, rawField, rawJson, slugify, stripMarkup, wikitextFor, WIKI } from './wiki-api'

const ROOT = join(import.meta.dir, '..')
const OUT_DIR = join(ROOT, 'data', 'maps')
const IMG_DIR = join(ROOT, 'public', 'images', 'world-maps')
const CREATURE_DIR = join(ROOT, 'data', 'creatures')
const RESOURCE_DIR = join(ROOT, 'data', 'resources')
const IMAGE_WIDTH = 2048

interface MapSource {
  name: (typeof MAP_ORDER)[number]
  /** Data:Maps/Creature Spawns/<spawns> — holds the background and spawn data pointer. */
  spawns: string
  /** Data:<resources> — resource node markers. */
  resources: string | null
}

const MAPS: MapSource[] = [
  { name: 'The Island', spawns: 'The Island/ASA', resources: 'Maps/Resources/The Island/ASA' },
  { name: 'The Center', spawns: 'The Center/ASA', resources: 'Maps/Resources/The Center' },
  { name: 'Scorched Earth', spawns: 'Scorched Earth/ASA', resources: 'Maps/Resources/Scorched Earth/ASA' },
  { name: 'Ragnarok', spawns: 'Ragnarok/ASA', resources: 'Maps/Resources/Ragnarok' },
  { name: 'Aberration', spawns: 'Aberration/ASA', resources: 'Maps/Resources/Aberration' },
  { name: 'Extinction', spawns: 'Extinction/ASA', resources: 'Maps/Resources/Extinction' },
  { name: 'Valguero', spawns: 'Valguero/ASA', resources: 'Maps/Resources/Valguero' },
  { name: 'Crystal Isles', spawns: 'Crystal Isles', resources: 'Maps/Resources/Crystal Isles' },
  { name: 'Genesis: Part 1', spawns: 'Genesis: Part 1/ASA', resources: 'Maps/Resources/Genesis: Part 1' },
  { name: 'Genesis: Part 2', spawns: 'Genesis: Part 2', resources: 'Maps/Resources/Genesis: Part 2' },
  { name: 'Lost Island', spawns: 'Lost Island', resources: 'Maps/Resources/Lost Island' },
  { name: 'Fjordur', spawns: 'Fjordur', resources: 'Maps/Resources/Fjordur' },
  // Astraeos has no resource data map; its exploration map marks the veins.
  { name: 'Astraeos', spawns: 'Astraeos/ASA', resources: 'Maps/Exploration/Astraeos/ASA' },
  { name: 'Lost Colony', spawns: 'Lost Colony', resources: 'Maps/Resources/Lost Colony/ASA' },
]

/** DataMaps marker group → display name and data/resources slug (null: not a tracked resource). */
const RESOURCE_GROUPS: Record<string, { name: string; resource: string | null }> = {
  'metal': { name: 'Metal', resource: 'metal' },
  'metal-rich': { name: 'Metal (rich)', resource: 'metal' },
  'crystal': { name: 'Crystal', resource: 'crystal' },
  'crystal-rich': { name: 'Crystal (rich)', resource: 'crystal' },
  'obsidian': { name: 'Obsidian', resource: 'obsidian' },
  'oil': { name: 'Oil', resource: 'oil' },
  'oil-rock': { name: 'Oil', resource: 'oil' },
  'oil-vein': { name: 'Oil Vein', resource: 'oil' },
  'silica': { name: 'Silica Pearls', resource: 'silica_pearls' },
  'black-pearl': { name: 'Black Pearl', resource: 'black_pearl' },
  'sulfur': { name: 'Sulfur', resource: 'sulfur' },
  'salt': { name: 'Raw Salt', resource: 'raw_salt' },
  'clay': { name: 'Clay', resource: 'clay' },
  'cactus': { name: 'Cactus Sap', resource: 'cactus_sap' },
  'silk': { name: 'Silk', resource: 'silk' },
  'keratin': { name: 'Keratin', resource: 'keratin' },
  'gem-blue': { name: 'Blue Gem', resource: 'blue_gem' },
  'gem-green': { name: 'Green Gem', resource: 'green_gem' },
  'gem-red': { name: 'Red Gem', resource: 'red_gem' },
  'element-ore': { name: 'Element Ore', resource: 'element_ore' },
  'element-shard': { name: 'Element Shard', resource: 'element_shard' },
  'element-dust': { name: 'Element Dust', resource: 'element_dust' },
  'organic-polymer': { name: 'Organic Polymer', resource: 'organic_polymer' },
  'ambergris': { name: 'Ambergris', resource: 'ambergris' },
  'gas': { name: 'Congealed Gas', resource: 'congealed_gas_ball' },
  'gas-vein': { name: 'Gas Vein', resource: 'condensed_gas' },
  'honey': { name: 'Honey', resource: 'giant_bee_honey' },
  'mutagel': { name: 'Mutagel', resource: 'mutagel' },
  'mutagen': { name: 'Mutagen Bulbs', resource: 'mutagen' },
  'water-vein': { name: 'Water Vein', resource: null },
  'charge-node': { name: 'Charge Node', resource: null },
  'rare-flower': { name: 'Rare Flower', resource: null },
  'mushroom': { name: 'Rare Mushroom', resource: null },
  'citronal': { name: 'Citronal', resource: null },
  'rockarrot': { name: 'Rockarrot', resource: null },
  'savoroot': { name: 'Savoroot', resource: null },
  'longrass': { name: 'Longrass', resource: null },
  'nameless-venom': { name: 'Nameless Venom', resource: null },
  'plant-r': { name: 'Plant Species R', resource: null },
  'plant-x': { name: 'Plant Species X', resource: null },
  'plant-y': { name: 'Plant Species Y', resource: null },
}

// ─── Wiki shapes ───────────────────────────────────────────────────────────────

interface DataMap {
  background?: string | { image: string }
  backgrounds?: { image: string }[]
  custom?: { creatureSpawnsPage?: string }
  include?: string[]
  groups?: Record<string, { name?: string }>
  markers?: Record<string, ({ x: number; y: number } | { lat: number; lon: number })[]>
}

/** One spawn container: weighted entries of NPC groups, and where it spawns. */
interface SpawnContainer {
  n: string
  e: { n: string; c: number; s: { n: string; c: number }[] }[]
  /** Spawners: `f` max count, `u` locally untameable, `l` [x, y] points or [x1, y1, x2, y2] boxes. */
  s: { f: number; u?: number; l: number[][] }[]
}

// ─── Creature names → slugs ────────────────────────────────────────────────────

function creatureLookup(): (name: string) => string | null {
  const byName = new Map<string, string>()
  for (const f of readdirSync(CREATURE_DIR).filter((f) => f.endsWith('.json'))) {
    const slug = f.replace('.json', '')
    const c = JSON.parse(readFileSync(join(CREATURE_DIR, f), 'utf-8')) as { name: string; alternate_names?: string[] }
    for (const n of [slug.replace(/_/g, ' '), c.name, ...(c.alternate_names ?? [])]) {
      const key = n.trim().toLowerCase()
      if (!byName.has(key)) byName.set(key, slug)
    }
  }
  for (const [name, slug] of Object.entries(SPAWN_ALIASES)) if (existsSync(join(CREATURE_DIR, `${slug}.json`))) byName.set(name, slug)
  return (name) => {
    const key = name.trim().toLowerCase()
    // Map-specific variants (Aberrant Dodo, X-Rex, R-Equus) are the same species as the base page.
    return byName.get(key) ?? byName.get(key.replace(/^(aberrant |x-|r-)/, '')) ?? null
  }
}

/** Spawn-table names for a species' wild form that differ from its page name. */
const SPAWN_ALIASES: Record<string, string> = {
  'giant queen bee': 'giant_bee',
  'reaper queen': 'reaper',
  'titanomyrma drone': 'titanomyrma',
  'titanomyrma soldier': 'titanomyrma',
  'water jug bug': 'jug_bug',
  'oil jug bug': 'jug_bug',
  'light bug': 'glowbug',
  'spring drakeling': 'drakeling',
  'summer drakeling': 'drakeling',
  'autumn drakeling': 'drakeling',
  'winter drakeling': 'drakeling',
}

// ─── Spawns ────────────────────────────────────────────────────────────────────

const round = (n: number) => Math.round(n * 100) / 100

function creatureSpawns(containers: SpawnContainer[], untameable: Set<string>, lookup: (n: string) => string | null) {
  const byName = new Map<string, { regions: Map<string, number[]>; points: Map<string, number[]>; tameable: boolean }>()

  for (const container of containers) {
    // Chance that one spawn from this container is each creature.
    const chance = new Map<string, number>()
    for (const entry of container.e) {
      for (const npc of entry.s) {
        const name = npc.n.trim()
        chance.set(name, (chance.get(name) ?? 0) + npc.c * entry.c)
      }
    }

    for (const [name, p] of chance) {
      if (p <= 0) continue
      const acc = byName.get(name) ?? { regions: new Map(), points: new Map(), tameable: false }
      byName.set(name, acc)
      for (const spawner of container.s) {
        const amount = p * spawner.f
        if (!spawner.u && !untameable.has(name)) acc.tameable = true
        for (const loc of spawner.l) {
          if (loc.length === 2) {
            const rarity = Math.min(5, Math.round(1.5 * Math.log(1 + 2 * amount)))
            const key = loc.join(',')
            const prev = acc.points.get(key)
            if (!prev || prev[2] < rarity) acc.points.set(key, [round(loc[0]), round(loc[1]), rarity])
          } else {
            const [x1, y1, x2, y2] = loc
            const area = Math.max(0.0001, (x2 - x1) * (y2 - y1))
            const rarity = Math.min(5, Math.round(1.5 * Math.log(1 + (50 * amount) / area)))
            const key = loc.join(',')
            const prev = acc.regions.get(key)
            if (!prev || prev[4] < rarity) acc.regions.set(key, [round(x1), round(y1), round(x2), round(y2), rarity])
          }
        }
      }
    }
  }

  return [...byName]
    .map(([name, acc]) => ({
      name,
      creature: lookup(name),
      tameable: acc.tameable,
      regions: [...acc.regions.values()] as [number, number, number, number, number][],
      points: [...acc.points.values()] as [number, number, number][],
    }))
    .filter((c) => c.regions.length || c.points.length)
    .sort((a, b) => a.name.localeCompare(b.name))
}

// ─── Resources ─────────────────────────────────────────────────────────────────

function resourceNodes(markers: NonNullable<DataMap['markers']>) {
  const groups = new Map<string, { nodes: [number, number][]; cave_nodes: [number, number][] }>()
  for (const [key, list] of Object.entries(markers)) {
    const [base, ...mods] = key.split(' ')
    if (!RESOURCE_GROUPS[base]) continue
    const acc = groups.get(base) ?? { nodes: [], cave_nodes: [] }
    groups.set(base, acc)
    const target = mods.includes('cave') ? acc.cave_nodes : acc.nodes
    for (const m of list) {
      const [x, y] = 'lon' in m ? [m.lon, m.lat] : [m.x, m.y]
      target.push([round(x), round(y)])
    }
  }
  return [...groups]
    .map(([key, g]) => ({ key, ...RESOURCE_GROUPS[key], ...g }))
    .sort((a, b) => b.nodes.length + b.cave_nodes.length - (a.nodes.length + a.cave_nodes.length))
}

// ─── Map article ───────────────────────────────────────────────────────────────

function releaseDates(raw: string | null): { ase: string | null; asa: string | null } {
  const out = { ase: null as string | null, asa: null as string | null }
  if (!raw) return out
  for (const part of raw.split(/<br\s*\/?>/i)) {
    const text = stripMarkup(part)
    if (!text) continue
    if (/Survival Ascended/.test(part)) out.asa = text
    else out.ase = text
  }
  return out
}

/** First prose paragraph after the infobox. */
function lead(wikitext: string): string | null {
  const paragraphs = wikitext
    .replace(/\{\{[\s\S]*?\}\}\n/g, (m) => (m.split('{{').length > 2 ? '' : m))
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.startsWith("'''") || (/^[A-Z]/.test(p) && !p.startsWith('{{')))
  const first = paragraphs[0]
  return first ? stripMarkup(first.replace(/\{\{gamelink\|se\}\}/gi, 'ARK: Survival Evolved').replace(/\{\{gamelink\|sa\}\}/gi, 'ARK: Survival Ascended')) : null
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const forceImages = process.argv.includes('--images')
  const lookup = creatureLookup()

  const shared = await rawJson<{ GeneralUntamability: Record<string, number> }>('Data:Spawn Map/Shared')
  const untameable = new Set(Object.keys(shared?.GeneralUntamability ?? {}))
  const articles = await wikitextFor(MAPS.map((m) => m.name))

  mkdirSync(OUT_DIR, { recursive: true })
  const backgrounds = new Map<string, string>()
  const resourceMaps = new Map<string, Set<string>>()

  for (const src of MAPS) {
    const slug = slugify(src.name)
    process.stdout.write(`${src.name}… `)

    const spawnMap = await rawJson<DataMap>(`Data:Maps/Creature Spawns/${src.spawns}`)
    const spawnPage = spawnMap?.custom?.creatureSpawnsPage?.replace(/^en:/, '')
    const containers = spawnPage ? await rawJson<SpawnContainer[]>(spawnPage) : null
    const resMap = src.resources ? await rawJson<DataMap>(`Data:${src.resources}`) : null

    const bg = spawnMap?.backgrounds?.[0]?.image
      ?? (typeof spawnMap?.background === 'string' ? spawnMap.background : spawnMap?.background?.image)
      ?? resMap?.backgrounds?.[0]?.image
      ?? (typeof resMap?.background === 'string' ? resMap.background : resMap?.background?.image)
    if (bg) backgrounds.set(slug, bg)

    // Ascended exploration map: caves, artifacts, notes and player spawn zones.
    const exploration = src.spawns.endsWith('/ASA') ? await rawJson<DataMap>(`Data:Maps/Exploration/${src.spawns}`) : null

    const article = articles.get(src.name) ?? ''
    const info = infoboxFields(article, 'dlc') ?? {}
    const resources = resMap?.markers ? resourceNodes(resMap.markers) : []
    for (const r of resources) {
      if (!r.resource) continue
      const set = resourceMaps.get(r.resource) ?? new Set()
      set.add(src.name)
      resourceMaps.set(r.resource, set)
    }

    const data: GameMap = {
      name: src.name,
      content_type: info.contenttype || null,
      release: releaseDates(rawField(article, 'release_date')),
      summary: lead(article),
      level_name: info.levelname_asa || info.levelname || null,
      ...articleDetails(article),
      regions: await regions(src.name),
      ...(await places([spawnMap, resMap, exploration])),
      wiki_url: `${WIKI}/wiki/${encodeURIComponent(src.name.replace(/ /g, '_'))}`,
      spawn_data: src.spawns.endsWith('/ASA') ? 'ASA' : 'ASE',
      resource_data: !resMap ? null : src.resources!.endsWith('/ASA') ? 'ASA' : 'ASE',
      creatures: containers ? creatureSpawns(containers, untameable, lookup) : [],
      resources: resources.map(({ key, name, resource, nodes, cave_nodes }) => ({ key, name, resource, nodes, cave_nodes })),
    }
    const parsed = GameMapSchema.safeParse(data)
    if (!parsed.success) {
      console.log('INVALID', parsed.error.flatten().fieldErrors)
      continue
    }
    writeFileSync(join(OUT_DIR, `${slug}.json`), JSON.stringify(parsed.data) + '\n')
    const unmatched = data.creatures.filter((c) => !c.creature).length
    console.log(`${data.creatures.length} creatures (${unmatched} without a page), ${data.resources.length} resource layers, ${data.regions.length} regions, ${data.caves.length} caves, ${data.roster.length} roster groups`)
  }

  // Map art, scaled down from the wiki's full-size originals.
  const needImages = [...backgrounds].filter(([slug]) => forceImages || !existsSync(join(IMG_DIR, `${slug}.jpg`)))
  if (needImages.length) {
    console.log(`Downloading ${needImages.length} map images…`)
    const urls = await fileUrls(needImages.map(([, file]) => file), IMAGE_WIDTH)
    for (const [slug, file] of needImages) {
      const url = urls.get(file)
      const dest = join(IMG_DIR, `${slug}.jpg`)
      if (!url || !(await download(url, dest))) { console.log(`  no image for ${slug} (${file})`); continue }
      // The wiki serves some originals unscaled at several MB; normalize to IMAGE_WIDTH, q80.
      const jpeg = await sharp(dest).resize({ width: IMAGE_WIDTH, withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toBuffer()
      writeFileSync(dest, jpeg)
    }
  }

  await writeResourceMaps(resourceMaps)
}

/** Normalizes infobox `dlc` text ("Genesis: Part 1, Fjordur") to MAP_ORDER names. */
function mapsInText(text: string): string[] {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const t = norm(text)
  return MAP_ORDER.filter((m) => t.includes(norm(m)))
}

async function writeResourceMaps(fromNodes: Map<string, Set<string>>) {
  const files = readdirSync(RESOURCE_DIR).filter((f) => f.endsWith('.json'))
  const names = new Map(
    files.map((f) => [f.replace('.json', ''), (JSON.parse(readFileSync(join(RESOURCE_DIR, f), 'utf-8')) as { name: string }).name]),
  )
  const pages = await wikitextFor([...names.values()])

  console.log('Resource maps:')
  for (const f of files) {
    const slug = f.replace('.json', '')
    const name = names.get(slug)!
    const dlc = infoboxFields(pages.get(name) ?? '', 'resource')?.dlc
    const nodeMaps = fromNodes.get(slug) ?? new Set<string>()
    const restricted = dlc ? mapsInText(dlc) : []
    const maps = restricted.length
      ? MAP_ORDER.filter((m) => restricted.includes(m) || nodeMaps.has(m))
      : [...MAP_ORDER]

    // Insert/replace a one-line "maps" field so the rest of the hand-formatted file is untouched.
    const path = join(RESOURCE_DIR, f)
    const line = `    "maps": ${JSON.stringify(maps).replace(/","/g, '", "')}`
    let text = readFileSync(path, 'utf-8').replace(/,?\n\s*"maps":\s*\[[^\]]*\]/, '')
    text = text.replace(/\n}\s*$/, `,\n${line}\n}\n`)
    JSON.parse(text)
    writeFileSync(path, text)
    console.log(`  ${slug}: ${maps.length === MAP_ORDER.length ? 'all maps' : maps.join(', ') || 'none'}`)
  }
}

main()
