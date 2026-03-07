import { Elysia, t } from 'elysia'
import { ResourceService } from '@/services/resource'

export const resourceRoutes = new Elysia({ prefix: '/resources', tags: ['Resources'] })
  .get(
    '/',
    ({ query, request }) => {
      const origin = new URL(request.url).origin
      const result = ResourceService.getAll({
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
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20 })),
        offset: t.Optional(t.Numeric({ minimum: 0, default: 0 })),
      }),
      detail: {
        summary: 'List all resources',
        description: 'Returns a paginated list of all in-game resources.',
      },
    }
  )
  .get(
    '/:slug',
    ({ params, set, request }) => {
      const origin = new URL(request.url).origin
      const resource = ResourceService.getBySlug(params.slug)
      if (!resource) {
        set.status = 404
        return { message: `Resource '${params.slug}' not found` }
      }
      return { ...resource, image: resource.image ? `${origin}${resource.image}` : null }
    },
    {
      params: t.Object({ slug: t.String() }),
      detail: {
        summary: 'Get resource by slug',
        description: 'Returns full details for a single resource by its slug.',
      },
    }
  )
