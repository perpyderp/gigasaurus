import { Elysia, t } from 'elysia'
import { openapi } from '@elysiajs/openapi'
import { cors } from '@elysiajs/cors'
import { creaturesRoutes } from '@/routes/creatures'
import { resourceRoutes } from '@/routes/resources'
import { armorRoutes } from '@/routes/armor'
import { weaponRoutes } from '@/routes/weapons'

export const app = new Elysia({ prefix: '/api' })
  .use(cors())
  .onError(({ code, error, set }) => {
    if (code === 'NOT_FOUND') {
      set.status = 404
      return { message: 'Route not found' }
    }
    if (code === 'VALIDATION') {
      set.status = 422
      return { message: 'Validation error', details: error.message }
    }
    set.status = 500
    return { message: 'Internal server error' }
  })
  .use(
    openapi({
      documentation: {
        info: {
          title: 'Gigasaurus API',
          version: '1.0.0',
          description:
            'A RESTful API for ARK: Survival Ascended/Evolved game data — creatures, armor, weapons, and resources. Inspired by PokéAPI.',
          contact: {
            name: 'Gigasaurus',
            url: 'https://github.com/perpyderp/gigasaurus',
          },
          license: {
            name: 'MIT',
          },
        },
        tags: [
          { name: 'Creatures', description: 'Tameable and non-tameable creatures across all ARK maps' },
          { name: 'Armor', description: 'Craftable armor sets with stats and ingredient costs' },
          { name: 'Weapons', description: 'Tools, melee, ranged, firearms, explosives, and Tek-tier weapons' },
          { name: 'Resources', description: 'Raw and refined materials used for crafting' },
        ],
      },
    })
  )
  .get(
    '/',
    () => ({
      message: 'Welcome to the Gigasaurus API',
      version: '1.0.0',
      documentation: '/api/openapi',
      endpoints: {
        creatures: '/api/creatures',
        armor: '/api/armor',
        weapons: '/api/weapons',
        resources: '/api/resources',
      },
    }),
    {
      response: t.Object({
        message: t.String(),
        version: t.String(),
        documentation: t.String(),
        endpoints: t.Object({
          creatures: t.String(),
          armor: t.String(),
          weapons: t.String(),
          resources: t.String(),
        }),
      }),
      detail: { summary: 'API index', description: 'Returns all available endpoints.' },
    }
  )
  .use(creaturesRoutes)
  .use(armorRoutes)
  .use(weaponRoutes)
  .use(resourceRoutes)

export const GET = app.fetch
export const POST = app.fetch