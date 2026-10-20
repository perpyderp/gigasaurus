import { Elysia, t } from 'elysia'
import { ResourceService } from '@/services/resource'

export const resourceRoutes = new Elysia({ prefix: '/resources', tags: ['Resources'] })
  .get(
    '/',
    ({ query, request }) => {
      const origin = new URL(request.url).origin
      const result = ResourceService.getAll({
        map: query.map,
        limit: query.limit,
        offset: query.offset,
      })
      return {
        ...result,
        results: result.results.map((r) => ({
          ...r,
          image: r.image ? `${origin}${r.image}` : null,
          url: `${origin}${r.url}`,
        })),
      }
    },
    {
      query: t.Object({
        map: t.Optional(t.String({ description: 'Only resources found on this map, e.g. `the_island` or `Aberration`.' })),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20 })),
        offset: t.Optional(t.Numeric({ minimum: 0, default: 0 })),
      }),
      response: {
        200: t.Object({
          count: t.Number(),
          results: t.Array(t.Object({
            name: t.String(),
            slug: t.String(),
            rarity: t.String(),
            image: t.Nullable(t.String()),
            url: t.String(),
          })),
        }),
      },
      detail: {
        summary: 'List all resources',
        description: 'Returns a paginated list of all in-game resources.',
      },
    }
  )
  .get(
    '/:resourceName',
    ({ params, set, request }) => {
      const origin = new URL(request.url).origin
      const resource = ResourceService.getBySlug(params.resourceName)
      if (!resource) {
        set.status = 404
        return { message: `Resource '${params.resourceName}' not found` }
      }
      return { ...resource, image: resource.image ? `${origin}${resource.image}` : null }
    },
    {
      params: t.Object({
        resourceName: t.String({
          description: 'Resource name. Case-insensitive; spaces, hyphens and underscores are interchangeable.',
          examples: ['element', 'Black Pearl'],
        }),
      }),
      response: {
        404: t.Object({ message: t.String() }),
      },
      detail: {
        summary: 'Get resource by name',
        description: 'Returns full details for a single resource by name, e.g. `Black Pearl`.',
      },
    }
  )
