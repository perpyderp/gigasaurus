import { PawPrint } from 'lucide-react'
import { CreatureService } from '@/services/creature'
import { CreatureHoverCard } from '@/components/HoverPreview'
import {
  DossierTile,
  EmptyResults,
  FilterChips,
  GlossaryHeader,
  ResultCount,
  SearchField,
} from '@/components/Glossary'

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

export default async function CreaturesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>
}) {
  const params = await searchParams
  const categoryFilter = params.category
  const search = params.q?.trim().toLowerCase()

  const all = CreatureService.getAll({ limit: 500 }).results
  const inCategory = categoryFilter ? all.filter((c) => c.category === categoryFilter) : all
  const filtered = search ? inCategory.filter((c) => c.name.toLowerCase().includes(search)) : inCategory

  const countByCategory = new Map<string, number>()
  for (const c of all) countByCategory.set(c.category, (countByCategory.get(c.category) ?? 0) + 1)
  const categories = [...countByCategory.keys()].sort()

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-10">
      <GlossaryHeader
        title="Creatures"
        summary="Every tameable, rideable and hostile creature across the ARK maps. Hover a dossier for base stats; open it for taming and breeding."
      >
        <SearchField
          action="/creatures"
          defaultValue={params.q}
          placeholder="Search creatures"
          label="Search creatures"
          hidden={{ category: categoryFilter }}
        />
      </GlossaryHeader>

      <div className="space-y-3">
        <FilterChips
          label="Creature category"
          basePath="/creatures"
          param="category"
          active={categoryFilter}
          keep={{ q: params.q }}
          options={categories.map((cat) => ({
            value: cat,
            label: CATEGORY_LABELS[cat] ?? cat,
            count: countByCategory.get(cat),
          }))}
        />
        <ResultCount shown={filtered.length} total={all.length} noun="creatures" query={params.q} />
      </div>

      {filtered.length === 0 ? (
        <EmptyResults icon={PawPrint} message="No creatures match that search." resetHref="/creatures" />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((creature) => {
            const full = CreatureService.getBySlug(creature.slug)
            const tile = (
              <DossierTile
                href={`/creatures/${creature.slug}`}
                name={creature.name}
                image={creature.image}
                meta={CATEGORY_LABELS[creature.category] ?? creature.category}
              />
            )
            return full ? (
              <CreatureHoverCard key={creature.slug} creature={full}>{tile}</CreatureHoverCard>
            ) : (
              <div key={creature.slug}>{tile}</div>
            )
          })}
        </div>
      )}
    </main>
  )
}
