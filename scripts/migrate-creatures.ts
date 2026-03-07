/**
 * Migrates creature data from old/data/creatures/<category>/<slug>/data.json
 * to data/creatures/<slug>.json, injecting the `category` field.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const OLD_DIR = join(import.meta.dir, '..', 'old', 'data', 'creatures')
const NEW_DIR = join(import.meta.dir, '..', 'data', 'creatures')

const CATEGORY_MAP: Record<string, string> = {
  dinosaurs: 'dinosaur',
  fantasy: 'fantasy',
  birds: 'bird',
  fish: 'fish',
  invertebrates: 'invertebrate',
  mammals: 'mammal',
  reptiles: 'reptile',
}

mkdirSync(NEW_DIR, { recursive: true })

let migrated = 0
let skipped = 0

for (const categoryDir of readdirSync(OLD_DIR)) {
  const category = CATEGORY_MAP[categoryDir] ?? 'other'
  const categoryPath = join(OLD_DIR, categoryDir)

  for (const slug of readdirSync(categoryPath)) {
    const sourcePath = join(categoryPath, slug, 'data.json')
    const destPath = join(NEW_DIR, `${slug}.json`)

    let raw: Record<string, unknown>
    try {
      raw = JSON.parse(readFileSync(sourcePath, 'utf-8'))
    } catch {
      console.warn(`  ⚠ Could not read ${sourcePath}, skipping`)
      skipped++
      continue
    }

    // Inject category, normalize saddle to array
    const saddle = raw.saddle
    const normalizedSaddle =
      saddle === null
        ? null
        : Array.isArray(saddle)
          ? saddle
          : [saddle]

    const output = {
      ...raw,
      category,
      saddle: normalizedSaddle,
    }

    writeFileSync(destPath, JSON.stringify(output, null, 4))
    console.log(`  ✓ ${categoryDir}/${slug} → data/creatures/${slug}.json`)
    migrated++
  }
}

console.log(`\nDone. Migrated: ${migrated}, Skipped: ${skipped}`)
