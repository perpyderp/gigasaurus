import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { WeaponSchema, type WeaponDetail, type WeaponListItem, type WeaponCategory } from '@/schemas/weapon'

const DATA_DIR = join(process.cwd(), 'data', 'weapons')
const IMAGE_BASE = '/images/weapons'

function imageUrl(slug: string): string {
  return `${IMAGE_BASE}/${slug}.png`
}

function load(slug: string): WeaponDetail | null {
  const filePath = join(DATA_DIR, `${slug}.json`)
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }

  const result = WeaponSchema.safeParse(raw)
  if (!result.success) {
    console.error(`[WeaponService] Invalid data for "${slug}":`, result.error.flatten())
    return null
  }

  return { ...result.data, slug, image: imageUrl(slug) }
}

let cache: Map<string, WeaponDetail> | null = null

abstract class WeaponService {
  private static getCache(): Map<string, WeaponDetail> {
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
      const weapon = load(slug)
      if (weapon) cache.set(slug, weapon)
    }
    return cache
  }

  static getAll(opts: { category?: WeaponCategory; limit?: number; offset?: number } = {}): {
    count: number
    results: WeaponListItem[]
  } {
    let entries = [...WeaponService.getCache().values()]

    if (opts.category) {
      entries = entries.filter((w) => w.category === opts.category)
    }

    const total = entries.length
    const start = opts.offset ?? 0
    const end = opts.limit ? start + opts.limit : entries.length
    const page = entries.slice(start, end)

    return {
      count: total,
      results: page.map((w) => ({
        name: w.name,
        slug: w.slug,
        category: w.category,
        damage: w.damage,
        unlock_level: w.unlock_level,
        image: w.image,
        url: `/api/weapons/${w.slug}`,
      })),
    }
  }

  static getBySlug(slug: string): WeaponDetail | null {
    return WeaponService.getCache().get(slug) ?? null
  }
}

export { WeaponService }
