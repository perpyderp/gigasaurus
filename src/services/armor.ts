import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { ArmorSchema, type ArmorDetail, type ArmorListItem } from '@/schemas/armor'

const DATA_DIR = join(process.cwd(), 'data', 'armor')
const IMAGE_BASE = '/images/armor'

function imageUrl(slug: string): string {
  return `${IMAGE_BASE}/${slug}.png`
}

function load(slug: string): ArmorDetail | null {
  const filePath = join(DATA_DIR, `${slug}.json`)
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }

  const result = ArmorSchema.safeParse(raw)
  if (!result.success) {
    console.error(`[ArmorService] Invalid data for "${slug}":`, result.error.flatten())
    return null
  }

  return { ...result.data, slug, image: imageUrl(slug) }
}

let cache: Map<string, ArmorDetail> | null = null

abstract class ArmorService {
  private static getCache(): Map<string, ArmorDetail> {
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
      const armor = load(slug)
      if (armor) cache.set(slug, armor)
    }
    return cache
  }

  static getAll(opts: { limit?: number; offset?: number } = {}): {
    count: number
    results: ArmorListItem[]
  } {
    const entries = [...ArmorService.getCache().values()]
    const total = entries.length
    const start = opts.offset ?? 0
    const end = opts.limit ? start + opts.limit : entries.length
    const page = entries.slice(start, end)

    return {
      count: total,
      results: page.map((a) => ({
        set_name: a.set_name,
        slug: a.slug,
        armor_rating: a.armor_rating,
        unlock_level: a.unlock_level,
        image: a.image,
        url: `/api/armor/${a.slug}`,
      })),
    }
  }

  static getBySlug(slug: string): ArmorDetail | null {
    return ArmorService.getCache().get(slug) ?? null
  }
}

export { ArmorService }
