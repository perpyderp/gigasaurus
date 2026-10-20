import { Sword } from 'lucide-react'
import { WeaponService } from '@/services/weapon'
import type { WeaponCategory } from '@/schemas/weapon'
import { WeaponHoverCard } from '@/components/HoverPreview'
import {
  EmptyResults,
  FilterChips,
  GlossaryHeader,
  ResultCount,
  SearchField,
  SlotTile,
} from '@/components/Glossary'

export const metadata = {
  title: 'ARK Weapons: Damage, Crafting & Stats',
  description: 'Every ARK: Survival Ascended weapon with damage, ammo, unlock level and crafting costs.',
  alternates: { canonical: '/weapons' },
}

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

export default async function WeaponsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>
}) {
  const params = (await searchParams) as { category?: WeaponCategory; q?: string }
  const categoryFilter = params.category
  const search = params.q?.trim().toLowerCase()

  const all = WeaponService.getAll({ limit: 500 }).results
  const inCategory = categoryFilter ? all.filter((w) => w.category === categoryFilter) : all
  const filtered = search ? inCategory.filter((w) => w.name.toLowerCase().includes(search)) : inCategory

  const countByCategory = new Map<WeaponCategory, number>()
  for (const w of all) countByCategory.set(w.category, (countByCategory.get(w.category) ?? 0) + 1)
  const categories = [...countByCategory.keys()].sort()

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-10">
      <GlossaryHeader
        title="Weapons"
        summary="Tools, guns, explosives and Tek gear. The corner number is base damage; select one for ammo, unlock level and crafting cost."
      >
        <SearchField
          action="/weapons"
          defaultValue={params.q}
          placeholder="Search weapons"
          label="Search weapons"
          hidden={{ category: categoryFilter }}
        />
      </GlossaryHeader>

      <div className="space-y-3">
        <FilterChips
          label="Weapon category"
          basePath="/weapons"
          param="category"
          active={categoryFilter}
          keep={{ q: params.q }}
          options={categories.map((cat) => ({
            value: cat,
            label: CATEGORY_LABELS[cat] ?? cat,
            count: countByCategory.get(cat),
          }))}
        />
        <ResultCount shown={filtered.length} total={all.length} noun="weapons" query={params.q} />
      </div>

      {filtered.length === 0 ? (
        <EmptyResults icon={Sword} message="No weapons match that search." resetHref="/weapons" />
      ) : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
          {filtered.map((weapon) => {
            const full = WeaponService.getBySlug(weapon.slug)
            const tile = (
              <SlotTile
                name={weapon.name}
                image={weapon.image}
                fallbackIcon={Sword}
                corner={weapon.damage !== null ? <span title="Damage">{weapon.damage}</span> : undefined}
                meta={CATEGORY_LABELS[weapon.category] ?? weapon.category}
              />
            )
            return full ? (
              <WeaponHoverCard key={weapon.slug} weapon={full}>{tile}</WeaponHoverCard>
            ) : (
              <div key={weapon.slug}>{tile}</div>
            )
          })}
        </div>
      )}
    </main>
  )
}
