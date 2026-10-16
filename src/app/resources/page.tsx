import { Package } from 'lucide-react'
import { ResourceService } from '@/services/resource'
import { ResourceHoverCard } from '@/components/HoverPreview'
import {
  EmptyResults,
  FilterChips,
  GlossaryHeader,
  ResultCount,
  SearchField,
  SlotTile,
} from '@/components/Glossary'

export const metadata = { title: 'Resources — Gigasaurus' }

const RARITY_ORDER = ['common', 'uncommon', 'rare']

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ rarity?: string; q?: string }>
}) {
  const params = await searchParams
  const rarityFilter = params.rarity
  const search = params.q?.trim().toLowerCase()

  const { count, results } = ResourceService.getAll({ limit: 500 })
  const inRarity = rarityFilter ? results.filter((r) => r.rarity === rarityFilter) : results
  const filtered = search ? inRarity.filter((r) => r.name.toLowerCase().includes(search)) : inRarity

  const countByRarity = new Map<string, number>()
  for (const r of results) countByRarity.set(r.rarity, (countByRarity.get(r.rarity) ?? 0) + 1)
  const rarities = [...countByRarity.keys()].sort(
    (a, b) => (RARITY_ORDER.indexOf(a) + 1 || 99) - (RARITY_ORDER.indexOf(b) + 1 || 99),
  )

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-10">
      <GlossaryHeader
        title="Resources"
        summary="Everything you gather, farm or refine. The corner number is stack size; select one for weight and where to find it."
      >
        <SearchField
          action="/resources"
          defaultValue={params.q}
          placeholder="Search resources"
          label="Search resources"
          hidden={{ rarity: rarityFilter }}
        />
      </GlossaryHeader>

      <div className="space-y-3">
        <FilterChips
          label="Rarity"
          basePath="/resources"
          param="rarity"
          active={rarityFilter}
          keep={{ q: params.q }}
          options={rarities.map((r) => ({
            value: r,
            label: r.charAt(0).toUpperCase() + r.slice(1),
            count: countByRarity.get(r),
          }))}
        />
        <ResultCount shown={filtered.length} total={count} noun="resources" query={params.q} />
      </div>

      {filtered.length === 0 ? (
        <EmptyResults icon={Package} message="No resources match that search." resetHref="/resources" />
      ) : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
          {filtered.map((resource) => {
            const full = ResourceService.getBySlug(resource.slug)
            const tile = (
              <SlotTile
                name={resource.name}
                image={resource.image}
                fallbackIcon={Package}
                corner={full ? <span title="Stack size">{full.stack_size.toLocaleString()}</span> : undefined}
                meta={<span className="capitalize">{resource.rarity}</span>}
              />
            )
            return full ? (
              <ResourceHoverCard key={resource.slug} resource={full}>{tile}</ResourceHoverCard>
            ) : (
              <div key={resource.slug}>{tile}</div>
            )
          })}
        </div>
      )}
    </main>
  )
}
