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
            damage: t.Nullable(t.Number()),
            unlock_level: t.Nullable(t.Number()),
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
    '/:weaponName',
    ({ params, set, request }) => {
      const origin = new URL(request.url).origin
      const weapon = WeaponService.getBySlug(params.weaponName)
      if (!weapon) {
        set.status = 404
        return { message: `Weapon '${params.weaponName}' not found` }
      }
      return { ...weapon, image: weapon.image ? `${origin}${weapon.image}` : null }
    },
    {
      params: t.Object({
        weaponName: t.String({
          description: 'Weapon name. Case-insensitive; spaces, hyphens and underscores are interchangeable.',
          examples: ['longneck_rifle', 'Assault Rifle'],
        }),
      }),
      response: {
        404: t.Object({ message: t.String() }),
      },
      detail: {
        summary: 'Get weapon by name',
        description: 'Returns full details for a single weapon by name, e.g. `Assault Rifle`.',
      },
    }
  )
