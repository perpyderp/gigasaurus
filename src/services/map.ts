import { readFileSync } from 'fs'
import { join } from 'path'
import { GameMapSchema, type MapDetail, type MapListItem } from '@/schemas/map'
import { MAP_ORDER, mapSlug } from '@/lib/map-order'
import { toSlug } from '@/lib/slug'

const DATA_DIR = join(process.cwd(), 'data', 'maps')
const IMAGE_BASE = '/images/world-maps'

function load(slug: string): MapDetail | null {
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(join(DATA_DIR, `${slug}.json`), 'utf-8'))
  } catch {
    return null
  }
  const result = GameMapSchema.safeParse(raw)
  if (!result.success) {
    console.error(`[MapService] Invalid data for "${slug}":`, result.error.flatten())
    return null
  }
  return { ...result.data, slug, image: `${IMAGE_BASE}/${slug}.jpg` }
}

let cache: Map<string, MapDetail> | null = null

export interface CreatureMapSpawns {
  map: string
  name: string
  regions: MapDetail['creatures'][number]['regions']
  points: MapDetail['creatures'][number]['points']
}

abstract class MapService {
  /** Loaded in release order (MAP_ORDER), which is how maps are listed everywhere. */
  private static getCache(): Map<string, MapDetail> {
    if (cache) return cache
    cache = new Map()
    for (const name of MAP_ORDER) {
      const map = load(mapSlug(name))
      if (map) cache.set(map.slug, map)
    }
    return cache
  }

  static getAll(): { count: number; results: MapListItem[] } {
    const maps = [...MapService.getCache().values()]
    return {
      count: maps.length,
      results: maps.map((m) => ({
        name: m.name,
        slug: m.slug,
        creature_count: m.creatures.length,
        resource_count: m.resources.length,
        image: m.image,
        url: `/api/maps/${m.slug}`,
      })),
    }
  }

  /** By slug or name ("the_island", "The Island", "genesis: part 1"). */
  static getBySlug(slug: string): MapDetail | null {
    return MapService.getCache().get(mapSlug(toSlug(slug))) ?? null
  }

  /**
   * Where a creature spawns, one entry per map. Several spawn-table names can
   * resolve to one creature page; their areas are merged.
   */
  static forCreature(creatureSlug: string): CreatureMapSpawns[] {
    const out: CreatureMapSpawns[] = []
    for (const m of MapService.getCache().values()) {
      const entries = m.creatures.filter((c) => c.creature === creatureSlug)
      if (!entries.length) continue
      out.push({
        map: m.slug,
        name: m.name,
        regions: entries.flatMap((e) => e.regions),
        points: entries.flatMap((e) => e.points),
      })
    }
    return out
  }
}

export { MapService }
