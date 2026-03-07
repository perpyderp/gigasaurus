import { Elysia, t } from 'elysia'
import { WeaponService } from '@/services/weapon'

const WEAPON_CATEGORIES = ['tool', 'melee', 'ranged', 'firearm', 'explosive', 'tek', 'shield', 'turret', 'attachment'] as const

export const weaponRoutes = new Elysia({ prefix: '/weapons', tags: ['Weapons'] })
  .get(
    '/',
    ({ query, request }) => {
      const origin = new URL(request.url).origin
      const result = WeaponService.getAll({
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
          t.Union(WEAPON_CATEGORIES.map((c) => t.Literal(c)))
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
        summary: 'List all weapons',
        description:
          'Returns a paginated list of all weapons. Filter by category (tool, melee, ranged, firearm, explosive, tek, shield, turret, attachment).',
      },
    }
  )
  .get(
    '/:slug',
    ({ params, set, request }) => {
      const origin = new URL(request.url).origin
      const weapon = WeaponService.getBySlug(params.slug)
      if (!weapon) {
        set.status = 404
        return { message: `Weapon '${params.slug}' not found` }
      }
      return { ...weapon, image: weapon.image ? `${origin}${weapon.image}` : null }
    },
    {
      params: t.Object({ slug: t.String() }),
      response: {
        404: t.Object({ message: t.String() }),
      },
      detail: {
        summary: 'Get weapon by slug',
        description: 'Returns full details for a single weapon by its slug.',
      },
    }
  )
