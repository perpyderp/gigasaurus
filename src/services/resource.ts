import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { ResourceSchema, type ResourceDetail, type ResourceListItem } from '@/schemas/resource'

const DATA_DIR = join(process.cwd(), 'data', 'resources')
const IMAGE_BASE = '/images/resources'

function imageUrl(slug: string): string {
  return `${IMAGE_BASE}/${slug}.png`
}

function load(slug: string): ResourceDetail | null {
  const filePath = join(DATA_DIR, `${slug}.json`)
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }

  const result = ResourceSchema.safeParse(raw)
  if (!result.success) {
    console.error(`[ResourceService] Invalid data for "${slug}":`, result.error.flatten())
    return null
  }

  return { ...result.data, slug, image: imageUrl(slug) }
}

let cache: Map<string, ResourceDetail> | null = null

abstract class ResourceService {
  private static getCache(): Map<string, ResourceDetail> {
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
      const resource = load(slug)
      if (resource) cache.set(slug, resource)
    }
    return cache
  }

  static getAll(opts: { limit?: number; offset?: number } = {}): {
    count: number
    results: ResourceListItem[]
  } {
    const entries = [...ResourceService.getCache().values()]
    const total = entries.length
    const start = opts.offset ?? 0
    const end = opts.limit ? start + opts.limit : entries.length
    const page = entries.slice(start, end)

    return {
      count: total,
      results: page.map((r) => ({
        name: r.name,
        slug: r.slug,
        rarity: r.rarity,
        image: r.image,
        url: `/api/resources/${r.slug}`,
      })),
    }
  }

  static getBySlug(slug: string): ResourceDetail | null {
    return ResourceService.getCache().get(slug) ?? null
  }
}

export { ResourceService }
