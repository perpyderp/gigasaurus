#!/usr/bin/env bun
/**
 * Download arkutils/species-images base + mask PNGs for every creature in
 * data/creatures/, saving them locally so the in-app color renderer doesn't
 * have to hit raw.githubusercontent.com on every load.
 *
 * Output:
 *   public/images/creature-renders/{slug}.png      — base (gray) image
 *   public/images/creature-renders/{slug}_m.png    — region mask
 *   data/creature-renders-coverage.json             — { covered: [...], missing: [...] }
 *
 * Usage:  bun scripts/download-color-renders.ts
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dir, '..')
const DATA_DIR = join(ROOT, 'data', 'creatures')
const OUT_DIR = join(ROOT, 'public', 'images', 'creature-renders')
const COVERAGE_FILE = join(ROOT, 'data', 'creature-renders-coverage.json')
const ARKUTILS = 'https://raw.githubusercontent.com/arkutils/species-images/main/images'
const DELAY_MS = 200

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  const res = await fetch(url)
  if (!res.ok) return null
  return new Uint8Array(await res.arrayBuffer())
}

async function fetchPair(displayName: string): Promise<{ base: Uint8Array; mask: Uint8Array } | null> {
  const enc = encodeURIComponent(displayName)
  const [base, mask] = await Promise.all([
    fetchBytes(`${ARKUTILS}/${enc}_ASA.png`),
    fetchBytes(`${ARKUTILS}/${enc}_ASA_m.png`),
  ])
  if (!base || !mask) return null
  return { base, mask }
}

const slugs = readdirSync(DATA_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace('.json', ''))

const covered: string[] = []
const missing: { slug: string; name: string }[] = []

for (let i = 0; i < slugs.length; i++) {
  const slug = slugs[i]
  const path = join(DATA_DIR, `${slug}.json`)
  const json = JSON.parse(readFileSync(path, 'utf-8')) as { name?: string }
  const displayName = json.name
  if (!displayName) {
    missing.push({ slug, name: '(no name)' })
    continue
  }

  const basePath = join(OUT_DIR, `${slug}.png`)
  const maskPath = join(OUT_DIR, `${slug}_m.png`)
  if (existsSync(basePath) && existsSync(maskPath)) {
    covered.push(slug)
    process.stdout.write(`  [${i + 1}/${slugs.length}] ${displayName} — already cached\n`)
    continue
  }

  process.stdout.write(`  [${i + 1}/${slugs.length}] ${displayName} … `)
  const result = await fetchPair(displayName)
  if (!result) {
    process.stdout.write(`\x1b[33m✗ missing upstream\x1b[0m\n`)
    missing.push({ slug, name: displayName })
    continue
  }
  writeFileSync(basePath, result.base)
  writeFileSync(maskPath, result.mask)
  covered.push(slug)
  process.stdout.write(`\x1b[32m✓\x1b[0m\n`)
  await new Promise((r) => setTimeout(r, DELAY_MS))
}

writeFileSync(COVERAGE_FILE, JSON.stringify({ covered, missing }, null, 2) + '\n')

console.log(`\nDone — covered: ${covered.length}, missing: ${missing.length}`)
if (missing.length) {
  console.log('Missing creatures (need manual handling or upstream PR):')
  for (const m of missing) console.log(`  - ${m.slug}: ${m.name}`)
}
