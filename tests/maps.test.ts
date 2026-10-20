import { describe, it, expect } from 'bun:test'
import { app } from '@/app/api/[[...slugs]]/route'
import { MapListSchema, MapDetailSchema } from '@/schemas/map'
import { MapService } from '@/services/map'
import { regionsForSpawns } from '@/lib/map-geometry'

async function get(path: string) {
  return app.handle(new Request(`http://localhost${path}`))
}

describe('GET /api/maps', () => {
  it('lists every map in release order', async () => {
    const res = await get('/api/maps')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(MapListSchema.safeParse(json).success).toBe(true)
    expect(json.results[0].slug).toBe('the_island')
    expect(json.count).toBeGreaterThanOrEqual(14)
  })
})

describe('GET /api/maps/:mapName', () => {
  it('accepts a slug or a display name', async () => {
    for (const name of ['the_island', 'The Island', 'genesis: part 1']) {
      const res = await get(`/api/maps/${encodeURIComponent(name)}`)
      expect(res.status).toBe(200)
    }
  })

  it('matches MapDetailSchema with in-range coordinates', async () => {
    const json = await (await get('/api/maps/the_island')).json()
    expect(MapDetailSchema.safeParse(json).success).toBe(true)
    for (const c of json.creatures) {
      for (const [x1, y1, , , r] of c.regions) {
        expect(x1).toBeGreaterThan(-10)
        expect(y1).toBeLessThan(110)
        expect(r).toBeGreaterThanOrEqual(0)
        expect(r).toBeLessThanOrEqual(5)
      }
    }
  })

  it('filters spawns to one creature', async () => {
    const json = await (await get('/api/maps/the_island?creature=rex')).json()
    expect(json.creatures.length).toBeGreaterThan(0)
    expect(json.creatures.every((c: { creature: string }) => c.creature === 'rex')).toBe(true)
  })

  it('404s for an unknown map', async () => {
    expect((await get('/api/maps/atlantis')).status).toBe(404)
  })
})

describe('MapService.forCreature', () => {
  it('finds the Rex on The Island', () => {
    const maps = MapService.forCreature('rex').map((m) => m.map)
    expect(maps).toContain('the_island')
  })
})

describe('resource maps', () => {
  it('filters resources by map', async () => {
    const json = await (await get('/api/resources?map=the_island&limit=100')).json()
    const slugs = json.results.map((r: { slug: string }) => r.slug)
    expect(slugs).toContain('metal')
    expect(slugs).not.toContain('blue_gem')
  })
})

describe('map details', () => {
  it('has the wiki overview, places and roster for The Island', () => {
    const map = MapService.getBySlug('the_island')!
    expect(map.level_name).toBe('TheIsland_WP')
    expect(map.regions.length).toBeGreaterThan(20)
    expect(map.landmarks.map((l) => l.name)).toContain('Blue Obelisk')
    expect(map.caves.find((c) => c.name === 'Central Cave')?.holds).toContain('Artifact of the Clever')
    expect(map.roster.find((g) => g.group === 'Bosses')?.names).toContain('Dragon')
    expect(map.player_spawns.length).toBeGreaterThan(0)
  })

  it('maps Aberrant variants to their base creature', () => {
    expect(MapService.forCreature('dodo').map((m) => m.map)).toContain('aberration')
  })
})

describe('regionsForSpawns', () => {
  const regions = [
    { name: 'Deep Ocean', areas: [[0, 0, 100, 20] as [number, number, number, number]] },
    { name: 'Hills', areas: [[40, 10, 60, 30] as [number, number, number, number]] },
  ]
  it('prefers specific regions over map-spanning ones', () => {
    expect(regionsForSpawns(regions, [[45, 12, 55, 18, 3]], [])).toEqual(['Hills'])
  })
  it('falls back to broad regions when nothing else matches', () => {
    expect(regionsForSpawns(regions, [[5, 5, 10, 10, 3]], [])).toEqual(['Deep Ocean'])
  })
})
