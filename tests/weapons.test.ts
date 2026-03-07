import { describe, it, expect } from 'bun:test'
import { app } from '@/app/api/[[...slugs]]/route'
import { WeaponListSchema, WeaponDetailSchema } from '@/schemas/weapon'

async function get(path: string) {
  return app.handle(new Request(`http://localhost${path}`))
}

// ─── List endpoint ────────────────────────────────────────────────────────────

describe('GET /api/weapons', () => {
  it('returns 200', async () => {
    const res = await get('/api/weapons')
    expect(res.status).toBe(200)
  })

  it('response matches WeaponListSchema', async () => {
    const res = await get('/api/weapons')
    const json = await res.json()
    const parsed = WeaponListSchema.safeParse(json)
    expect(parsed.success).toBe(true)
  })

  it('has at least 13 weapons', async () => {
    const res = await get('/api/weapons?limit=100')
    const json = await res.json()
    expect(json.count).toBeGreaterThanOrEqual(13)
  })

  it('each item has required list fields', async () => {
    const res = await get('/api/weapons')
    const { results } = await res.json()
    for (const item of results) {
      expect(typeof item.name).toBe('string')
      expect(typeof item.slug).toBe('string')
      expect(typeof item.category).toBe('string')
      expect(typeof item.url).toBe('string')
      expect(item.url).toStartWith('http://localhost/api/weapons/')
    }
  })

  it('filters by category=tool', async () => {
    const res = await get('/api/weapons?category=tool&limit=100')
    const { results } = await res.json()
    expect(results.length).toBeGreaterThan(0)
    for (const item of results) {
      expect(item.category).toBe('tool')
    }
  })

  it('filters by category=firearm', async () => {
    const res = await get('/api/weapons?category=firearm&limit=100')
    const { results } = await res.json()
    expect(results.length).toBeGreaterThan(0)
    for (const item of results) {
      expect(item.category).toBe('firearm')
    }
  })

  it('respects limit param', async () => {
    const res = await get('/api/weapons?limit=3')
    const { results } = await res.json()
    expect(results.length).toBeLessThanOrEqual(3)
  })
})

// ─── Detail endpoint ──────────────────────────────────────────────────────────

describe('GET /api/weapons/:slug', () => {
  it('returns 200 for longneck_rifle', async () => {
    const res = await get('/api/weapons/longneck_rifle')
    expect(res.status).toBe(200)
  })

  it('longneck_rifle matches WeaponDetailSchema', async () => {
    const res = await get('/api/weapons/longneck_rifle')
    const json = await res.json()
    const parsed = WeaponDetailSchema.safeParse(json)
    if (!parsed.success) console.error(parsed.error.flatten())
    expect(parsed.success).toBe(true)
  })

  it('longneck_rifle has correct fields', async () => {
    const res = await get('/api/weapons/longneck_rifle')
    const json = await res.json()
    expect(json.name).toBe('Longneck Rifle')
    expect(json.slug).toBe('longneck_rifle')
    expect(json.category).toBe('firearm')
    expect(json.damage).toBe(280)
    expect(json.unlock_level).toBe(35)
    expect(json.ammo_type).toBe('Rifle Ammo')
    expect(Array.isArray(json.ingredients)).toBe(true)
  })

  it('longneck_rifle ingredients have resource_id for cross-referencing', async () => {
    const res = await get('/api/weapons/longneck_rifle')
    const { ingredients } = await res.json()
    for (const ing of ingredients) {
      expect(typeof ing.name).toBe('string')
      expect(typeof ing.quantity).toBe('number')
      expect(typeof ing.resource_id).toBe('string')
    }
  })

  it('stone_pick has correct tool category', async () => {
    const res = await get('/api/weapons/stone_pick')
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.category).toBe('tool')
    expect(json.ammo_type).toBeNull()
  })

  it('image field points to correct path', async () => {
    const res = await get('/api/weapons/bow')
    const json = await res.json()
    expect(json.image).toBe('http://localhost/images/weapons/bow.png')
  })

  it('returns 404 for unknown slug', async () => {
    const res = await get('/api/weapons/laser_cannon')
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.message).toContain('laser_cannon')
  })
})
