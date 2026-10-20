import { describe, it, expect } from 'bun:test'
import { app } from '@/app/api/[[...slugs]]/route'
import { SaddleListSchema, SaddleDetailSchema } from '@/schemas/saddle'
import { SaddleService } from '@/services/saddle'

async function get(path: string) {
  return app.handle(new Request(`http://localhost${path}`))
}

describe('GET /api/saddles', () => {
  it('matches SaddleListSchema', async () => {
    const res = await get('/api/saddles?limit=200')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(SaddleListSchema.safeParse(json).success).toBe(true)
    expect(json.count).toBeGreaterThanOrEqual(100)
  })

  it('filters by creature', async () => {
    const json = await (await get('/api/saddles?creature=rex')).json()
    const names = json.results.map((s: { name: string }) => s.name)
    expect(names).toEqual(['Rex Saddle', 'Rex Tek Saddle'])
  })
})

describe('GET /api/saddles/:saddleName', () => {
  it('returns a saddle by name with an absolute image URL', async () => {
    const res = await get('/api/saddles/Rex%20Saddle')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(SaddleDetailSchema.safeParse(json).success).toBe(true)
    expect(json.engram_level).toBe(74)
    expect(json.image).toStartWith('http://localhost/images/saddles/')
  })

  it('404s for an unknown saddle', async () => {
    expect((await get('/api/saddles/unicorn_saddle')).status).toBe(404)
  })
})

describe('SaddleService.forCreature', () => {
  it('orders standard, platform, then Tek', () => {
    const kinds = SaddleService.forCreature('mosasaurus').map((s) => (s.tek ? 'tek' : s.platform ? 'platform' : 'standard'))
    expect(kinds).toEqual(['standard', 'platform', 'tek'])
  })
})
