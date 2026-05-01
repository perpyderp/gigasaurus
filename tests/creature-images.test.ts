/**
 * Creature image coverage tests.
 *
 * These tests verify two things:
 *   1. Every creature data file in data/creatures/ has a matching image in
 *      public/images/creatures/{slug}.png
 *   2. Every slug that has both data and an image is reachable from dino-map.ts
 *      (i.e. resolveSlug can map to it), so CreatureCard actually shows the image
 *      via creature.apiSlug.
 */

import { describe, it, expect } from 'bun:test'
import { readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { resolveSlug } from '@/lib/dino-map'

const ROOT = join(import.meta.dir, '..')
const DATA_DIR = join(ROOT, 'data', 'creatures')
const IMAGES_DIR = join(ROOT, 'public', 'images', 'creatures')

const dataSlugs = readdirSync(DATA_DIR)
  .filter(f => f.endsWith('.json'))
  .map(f => f.replace('.json', ''))
  .sort()

// ─── 1. Image file existence ──────────────────────────────────────────────────

describe('creature data → image file', () => {
  for (const slug of dataSlugs) {
    it(`${slug} has public/images/creatures/${slug}.png`, () => {
      expect(existsSync(join(IMAGES_DIR, `${slug}.png`))).toBe(true)
    })
  }
})

// ─── 2. dino-map.ts coverage ─────────────────────────────────────────────────
// For every slug that has BOTH a data file and an image, resolveSlug must be
// able to return that slug from at least one (dinoNameTag, dinoClass) pair.
// We probe using the slug itself and common ARK tag patterns derived from it.

/**
 * Derive candidate DinoNameTags from a slug.
 * e.g. "dire_bear" → ["Dire_Bear", "DireBear", "dire_bear"]
 */
function candidateTags(slug: string): string[] {
  const words = slug.split('_')
  const pascal = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
  const titleUnderscore = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('_')
  return [pascal, titleUnderscore, slug, words[0].charAt(0).toUpperCase() + words[0].slice(1)]
}

const slugsWithImages = dataSlugs.filter(slug =>
  existsSync(join(IMAGES_DIR, `${slug}.png`))
)

describe('dino-map covers slugs that have data + image', () => {
  for (const slug of slugsWithImages) {
    it(`resolveSlug can map to "${slug}"`, () => {
      // Try candidate tags first, then fall back to blueprint class probes
      const tags = candidateTags(slug)
      const blueprintClass = `${tags[0]}_Character_BP_C`

      const found = tags.some(tag => resolveSlug(tag, blueprintClass) === slug)
        || resolveSlug('', blueprintClass) === slug

      expect(found).toBe(true)
    })
  }
})
