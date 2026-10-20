#!/usr/bin/env bun
/**
 * Collect every other name a creature goes by and the blueprint classes that
 * mean it, so in-game exports, search and lookups all find the same creature.
 *
 * Name sources, per creature (data/creatures/{slug}.json):
 *   - ARKStatsExtractor species names for its exact blueprint (data/ase-species.json),
 *     plus variant blueprints when its own blueprint is a "_Base" family
 *     (Wyvern_Character_BP_Base → Fire / Ice / Lightning / Poison Wyvern)
 *   - its blueprint's short name, made readable (FireLion → "Fire Lion")
 *   - export DinoNameTags that map to it (src/lib/dino-map.ts NAME_TAG_MAP)
 *   - names of duplicate entries merged into it (MERGED below)
 * Abbreviations that are just the start of the main name ("Anky", "Ptera") and
 * other creatures' main names are left out.
 *
 * Writes:
 *   data/creatures/{slug}.json   — `alternate_names` (right after `name`)
 *   src/lib/creature-index.json  — { classes: blueprint class (lowercase, no _C) → slug,
 *                                    names: slug → display name,
 *                                    images: slug → dossier/image path under /public }
 *
 * Usage:  bun scripts/build-creature-names.ts
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { NAME_TAG_MAP } from '../src/lib/dino-map'

const ROOT = join(import.meta.dir, '..')
const DATA_DIR = join(ROOT, 'data', 'creatures')

/** Duplicate entries that were removed, kept as names of the surviving creature. */
const MERGED: Record<string, string[]> = {
  sarco: ['Sarcosuchus'],
}

type Creature = { name: string; entity_id?: string; alternate_names?: string[]; [k: string]: unknown }
type AseFile = { species: Record<string, { name: string }> }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Blueprint short name: everything before "_Character"/"_Char"/"_BP" ("InsectSwarmChar_BP_C" → "InsectSwarm"). */
const blueprintName = (entityId: string) => entityId.replace(/(_?Char(acter)?)?(_BP)?(_.*)?_C$/, '').replace(/Char$/, '')

/** Edit distance, to drop misspellings of the main name ("Procoptdon"). */
function distance(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]
    d[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j]
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return d[b.length]
}
const classKey = (cls: string) => cls.toLowerCase().replace(/_c$/, '')
/** "FireLion" → "Fire Lion", "DeinotheriumASA" → "Deinotherium", "VRMainBoss" → "VR Main Boss". */
function humanize(token: string): string {
  const t = token.replace(/(ASA|AA)$/, '').replace(/_/g, ' ')
  return t
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase())
}

const ase = JSON.parse(readFileSync(join(ROOT, 'data', 'ase-species.json'), 'utf-8')) as AseFile
const aseNamesByClass = new Map<string, Set<string>>()
for (const [path, entry] of Object.entries(ase.species)) {
  const cls = classKey(path.split('.').pop() ?? '')
  if (!aseNamesByClass.has(cls)) aseNamesByClass.set(cls, new Set())
  aseNamesByClass.get(cls)!.add(entry.name)
}

const slugs = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))
const creatures = new Map<string, Creature>(
  slugs.map((slug) => [slug, JSON.parse(readFileSync(join(DATA_DIR, `${slug}.json`), 'utf-8')) as Creature]),
)

// Blueprint class → slug. Exact entity classes first, then unclaimed variants of "_Base" families.
const classIndex: Record<string, string> = {}
for (const [slug, c] of creatures) if (c.entity_id) classIndex[classKey(c.entity_id)] = slug
const variantClasses = new Map<string, string[]>()
for (const [slug, c] of creatures) {
  if (!c.entity_id) continue
  const own = classKey(c.entity_id)
  if (!own.endsWith('_base')) continue
  const prefix = own.slice(0, -'_base'.length) + '_'
  for (const cls of aseNamesByClass.keys()) {
    if (cls.startsWith(prefix) && !(cls in classIndex)) {
      classIndex[cls] = slug
      variantClasses.set(slug, [...(variantClasses.get(slug) ?? []), cls])
    }
  }
}

const primaryNames = new Set([...creatures.values()].map((c) => norm(c.name)))
const tagsBySlug = new Map<string, string[]>()
for (const [tag, slug] of Object.entries(NAME_TAG_MAP)) tagsBySlug.set(slug, [...(tagsBySlug.get(slug) ?? []), tag])

let changed = 0
for (const [slug, c] of creatures) {
  const candidates = new Set<string>()
  if (c.entity_id) {
    const own = classKey(c.entity_id)
    for (const n of aseNamesByClass.get(own) ?? []) candidates.add(n)
    candidates.add(humanize(blueprintName(c.entity_id)))
  }
  for (const cls of variantClasses.get(slug) ?? []) for (const n of aseNamesByClass.get(cls) ?? []) candidates.add(n)
  // Underscored tags are decorated forms (e.g. "Rollrat_Roll"), not names.
  for (const tag of tagsBySlug.get(slug) ?? []) if (!tag.includes('_')) candidates.add(humanize(tag))
  for (const n of MERGED[slug] ?? []) candidates.add(n)

  const main = norm(c.name)
  const seen = new Set<string>()
  const names = [...candidates]
    .filter((n) => {
      const k = norm(n)
      if (!k || k === main || seen.has(k)) return false
      if (main.startsWith(k)) return false // abbreviation of the main name ("Anky", "Ptera")
      if (distance(k, main) <= 1) return false // misspelling of the main name ("Procoptdon")
      if (primaryNames.has(k) && !(MERGED[slug] ?? []).includes(n)) return false // another creature's name
      seen.add(k)
      return true
    })
    .sort((a, b) => a.localeCompare(b))

  const before = JSON.stringify(c.alternate_names ?? [])
  // Rebuild with alternate_names right after name, keeping every other key in place.
  const { name, ...rest } = c
  delete rest.alternate_names
  const next: Creature = names.length ? { name, alternate_names: names, ...rest } : { name, ...rest }
  if (JSON.stringify(names) !== before) {
    writeFileSync(join(DATA_DIR, `${slug}.json`), JSON.stringify(next, null, 4) + '\n')
    changed++
  }
}

const classes = Object.fromEntries(Object.entries(classIndex).sort(([a], [b]) => a.localeCompare(b)))
const names = Object.fromEntries([...creatures].map(([slug, c]) => [slug, c.name]).sort(([a], [b]) => a.localeCompare(b)))
// Dossiers come as .png, .jpg or .webp; record the file each creature actually has.
const IMG_DIR = join(ROOT, 'public', 'images', 'creatures')
const images: Record<string, string> = {}
for (const slug of [...creatures.keys()].sort()) {
  const ext = ['png', 'jpg', 'webp'].find((e) => existsSync(join(IMG_DIR, `${slug}.${e}`)))
  if (ext) images[slug] = `/images/creatures/${slug}.${ext}`
}
writeFileSync(join(ROOT, 'src', 'lib', 'creature-index.json'), JSON.stringify({ classes, names, images }, null, 2) + '\n')

console.log(`${creatures.size} creatures, ${changed} updated, ${Object.keys(classes).length} blueprint classes indexed`)
