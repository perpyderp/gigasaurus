import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { SaddleSchema, type SaddleDetail, type SaddleListItem } from '@/schemas/saddle'
import { toSlug } from '@/lib/slug'

const DATA_DIR = join(process.cwd(), 'data', 'saddles')
const IMAGE_BASE = '/images/saddles'

function load(slug: string): SaddleDetail | null {
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(join(DATA_DIR, `${slug}.json`), 'utf-8'))
  } catch {
    return null
  }
  const result = SaddleSchema.safeParse(raw)
  if (!result.success) {
    console.error(`[SaddleService] Invalid data for "${slug}":`, result.error.flatten())
    return null
  }
  const data = result.data
  return { ...data, slug, image: data.image_file ? `${IMAGE_BASE}/${data.image_file}` : null }
}

let cache: Map<string, SaddleDetail> | null = null
/** Creature slug → its saddles, standard first, then platform, then Tek. */
let byCreature: Map<string, SaddleDetail[]> | null = null

const kindRank = (s: SaddleDetail) => (s.tek ? 2 : s.platform ? 1 : 0)

abstract class SaddleService {
  private static getCache(): Map<string, SaddleDetail> {
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
    for (const slug of slugs.sort()) {
      const saddle = load(slug)
      if (saddle) cache.set(slug, saddle)
    }
    return cache
  }

  static getAll(opts: { creature?: string; limit?: number; offset?: number } = {}): {
    count: number
    results: SaddleListItem[]
  } {
    let entries = [...SaddleService.getCache().values()]
    if (opts.creature) entries = SaddleService.forCreature(opts.creature)
    const start = opts.offset ?? 0
    const end = opts.limit ? start + opts.limit : entries.length
    return {
      count: entries.length,
      results: entries.slice(start, end).map((s) => ({
        name: s.name,
        slug: s.slug,
        creatures: s.creatures,
        engram_level: s.engram_level,
        image: s.image,
        url: `/api/saddles/${s.slug}`,
      })),
    }
  }

  static getBySlug(slug: string): SaddleDetail | null {
    return SaddleService.getCache().get(toSlug(slug)) ?? null
  }

  static forCreature(creatureSlug: string): SaddleDetail[] {
    if (!byCreature) {
      byCreature = new Map()
      for (const s of SaddleService.getCache().values()) {
        for (const c of s.creatures) byCreature.set(c, [...(byCreature.get(c) ?? []), s])
      }
      for (const list of byCreature.values()) list.sort((a, b) => kindRank(a) - kindRank(b))
    }
    return byCreature.get(creatureSlug) ?? []
  }
}

export { SaddleService }
