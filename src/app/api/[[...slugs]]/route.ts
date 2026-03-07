import { Elysia } from 'elysia'
import { openapi } from '@elysiajs/openapi'
import { creaturesRoutes } from '@/routes/creatures'
import { resourceRoutes } from '@/routes/resources'
import { armorRoutes } from '@/routes/armor'
import { weaponRoutes } from '@/routes/weapons'

export const app = new Elysia({ prefix: '/api' })
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
  .get('/', () => ({
    message: 'Welcome to the Gigasaurus API',
    version: '1.0.0',
    documentation: '/api/openapi',
    endpoints: {
      creatures: '/api/creatures',
      armor: '/api/armor',
      weapons: '/api/weapons',
      resources: '/api/resources',
    },
  }))
  .use(creaturesRoutes)
  .use(armorRoutes)
  .use(weaponRoutes)
  .use(resourceRoutes)

export const GET = app.fetch
export const POST = app.fetch