#!/usr/bin/env bun
/**
 * scripts/scrape-saddles.ts
 *
 * Builds data/saddles/<slug>.json and public/images/saddles/<slug>.{png,webp} from the
 * ARK wiki:
 *   - every page in Category:Saddles with an `{{infobox armor}}` gives the
 *     saddle's stats, engram and recipe;
 *   - each creature page's `| equipment =` field says which saddles it wears,
 *     which is how saddles are linked to data/creatures slugs.
 *
 * Usage:
 *   bun scripts/scrape-saddles.ts                # data + missing images
 *   bun scripts/scrape-saddles.ts --images       # re-download every image
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { SaddleSchema, type Saddle } from '../src/schemas/saddle'
import { apiGet, download, fileUrls, infoboxFields, num, rawField, slugify, stripMarkup, wikitextFor, WIKI } from './wiki-api'

const ROOT = join(import.meta.dir, '..')
const CREATURE_DIR = join(ROOT, 'data', 'creatures')
const OUT_DIR = join(ROOT, 'data', 'saddles')
const IMG_DIR = join(ROOT, 'public', 'images', 'saddles')

/** Category members that are overview pages or not creature gear. */
const SKIP = new Set(['Saddles', 'Tek Saddles', 'Platform Saddles', 'Platform Cart'])

async function categoryMembers(category: string): Promise<string[]> {
  const json = await apiGet<{ query: { categorymembers: { title: string; ns: number }[] } }>({
    action: 'query',
    list: 'categorymembers',
    cmtitle: `Category:${category}`,
    cmlimit: '500',
  })
  return json.query.categorymembers.filter((m) => m.ns === 0).map((m) => m.title)
}

/**
 * Wiki title → creature slugs, plus fallbacks for saddles no creature page lists:
 * lowercased name/alternate name → slug, and each creature's previously scraped
 * saddle text ("Mosasaur Saddle (Level 78) Mosasaur Platform Saddle …").
 */
function creatureIndex() {
  const byTitle = new Map<string, string[]>()
  const byName = new Map<string, string>()
  const saddleText = new Map<string, string>()
  for (const f of readdirSync(CREATURE_DIR).filter((f) => f.endsWith('.json'))) {
    const slug = f.replace('.json', '')
    const c = JSON.parse(readFileSync(join(CREATURE_DIR, f), 'utf-8')) as {
      name: string
      alternate_names?: string[]
      wiki_url?: string | null
      saddle?: { name: string | null } | { name: string | null }[] | null
    }
    const legacy = [c.saddle ?? []].flat().map((e) => e.name ?? '').join(' ')
    if (legacy) saddleText.set(slug, legacy)
    const title = decodeURIComponent(c.wiki_url?.split('/wiki/')[1] ?? c.name).replace(/_/g, ' ')
    byTitle.set(title, [...(byTitle.get(title) ?? []), slug])
    for (const n of [c.name, ...(c.alternate_names ?? [])]) {
      const key = n.toLowerCase()
      if (!byName.has(key)) byName.set(key, slug)
    }
  }
  return { byTitle, byName, saddleText }
}

function ingredients(fields: Record<string, string>) {
  const out: { name: string; quantity: number }[] = []
  for (let i = 1; i <= 12; i++) {
    const name = fields[`ingredient${i}`]
    const quantity = num(fields[`quantity${i}`])
    if (name && quantity != null) out.push({ name, quantity })
  }
  return out
}

function craftedIn(fields: Record<string, string>) {
  return Object.keys(fields)
    .filter((k) => /^craftedin\d*$/.test(k) && fields[k])
    .sort((a, b) => (parseInt(a.slice(9)) || 1) - (parseInt(b.slice(9)) || 1))
    .map((k) => fields[k])
}

