import { Elysia, t } from 'elysia'
import { CreatureService } from '@/services/creature'

const CREATURE_CATEGORIES = ['dinosaur', 'fantasy', 'bird', 'fish', 'invertebrate', 'mammal', 'reptile', 'other'] as const

export const creaturesRoutes = new Elysia({ prefix: '/creatures', tags: ['Creatures'] })
  .get(
    '/',
    ({ query, request }) => {
      const origin = new URL(request.url).origin
      const result = CreatureService.getAll({
        category: query.category,
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
        category: t.Optional(
          t.Union(CREATURE_CATEGORIES.map((c) => t.Literal(c)))
        ),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20 })),
        offset: t.Optional(t.Numeric({ minimum: 0, default: 0 })),
      }),
      response: {
        200: t.Object({
          count: t.Number(),
          results: t.Array(t.Object({
            name: t.String(),
            slug: t.String(),
            category: t.String(),
            image: t.Nullable(t.String()),
            url: t.String(),
          })),
        }),
      },
      detail: {
        summary: 'List all creatures',
        description:
          'Returns a paginated list of all creatures. Filter by category using the `category` query param.',
      },
    }
  )
  .get(
    '/:slug',
    ({ params, set, request }) => {
      const origin = new URL(request.url).origin
      const creature = CreatureService.getBySlug(params.slug)
      if (!creature) {
        set.status = 404
        return { message: `Creature '${params.slug}' not found` }
      }
      return { ...creature, image: creature.image ? `${origin}${creature.image}` : null }
    },
    {
      params: t.Object({ slug: t.String() }),
      response: {
        404: t.Object({ message: t.String() }),
      },
      detail: {
        summary: 'Get creature by slug',
        description: 'Returns full details for a single creature by its slug.',
      },
    }
  )
