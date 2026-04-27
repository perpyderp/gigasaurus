import Link from 'next/link'
import Image from 'next/image'
import { WeaponService } from '@/services/weapon'
import type { WeaponCategory } from '@/schemas/weapon'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

export const metadata = { title: 'Weapons — Gigasaurus' }

const CATEGORY_LABELS: Record<WeaponCategory, string> = {
  tool: 'Tool',
  melee: 'Melee',
  ranged: 'Ranged',
  firearm: 'Firearm',
  explosive: 'Explosive',
  tek: 'Tek',
  shield: 'Shield',
  turret: 'Turret',
  attachment: 'Attachment',
}

export default function WeaponsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>
}) {
  const params = searchParams as unknown as { category?: WeaponCategory; q?: string }
  const categoryFilter = params.category
  const search = params.q?.toLowerCase()

  const { count, results } = WeaponService.getAll({ category: categoryFilter, limit: 200 })
  const filtered = search
    ? results.filter((w) => w.name.toLowerCase().includes(search))
    : results

  const categories = [
    ...new Set(WeaponService.getAll({ limit: 500 }).results.map((w) => w.category)),
  ].sort()

  return (
    <main className="bg-background min-h-screen">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-3xl font-bold tracking-wide">Weapons</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {count} weapons — damage, unlock requirements, and crafting costs
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/weapons"
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              !categoryFilter
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:bg-accent'
            }`}
          >
            All
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat}
              href={`/weapons?category=${cat}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                categoryFilter === cat
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </Link>
          ))}
        </div>

        <form method="GET" action="/weapons">
          {categoryFilter && <input type="hidden" name="category" value={categoryFilter} />}
          <Input
            name="q"
            defaultValue={params.q}
            placeholder="Search weapons…"
            className="max-w-sm"
          />
        </form>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((weapon) => (
            <Card key={weapon.slug} className="hover:border-primary/50 group h-full transition-colors">
              <CardContent className="flex flex-col items-center gap-2 p-3">
                <div className="bg-muted relative h-20 w-full overflow-hidden rounded-md">
                  {weapon.image ? (
                    <Image
                      src={weapon.image}
                      alt={weapon.name}
                      fill
                      className="object-contain p-2 transition-transform group-hover:scale-105"
                      sizes="160px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl opacity-20">⚔️</div>
                  )}
                </div>
                <p className="text-center text-xs font-medium leading-tight">{weapon.name}</p>
                <div className="flex flex-wrap items-center justify-center gap-1">
                  <Badge variant="secondary" className="text-[10px]">
                    {CATEGORY_LABELS[weapon.category] ?? weapon.category}
                  </Badge>
                  {weapon.damage !== null && (
                    <Badge variant="outline" className="text-[10px]">
                      {weapon.damage} dmg
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-muted-foreground text-sm">No weapons match your search.</p>
          </div>
        )}
      </div>
    </main>
  )
}
