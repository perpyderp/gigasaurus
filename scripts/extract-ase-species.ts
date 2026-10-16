/**
 * Generate data/ase-species.json from ARKStatsExtractor's species data.
 *
 * Sources (cadon/ARKStatsExtractor, dev branch):
 *   ARKBreedingStats/json/values/values.json      — ARK: Survival Evolved
 *   ARKBreedingStats/json/values/ASA-values.json  — ARK: Survival Ascended overlay
 *
 * ASA entries win for blueprint paths present in both, since exports we import
 * are typically from ASA. Output is keyed by lowercased blueprint path without
 * the trailing `_C`, matching ASE's `SpeciesByBlueprint` lookup.
 *
 * Usage: bun scripts/extract-ase-species.ts [path-to-ASE-checkout]
 */

import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import {
  DEFAULT_IMPRINT_MULT as DEFAULT_IMPRINT,
  STATS_COUNT,
  type AseSpeciesEntry,
  type AseSpeciesFile,
} from '../src/lib/ark-stat-solver/ase-data'

const RAW_BASE = 'https://raw.githubusercontent.com/cadon/ARKStatsExtractor/dev/ARKBreedingStats/json/values'
const OUT_PATH = join(process.cwd(), 'data', 'ase-species.json')

type RawSpecies = {
  name?: string
  blueprintPath?: string
  fullStatsRaw?: (number[] | null)[]
  TamedBaseHealthMultiplier?: number
  statImprintMult?: number[]
  mutationMult?: number[]
  displayedStats?: number
  skipWildLevelStats?: number
  statLevelUpsAdditive?: Record<string, boolean>
  statCaps?: Record<string, number>
  altBaseStats?: Record<string, number>
  isFlyer?: boolean
}

type ValuesFile = { species: RawSpecies[]; remaps?: Record<string, string> }

function normalizeBlueprint(bp: string): string {
  let p = bp.trim()
  if (p.endsWith('_C')) p = p.slice(0, -2)
  return p.toLowerCase()
}

async function loadValues(file: string, localDir?: string): Promise<ValuesFile> {
  if (localDir) {
    const p = join(localDir, 'ARKBreedingStats', 'json', 'values', file)
    if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf-8'))
  }
  const res = await fetch(`${RAW_BASE}/${file}`)
  if (!res.ok) throw new Error(`Failed to fetch ${file}: ${res.status}`)
  return res.json() as Promise<ValuesFile>
}

function dictToBitmask(dict: Record<string, boolean> | undefined): number {
  if (!dict) return 0
  let mask = 0
  for (const [idx, on] of Object.entries(dict)) {
    if (on) mask |= 1 << Number(idx)
  }
  return mask
}

function convertStats(fullStatsRaw: (number[] | null)[]): AseSpeciesEntry['stats'] {
  const stats: AseSpeciesEntry['stats'] = []
  for (let s = 0; s < STATS_COUNT; s++) {
    const rawStat = fullStatsRaw[s]
    if (!rawStat) {
      stats.push(null)
      continue
    }
    const full: [number, number, number, number, number] = [0, 0, 0, 0, 0]
    for (let i = 0; i < 5; i++) full[i] = rawStat[i] ?? 0
    // ARK ignores negative multiplicative taming bonuses (treated as 0)
    if (full[4] < 0) full[4] = 0
    stats.push(full)
  }
  return stats
}

/**
 * Convert a raw species, merging onto an existing entry. ASA-values.json is a
 * partial overlay: most entries only carry the fields that differ from the ASE
 * base species (e.g. just `skipWildLevelStats`), mirroring ASE's override merge.
 */
function convertSpecies(raw: RawSpecies, game: 'ASE' | 'ASA', base?: AseSpeciesEntry): AseSpeciesEntry | null {
  if (!raw.blueprintPath) return null
  const name = raw.name ?? base?.name
  const stats = raw.fullStatsRaw ? convertStats(raw.fullStatsRaw) : base?.stats
  if (!name || !stats) return null

  const entry: AseSpeciesEntry = { ...base, name, game, stats }

  if (raw.TamedBaseHealthMultiplier != null) {
    if (raw.TamedBaseHealthMultiplier === 1) delete entry.tbhm
    else entry.tbhm = raw.TamedBaseHealthMultiplier
  }
  if (raw.statImprintMult) {
    if (raw.statImprintMult.some((v, i) => v !== DEFAULT_IMPRINT[i])) entry.imprintMult = raw.statImprintMult
    else delete entry.imprintMult
  }
  if (raw.mutationMult) {
    if (raw.mutationMult.some((v) => v !== 1)) entry.mutationMult = raw.mutationMult
    else delete entry.mutationMult
  }
  if (raw.skipWildLevelStats) entry.skipWildLevels = raw.skipWildLevelStats
  if (raw.displayedStats != null && raw.displayedStats !== -1) entry.displayedStats = raw.displayedStats
  const additive = dictToBitmask(raw.statLevelUpsAdditive)
  if (additive) entry.levelUpsAdditive = additive
  if (raw.statCaps && Object.keys(raw.statCaps).length) entry.statCaps = raw.statCaps
  if (raw.altBaseStats && Object.keys(raw.altBaseStats).length) entry.altBaseStats = raw.altBaseStats
  if (raw.isFlyer) entry.flyer = true

  return entry
}

async function main() {
  const localDir = process.argv[2]
  const [ase, asa] = await Promise.all([
    loadValues('values.json', localDir),
    loadValues('ASA-values.json', localDir),
  ])

  const species: Record<string, AseSpeciesEntry> = {}
  const remaps: Record<string, string> = {}
  let aseCount = 0
  let asaCount = 0

  for (const raw of ase.species) {
    const entry = convertSpecies(raw, 'ASE')
    if (entry) {
      species[normalizeBlueprint(raw.blueprintPath!)] = entry
      aseCount++
    }
  }
  for (const raw of asa.species) {
    const key = normalizeBlueprint(raw.blueprintPath ?? '')
    const entry = convertSpecies(raw, 'ASA', species[key])
    if (entry) {
      species[key] = entry
      asaCount++
    }
  }
  for (const file of [ase, asa]) {
    for (const [from, to] of Object.entries(file.remaps ?? {})) {
      remaps[normalizeBlueprint(from)] = normalizeBlueprint(to)
    }
  }

  const out: AseSpeciesFile = {
    generatedFrom: { ase: `${RAW_BASE}/values.json`, asa: `${RAW_BASE}/ASA-values.json` },
    remaps,
    species,
  }

  writeFileSync(OUT_PATH, JSON.stringify(out))
  console.log(
    `Wrote ${OUT_PATH}: ${Object.keys(species).length} blueprint paths ` +
    `(${aseCount} ASE + ${asaCount} ASA overlay), ${Object.keys(remaps).length} remaps`,
  )
}

main()
