import { Elysia, t } from 'elysia'
import { SaddleService } from '@/services/saddle'

export const saddleRoutes = new Elysia({ prefix: '/saddles', tags: ['Saddles'] })
  .get(
    '/',
    ({ query, request }) => {
      const origin = new URL(request.url).origin
      const result = SaddleService.getAll({ creature: query.creature, limit: query.limit, offset: query.offset })
      return {
        ...result,
        results: result.results.map((s) => ({
          ...s,
          image: s.image ? `${origin}${s.image}` : null,
          url: `${origin}${s.url}`,
        })),
      }
    },
    {
      query: t.Object({
        creature: t.Optional(t.String({ description: 'Only saddles this creature slug can wear, e.g. `rex`.' })),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 200, default: 20 })),
        offset: t.Optional(t.Numeric({ minimum: 0, default: 0 })),
      }),
      response: {
        200: t.Object({
          count: t.Number(),
          results: t.Array(t.Object({
            name: t.String(),
            slug: t.String(),
            creatures: t.Array(t.String()),
            engram_level: t.Nullable(t.Number()),
            image: t.Nullable(t.String()),
            url: t.String(),
          })),
        }),
      },
      detail: {
        summary: 'List all saddles',
        description: 'Returns a paginated list of saddles, including platform and Tek saddles.',
      },
    }
  )
  .get(
    '/:saddleName',
    ({ params, set, request }) => {
      const origin = new URL(request.url).origin
      const saddle = SaddleService.getBySlug(params.saddleName)
      if (!saddle) {
        set.status = 404
        return { message: `Saddle '${params.saddleName}' not found` }
      }
      return { ...saddle, image: saddle.image ? `${origin}${saddle.image}` : null }
    },
    {
      params: t.Object({
        saddleName: t.String({
          description: 'Saddle name. Case-insensitive; spaces, hyphens and underscores are interchangeable.',
          examples: ['rex_saddle', 'Mosasaur Tek Saddle'],
        }),
      }),
      response: {
        404: t.Object({ message: t.String() }),
      },
      detail: {
        summary: 'Get saddle by name',
        description: 'Returns full details for a single saddle: armor, engram, recipe and which creatures wear it.',
      },
    }
  )
