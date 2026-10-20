import { Elysia, t } from 'elysia'
import { MapService } from '@/services/map'

export const mapRoutes = new Elysia({ prefix: '/maps', tags: ['Maps'] })
  .get(
    '/',
    ({ request }) => {
      const origin = new URL(request.url).origin
      const result = MapService.getAll()
      return {
        ...result,
        results: result.results.map((m) => ({
          ...m,
          image: m.image ? `${origin}${m.image}` : null,
          url: `${origin}${m.url}`,
        })),
      }
    },
    {
      response: {
        200: t.Object({
          count: t.Number(),
          results: t.Array(t.Object({
            name: t.String(),
            slug: t.String(),
            creature_count: t.Number(),
            resource_count: t.Number(),
            image: t.Nullable(t.String()),
            url: t.String(),
          })),
        }),
      },
      detail: {
        summary: 'List all maps',
        description: 'Returns every official map in release order, with how many creatures spawn there and how many resource node layers it has.',
      },
    }
  )
  .get(
    '/:mapName',
    ({ params, query, set, request }) => {
      const origin = new URL(request.url).origin
      const map = MapService.getBySlug(params.mapName)
      if (!map) {
        set.status = 404
        return { message: `Map '${params.mapName}' not found` }
      }
      const creatures = query.creature ? map.creatures.filter((c) => c.creature === query.creature) : map.creatures
      return { ...map, creatures, image: map.image ? `${origin}${map.image}` : null }
    },
    {
      params: t.Object({
        mapName: t.String({
          description: 'Map name. Case-insensitive; spaces, punctuation and underscores are interchangeable.',
          examples: ['the_island', 'Genesis: Part 1'],
        }),
      }),
      query: t.Object({
        creature: t.Optional(t.String({ description: 'Only return spawns for this creature slug, e.g. `rex`.' })),
      }),
      response: {
        404: t.Object({ message: t.String() }),
      },
      detail: {
        summary: 'Get map by name',
        description:
          'Returns a map with its creature spawn areas and resource nodes. Coordinates are in-game longitude (x) and latitude (y), 0–100. ' +
          'Spawn regions are `[x1, y1, x2, y2, rarity]` and points `[x, y, rarity]`, where rarity runs from 0 (very rare) to 5 (very common).',
      },
    }
  )
