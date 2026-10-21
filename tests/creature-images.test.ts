/**
 * Creature image coverage tests.
 *
 * These tests verify two things:
 *   1. Every creature data file in data/creatures/ has a matching image in
 *      public/images/creatures/{slug}.png
 *   2. An export of each creature's blueprint (entity_id) resolves to it in
 *      dino-map.ts, so CreatureCard actually shows the image via creature.apiSlug.
 */

import { describe, it, expect } from 'bun:test'
import { readdirSync, existsSync, readFileSync } from 'fs'
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

const hasImage = (slug: string) => ['png', 'jpg', 'webp'].some((ext) => existsSync(join(IMAGES_DIR, `${slug}.${ext}`)))

describe('creature data → image file', () => {
  for (const slug of dataSlugs) {
    it(`${slug} has public/images/creatures/${slug}.png (or .jpg / .webp)`, () => {
      expect(hasImage(slug)).toBe(true)
    })
  }
})

// ─── 2. dino-map.ts coverage ─────────────────────────────────────────────────
// A real export names the creature's blueprint class (entity_id). For every
// creature with data, an image and a blueprint, an export of that blueprint
// must resolve to it — even with a tag we don't know.

describe('dino-map covers slugs that have data + image', () => {
  for (const slug of dataSlugs.filter(hasImage)) {
    const { entity_id } = JSON.parse(readFileSync(join(DATA_DIR, `${slug}.json`), 'utf-8')) as { entity_id?: string }
    if (!entity_id) continue
    it(`an export of ${entity_id} resolves to "${slug}"`, () => {
      const blueprint = entity_id.replace(/_C$/, '')
      expect(resolveSlug('UnknownTag', `/Game/Dinos/${blueprint}.${entity_id}`)).toBe(slug)
    })
  }
})

// ─── 3. Image index matches public/ ──────────────────────────────────────────
// Pages rendered on request can't see public/ (it's excluded from the server
// bundle), so CreatureService and CreatureCard read image paths from
// creature-index.json. A stale index means missing images in production.

describe('creature-index.json images match public/images/creatures', () => {
  const { images } = JSON.parse(readFileSync(join(ROOT, 'src', 'lib', 'creature-index.json'), 'utf-8')) as {
    images: Record<string, string>
  }
  for (const slug of dataSlugs.filter(hasImage)) {
    it(`${slug} is indexed with a file that exists (run \`bun run names\` if not)`, () => {
      expect(images[slug]).toBeDefined()
      expect(existsSync(join(ROOT, 'public', images[slug]))).toBe(true)
    })
  }
})
