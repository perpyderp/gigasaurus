import Link from 'next/link'
import Image from 'next/image'
import { CreatureService } from '@/services/creature'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

export const metadata = { title: 'Creatures — Gigasaurus' }

const CATEGORY_LABELS: Record<string, string> = {
  dinosaur: 'Dinosaur',
  fantasy: 'Fantasy',
  bird: 'Bird',
  fish: 'Fish',
  invertebrate: 'Invertebrate',
  mammal: 'Mammal',
  reptile: 'Reptile',
  other: 'Other',
}

export default function CreaturesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>
}) {
  // Server component — read query params synchronously via Next.js convention
  // (searchParams is a plain object in page components)
  const params = searchParams as unknown as { category?: string; q?: string }
  const categoryFilter = params.category
  const search = params.q?.toLowerCase()

  const { count, results } = CreatureService.getAll({
    category: categoryFilter,
    limit: 200,
  })

  const filtered = search
    ? results.filter((c) => c.name.toLowerCase().includes(search))
    : results

  const categories = [...new Set(
    CreatureService.getAll({ limit: 500 }).results.map((c) => c.category)
  )].sort()

  return (
    <main className="bg-background min-h-screen">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-3xl font-bold tracking-wide">Creatures</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {count} creatures across all ARK maps
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Link
            href="/creatures"
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
              href={`/creatures?category=${cat}`}
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

        {/* Search */}
        <form method="GET" action="/creatures">
          {categoryFilter && <input type="hidden" name="category" value={categoryFilter} />}
          <Input
            name="q"
            defaultValue={params.q}
            placeholder="Search creatures…"
            className="max-w-sm"
          />
        </form>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((creature) => (
            <Link key={creature.slug} href={`/creatures/${creature.slug}`}>
              <Card className="hover:border-primary/50 group h-full cursor-pointer transition-colors">
                <CardContent className="flex flex-col items-center gap-2 p-3">
                  <div className="bg-muted relative h-20 w-full overflow-hidden rounded-md">
                    {creature.image ? (
                      <Image
                        src={creature.image}
                        alt={creature.name}
                        fill
                        className="object-contain p-1 transition-transform group-hover:scale-105"
                        sizes="160px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl opacity-20">🦕</div>
                    )}
                  </div>
                  <p className="text-center text-xs font-medium leading-tight">{creature.name}</p>
                  <Badge variant="secondary" className="text-[10px]">
                    {CATEGORY_LABELS[creature.category] ?? creature.category}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-muted-foreground text-sm">No creatures match your search.</p>
          </div>
        )}
      </div>
    </main>
  )
}
