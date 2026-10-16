import { Shield } from 'lucide-react'
import { ArmorService } from '@/services/armor'
import { ArmorHoverCard } from '@/components/HoverPreview'
import { EmptyResults, GlossaryHeader, ResultCount, SearchField, SlotTile } from '@/components/Glossary'

export const metadata = { title: 'Armor — Gigasaurus' }

export default async function ArmorPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const params = await searchParams
  const search = params.q?.trim().toLowerCase()

  const { count, results } = ArmorService.getAll({ limit: 200 })
  const filtered = search ? results.filter((a) => a.set_name.toLowerCase().includes(search)) : results

  // Progression order: what you can craft first comes first; Tekgrams last.
  const sorted = [...filtered].sort(
    (a, b) => (a.unlock_level ?? Number.POSITIVE_INFINITY) - (b.unlock_level ?? Number.POSITIVE_INFINITY),
  )

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-10">
      <GlossaryHeader
        title="Armor"
        summary="Armor sets in unlock order. The corner number is armor rating; select a set for protection values and the full-set crafting cost."
      >
        <SearchField action="/armor" defaultValue={params.q} placeholder="Search armor" label="Search armor" />
      </GlossaryHeader>

      <ResultCount shown={sorted.length} total={count} noun="armor sets" query={params.q} />

      {sorted.length === 0 ? (
        <EmptyResults icon={Shield} message="No armor matches that search." resetHref="/armor" />
      ) : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
          {sorted.map((armor) => {
            const full = ArmorService.getBySlug(armor.slug)
            const tile = (
              <SlotTile
                name={armor.set_name}
                image={armor.image}
                fallbackIcon={Shield}
                corner={<span title="Armor rating">{armor.armor_rating}</span>}
                meta={armor.unlock_level !== null ? `Level ${armor.unlock_level}` : 'Tekgram'}
              />
            )
            return full ? (
              <ArmorHoverCard key={armor.slug} armor={full}>{tile}</ArmorHoverCard>
            ) : (
              <div key={armor.slug}>{tile}</div>
            )
          })}
        </div>
      )}
    </main>
  )
}
