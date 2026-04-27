import Image from 'next/image'
import { ArmorService } from '@/services/armor'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

export const metadata = { title: 'Armor — Gigasaurus' }

export default async function ArmorPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const params = await searchParams
  const search = params.q?.toLowerCase()

  const { count, results } = ArmorService.getAll({ limit: 200 })
  const filtered = search
    ? results.filter((a) => a.set_name.toLowerCase().includes(search))
    : results

  const sorted = [...filtered].sort((a, b) => {
    const al = a.unlock_level ?? Number.POSITIVE_INFINITY
    const bl = b.unlock_level ?? Number.POSITIVE_INFINITY
    return al - bl
  })

  return (
    <main className="bg-background min-h-screen">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-3xl font-bold tracking-wide">Armor</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {count} armor sets — full-set crafting costs and protection ratings
          </p>
        </div>

        <form method="GET" action="/armor">
          <Input
            name="q"
            defaultValue={params.q}
            placeholder="Search armor…"
            className="max-w-sm"
          />
        </form>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {sorted.map((armor) => (
            <Card key={armor.slug} className="hover:border-primary/50 group h-full transition-colors">
              <CardContent className="flex flex-col items-center gap-2 p-3">
                <div className="bg-muted relative h-20 w-full overflow-hidden rounded-md">
                  {armor.image ? (
                    <Image
                      src={armor.image}
                      alt={armor.set_name}
                      fill
                      className="object-contain p-2 transition-transform group-hover:scale-105"
                      sizes="160px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl opacity-20">🛡️</div>
                  )}
                </div>
                <p className="text-center text-xs font-medium leading-tight">{armor.set_name}</p>
                <div className="flex flex-wrap items-center justify-center gap-1">
                  <Badge variant="secondary" className="text-[10px]">
                    AR {armor.armor_rating}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {armor.unlock_level !== null ? `Lv ${armor.unlock_level}` : 'Tekgram'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {sorted.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-muted-foreground text-sm">No armor matches your search.</p>
          </div>
        )}
      </div>
    </main>
  )
}