async function main() {
  const forceImages = process.argv.includes('--images')
  const { byTitle, byName, saddleText } = creatureIndex()

  console.log('Listing saddles…')
  const [all, tek, platform] = await Promise.all([
    categoryMembers('Saddles'),
    categoryMembers('Tek Saddles'),
    categoryMembers('Platform Saddles'),
  ])
  const titles = all.filter((t) => !SKIP.has(t))
  const tekSet = new Set(tek)
  const platformSet = new Set(platform)

  console.log(`Fetching ${titles.length} saddle pages…`)
  const saddlePages = await wikitextFor(titles)

  console.log(`Fetching ${byTitle.size} creature pages for their equipment…`)
  const creaturePages = await wikitextFor([...byTitle.keys()])
  const wornBy = new Map<string, Set<string>>()
  for (const [title, text] of creaturePages) {
    const line = rawField(text, 'equipment')
    if (!line) continue
    for (const item of stripMarkup(line).split(/\s*,\s*/).filter(Boolean)) {
      const set = wornBy.get(item) ?? new Set()
      for (const slug of byTitle.get(title) ?? []) set.add(slug)
      wornBy.set(item, set)
    }
  }

  const saddles: (Omit<Saddle, 'image_file'> & { slug: string; wiki_image: string })[] = []
  const unlinked: string[] = []
  for (const title of titles) {
    const text = saddlePages.get(title)
    const fields = text && infoboxFields(text, 'armor')
    if (!fields) { console.log(`  skip ${title}: no armor infobox`); continue }

    let creatures = [...(wornBy.get(title) ?? [])]
    if (!creatures.length) {
      // Some creature pages leave `equipment` empty. Try the creature linked in the
      // description ("Equip a [[T-Rex]] with this…"), then the saddle's name prefix.
      const raw = rawField(text!, 'description') ?? ''
      const candidates = [
        ...[...raw.matchAll(/\[\[([^|\]]+)(?:\|[^\]]*)?\]\]|\{\{ItemLink\|([^|}]+)/g)].map((m) => m[1] ?? m[2]),
        title.replace(/\s+(Tek |Platform |Submarine )?Saddle$/, ''),
      ]
      for (const name of candidates) {
        const slug = byName.get(name.trim().toLowerCase()) ?? byTitle.get(name.trim())?.[0]
        if (slug) { creatures = [slug]; break }
      }
    }
    if (!creatures.length) {
      const pattern = new RegExp(`(^|\\)\\s)${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s\\(|\\s*$)`)
      creatures = [...saddleText].filter(([, text]) => pattern.test(text)).map(([slug]) => slug)
    }
    if (!creatures.length) unlinked.push(title)

    const isTek = tekSet.has(title) || /\bTek\b/.test(title)
    const saddle: Omit<Saddle, 'image_file'> = {
      name: fields.name || title,
      description: fields.description || null,
      creatures: creatures.sort(),
      tek: isTek,
      platform: platformSet.has(title) || /\bPlatform\b/.test(title),
      armor: num(fields.armorrating),
      weight: num(fields.weight),
      engram_level: isTek ? null : num(fields.requiredlevel),
      engram_points: num(fields.engrampoints),
      crafting_xp: num(fields.craftingxp),
      crafting_time: num(fields.craftingtime),
      crafted_in: craftedIn(fields),
      ingredients: ingredients(fields),
      blueprint: fields.blueprintpath?.replace(/^"|"$/g, '') || null,
      wiki_url: `${WIKI}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    }
    const parsed = SaddleSchema.omit({ image_file: true }).safeParse(saddle)
    if (!parsed.success) { console.log(`  invalid ${title}:`, parsed.error.flatten().fieldErrors); continue }
    saddles.push({ ...parsed.data, slug: slugify(title), wiki_image: fields.image || `${title}.png` })
  }

  // Keep the wiki's format (a few are .webp).
  const imageExt = (file: string) => (/\.(png|jpg|webp)$/i.exec(file)?.[1] ?? 'png').toLowerCase()
  const existing = (slug: string) =>
    ['png', 'jpg', 'webp'].map((e) => `${slug}.${e}`).find((f) => existsSync(join(IMG_DIR, f))) ?? null
  const needImages = saddles.filter((s) => forceImages || !existing(s.slug))
  if (needImages.length) {
    console.log(`Downloading ${needImages.length} images…`)
    const urls = await fileUrls(needImages.map((s) => s.wiki_image))
    for (const s of needImages) {
      const url = urls.get(s.wiki_image)
      const ok = url ? await download(url, join(IMG_DIR, `${s.slug}.${imageExt(s.wiki_image)}`)) : false
      if (!ok) console.log(`  no image for ${s.name} (${s.wiki_image})`)
    }
  }

  mkdirSync(OUT_DIR, { recursive: true })
  for (const f of readdirSync(OUT_DIR)) if (f.endsWith('.json')) rmSync(join(OUT_DIR, f))
  for (const { slug, wiki_image, ...data } of saddles) {
    void wiki_image
    // The file name is recorded so the app never has to probe public/ at runtime.
    const out: Saddle = { ...data, image_file: existing(slug) }
    writeFileSync(join(OUT_DIR, `${slug}.json`), JSON.stringify(out, null, 4) + '\n')
  }
  console.log(`Wrote ${saddles.length} saddles to data/saddles/`)

  if (unlinked.length) console.log(`No creature found for: ${unlinked.join(', ')}`)
}

main()
