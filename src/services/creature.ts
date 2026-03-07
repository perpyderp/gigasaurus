import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { CreatureSchema, type Creature, type CreatureDetail, type CreatureListItem } from '@/schemas/creature'
import { z } from 'zod'

const DATA_DIR = join(process.cwd(), 'data', 'creatures')
const IMAGE_BASE = '/images/creatures'

function imageUrl(slug: string): string | null {
  // Return the path if served from public/; contributors drop an image file here
  return `${IMAGE_BASE}/${slug}.png`
}

function normalizeSaddle(saddle: Creature['saddle']): CreatureDetail['saddle'] {
  if (saddle === null) return null
  if (Array.isArray(saddle)) return saddle
  return [saddle]
}

function load(slug: string): CreatureDetail | null {
  const filePath = join(DATA_DIR, `${slug}.json`)
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }

  const result = CreatureSchema.safeParse(raw)
  if (!result.success) {
    console.error(`[CreatureService] Invalid data for "${slug}":`, result.error.flatten())
    return null
  }

  const data = result.data
  return {
    ...data,
    slug,
    image: imageUrl(slug),
    saddle: normalizeSaddle(data.saddle),
  }
}

// Module-level cache — populated lazily on first access
let cache: Map<string, CreatureDetail> | null = null

abstract class CreatureService {
  private static getCache(): Map<string, CreatureDetail> {
    if (cache) return cache
    cache = new Map()
    let slugs: string[]
    try {
      slugs = readdirSync(DATA_DIR)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace('.json', ''))
    } catch {
      return cache
    }
    for (const slug of slugs) {
      const creature = load(slug)
      if (creature) cache.set(slug, creature)
    }
    return cache
  }

  static getAll(opts: { category?: string; limit?: number; offset?: number } = {}): {
    count: number
    results: CreatureListItem[]
  } {
    let entries = [...CreatureService.getCache().values()]

    if (opts.category) {
      entries = entries.filter((c) => c.category === opts.category)
    }

    const total = entries.length
    const start = opts.offset ?? 0
    const end = opts.limit ? start + opts.limit : entries.length
    const page = entries.slice(start, end)

    return {
      count: total,
      results: page.map((c) => ({
        name: c.name,
        slug: c.slug,
        category: c.category,
        image: c.image,
        url: `/api/creatures/${c.slug}`,
      })),
    }
  }

  static getBySlug(slug: string): CreatureDetail | null {
    return CreatureService.getCache().get(slug) ?? null
  }
}

export { CreatureService }
