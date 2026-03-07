import { Elysia, t } from 'elysia'
import { ArmorService } from '@/services/armor'

export const armorRoutes = new Elysia({ prefix: '/armor', tags: ['Armor'] })
  .get(
    '/',
    ({ query, request }) => {
      const origin = new URL(request.url).origin
      const result = ArmorService.getAll({
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
      response: {
        200: t.Object({
          count: t.Number(),
          results: t.Array(t.Object({
            set_name: t.String(),
            slug: t.String(),
            image: t.Nullable(t.String()),
            url: t.String(),
          })),
        }),
      },
      detail: {
        summary: 'List all armor sets',
        description: 'Returns a paginated list of all armor sets.',
      },
    }
  )
  .get(
    '/:slug',
    ({ params, set, request }) => {
      const origin = new URL(request.url).origin
      const armor = ArmorService.getBySlug(params.slug)
      if (!armor) {
        set.status = 404
        return { message: `Armor set '${params.slug}' not found` }
      }
      return { ...armor, image: armor.image ? `${origin}${armor.image}` : null }
    },
    {
      params: t.Object({ slug: t.String() }),
      response: {
        404: t.Object({ message: t.String() }),
      },
      detail: {
        summary: 'Get armor set by slug',
        description: 'Returns full details for a single armor set by its slug, including per-set ingredient costs.',
      },
    }
  )
