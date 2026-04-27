import Link from 'next/link'
import Image from 'next/image'
import { ResourceService } from '@/services/resource'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

export const metadata = { title: 'Resources — Gigasaurus' }

const RARITY_VARIANT: Record<string, 'secondary' | 'outline' | 'default'> = {
  common: 'secondary',
  uncommon: 'outline',
  rare: 'default',
}

export default function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ rarity?: string; q?: string }>
}) {
  const params = searchParams as unknown as { rarity?: string; q?: string }
  const rarityFilter = params.rarity
  const search = params.q?.toLowerCase()

  const { count, results } = ResourceService.getAll({ limit: 500 })
  let filtered = rarityFilter ? results.filter((r) => r.rarity === rarityFilter) : results
  if (search) filtered = filtered.filter((r) => r.name.toLowerCase().includes(search))

  const rarities = [...new Set(results.map((r) => r.rarity))]

  return (
    <main className="bg-background min-h-screen">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-3xl font-bold tracking-wide">Resources</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {count} resources — rarity, stack size, and where to find them
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/resources"
            className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
              !rarityFilter
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:bg-accent'
            }`}
          >
            All
          </Link>
          {rarities.map((r) => (
            <Link
              key={r}
              href={`/resources?rarity=${r}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                rarityFilter === r
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              {r}
            </Link>
          ))}
        </div>

        <form method="GET" action="/resources">
          {rarityFilter && <input type="hidden" name="rarity" value={rarityFilter} />}
          <Input
            name="q"
            defaultValue={params.q}
            placeholder="Search resources…"
            className="max-w-sm"
          />
        </form>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((resource) => (
            <Card key={resource.slug} className="hover:border-primary/50 group h-full transition-colors">
              <CardContent className="flex flex-col items-center gap-2 p-3">
                <div className="bg-muted relative h-20 w-full overflow-hidden rounded-md">
                  {resource.image ? (
                    <Image
                      src={resource.image}
                      alt={resource.name}
                      fill
                      className="object-contain p-2 transition-transform group-hover:scale-105"
                      sizes="160px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl opacity-20">📦</div>
                  )}
                </div>
                <p className="text-center text-xs font-medium leading-tight">{resource.name}</p>
                <Badge
                  variant={RARITY_VARIANT[resource.rarity] ?? 'outline'}
                  className="text-[10px] capitalize"
                >
                  {resource.rarity}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-muted-foreground text-sm">No resources match your search.</p>
          </div>
        )}
      </div>
    </main>
  )
}
