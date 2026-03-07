import { describe, it, expect } from 'bun:test'
import { app } from '@/app/api/[[...slugs]]/route'
import { ResourceListSchema, ResourceDetailSchema } from '@/schemas/resource'

async function get(path: string) {
  return app.handle(new Request(`http://localhost${path}`))
}

// ─── List endpoint ────────────────────────────────────────────────────────────

describe('GET /api/resources', () => {
  it('returns 200', async () => {
    const res = await get('/api/resources')
    expect(res.status).toBe(200)
  })

  it('response matches ResourceListSchema', async () => {
    const res = await get('/api/resources')
    const json = await res.json()
    const parsed = ResourceListSchema.safeParse(json)
    expect(parsed.success).toBe(true)
  })

  it('has at least 16 resources', async () => {
    const res = await get('/api/resources?limit=100')
    const json = await res.json()
    expect(json.count).toBeGreaterThanOrEqual(16)
  })

  it('each item has required list fields', async () => {
    const res = await get('/api/resources')
    const { results } = await res.json()
    for (const item of results) {
      expect(typeof item.name).toBe('string')
      expect(typeof item.slug).toBe('string')
      expect(typeof item.rarity).toBe('string')
      expect(typeof item.url).toBe('string')
      expect(item.url).toStartWith('http://localhost/api/resources/')
    }
  })

  it('respects limit param', async () => {
    const res = await get('/api/resources?limit=5')
    const { results } = await res.json()
    expect(results.length).toBeLessThanOrEqual(5)
  })
})

// ─── Detail endpoint ──────────────────────────────────────────────────────────

describe('GET /api/resources/:slug', () => {
  it('returns 200 for fiber', async () => {
    const res = await get('/api/resources/fiber')
    expect(res.status).toBe(200)
  })

  it('fiber matches ResourceDetailSchema', async () => {
    const res = await get('/api/resources/fiber')
    const json = await res.json()
    const parsed = ResourceDetailSchema.safeParse(json)
    if (!parsed.success) console.error(parsed.error.flatten())
    expect(parsed.success).toBe(true)
  })

  it('fiber has correct fields', async () => {
    const res = await get('/api/resources/fiber')
    const json = await res.json()
    expect(json.name).toBe('Fiber')
    expect(json.slug).toBe('fiber')
    expect(json.rarity).toBe('common')
    expect(json.renewable).toBe(true)
    expect(typeof json.weight).toBe('number')
    expect(typeof json.stack_size).toBe('number')
    expect(Array.isArray(json.found_in)).toBe(true)
  })

  it('fiber has hexagon_exchange', async () => {
    const res = await get('/api/resources/fiber')
    const json = await res.json()
    expect(json.hexagon_exchange).not.toBeNull()
    expect(typeof json.hexagon_exchange.hexagons).toBe('number')
    expect(typeof json.hexagon_exchange.exchange_yields).toBe('number')
  })

  it('image field points to correct path', async () => {
    const res = await get('/api/resources/fiber')
    const json = await res.json()
    expect(json.image).toBe('http://localhost/images/resources/fiber.png')
  })

  it('returns 200 for metal_ingot', async () => {
    const res = await get('/api/resources/metal_ingot')
    expect(res.status).toBe(200)
  })

  it('returns 404 for unknown slug', async () => {
    const res = await get('/api/resources/unobtainium')
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.message).toContain('unobtainium')
  })
})
