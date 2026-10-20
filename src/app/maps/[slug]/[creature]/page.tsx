import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ArrowLeft, Map as MapIcon, PawPrint } from 'lucide-react'
import { MapService } from '@/services/map'
import { CreatureService } from '@/services/creature'
import { MapCanvas, RARITY } from '@/components/MapCanvas'
import { JsonLd, breadcrumbs } from '@/components/JsonLd'
import { buttonVariants } from '@/components/ui/button-variants'
import { regionsForSpawns } from '@/lib/map-geometry'
import { toSlug } from '@/lib/slug'
import type { MapDetail } from '@/schemas/map'

/**
 * One prerendered landing page per creature per map it spawns on, for searches
 * like "bloodstalker genesis spawn". Deliberately light: the spawn overlay and
 * links, not the whole interactive map (1,600+ of these are built).
 */
export const dynamicParams = false

/** Creature slugs with a creature page that spawn on `map`. */
function creaturesOn(map: MapDetail) {
  return [...new Set(map.creatures.flatMap((c) => (c.creature && CreatureService.getBySlug(c.creature) ? [c.creature] : [])))]
}

export async function generateStaticParams() {
  return MapService.getAll().results.flatMap((m) => creaturesOn(MapService.getBySlug(m.slug)!).map((creature) => ({ slug: m.slug, creature })))
}

function load(slug: string, creatureSlug: string) {
  const map = MapService.getBySlug(slug)
  const creature = CreatureService.getBySlug(creatureSlug)
  if (!map || !creature) return null
  const entries = map.creatures.filter((c) => c.creature === creature.slug)
  if (!entries.length) return null
  const regions = entries.flatMap((e) => e.regions)
  const points = entries.flatMap((e) => e.points)
  return {
    map,
    creature,
    regions,
    points,
    tameable: entries.some((e) => e.tameable),
    mostlyIn: regionsForSpawns(map.regions, regions, points, 3),
  }
}

type Data = NonNullable<ReturnType<typeof load>>

const list = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items[0])

function summary({ map, creature, regions, points, tameable, mostlyIn }: Data) {
  const areas = regions.length + points.length
  return [
    `Where ${creature.name} spawns on ${map.name} in ARK: Survival Ascended: ${areas} spawn ${areas === 1 ? 'area' : 'areas'}.`,
    mostlyIn.length ? `Mostly found in ${list(mostlyIn)}.` : '',
    tameable ? '' : `It can't be tamed on ${map.name}.`,
  ]
    .filter(Boolean)
    .join(' ')
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; creature: string }> }): Promise<Metadata> {
  const { slug, creature: creatureSlug } = await params
  const data = load(slug, creatureSlug)
  if (!data) return { title: 'Not Found' }
  const { map, creature } = data
  const path = `/maps/${map.slug}/${creature.slug}`
  const title = `${creature.name} Spawn Locations on ${map.name}`
  const description = summary(data)
  const n = creature.name.toLowerCase()
  const m = map.name.toLowerCase()
  return {
    title,
    description,
    keywords: [`${n} ${m}`, `${n} spawn ${m}`, `${n} location ${m}`, `where to find ${n}`, `ark ${n}`, `ark ${m}`],
    alternates: { canonical: path },
    openGraph: { title, description, url: path, images: creature.image ? [{ url: creature.image, alt: creature.name }] : undefined },
  }
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-card ring-border rounded-xl p-5 ring-1">
      <h2 className="font-display mb-4 text-xl">{title}</h2>
      {children}
    </section>
  )
}

const chip = 'bg-secondary hover:text-primary inline-flex h-8 items-center rounded-md px-2.5 text-sm transition-colors'

export default async function CreatureOnMapPage({ params }: { params: Promise<{ slug: string; creature: string }> }) {
  const { slug, creature: creatureSlug } = await params
  const data = load(slug, creatureSlug)
  if (!data) notFound()
  const { map, creature, regions, points, mostlyIn } = data

  const otherMaps = MapService.forCreature(creature.slug).filter((s) => s.map !== map.slug)
  const neighbours = creaturesOn(map)
    .filter((s) => s !== creature.slug)
    .map((s) => CreatureService.getBySlug(s)!)
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <JsonLd
        data={breadcrumbs([
          { name: 'Maps', path: '/maps' },
          { name: map.name, path: `/maps/${map.slug}` },
          { name: creature.name, path: `/maps/${map.slug}/${creature.slug}` },
        ])}
      />
      <Link
        href={`/maps/${map.slug}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" /> {map.name}
      </Link>

      <h1 className="font-display mt-4 text-4xl leading-none text-balance sm:text-5xl">
        {creature.name} spawns on {map.name}
      </h1>
      <p className="text-muted-foreground mt-3 max-w-2xl text-[15px]">{summary(data)}</p>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <div className="space-y-3">
          <MapCanvas image={map.image!} label={`Spawn areas for ${creature.name} on ${map.name}`} priority regions={regions} points={points} />
          <ul aria-label="Spawn rarity" className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
            {RARITY.toReversed().map((r) => (
              <li key={r.label} className="flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-sm ring-1 ring-black/30" style={{ backgroundColor: r.color }} />
                {r.label}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">
            Spawn data from {map.spawn_data === 'ASA' ? 'ARK: Survival Ascended' : 'ARK: Survival Evolved'}, mined from the game files by the
            ARK Wiki. Creatures roam a little outside their areas.
          </p>
        </div>

        <div className="space-y-6">
          <section className="bg-card ring-border overflow-hidden rounded-xl ring-1">
            <Link href={`/creatures/${creature.slug}`} className="group block">
              <div className="bg-plate relative aspect-[3/2]">
                {creature.image ? (
                  <Image src={creature.image} alt="" fill sizes="(min-width: 1024px) 30vw, 100vw" className="object-cover" />
                ) : (
                  <PawPrint aria-hidden className="absolute inset-0 m-auto size-10 text-white/25" />
                )}
              </div>
              <p className="font-display group-hover:text-primary px-5 pt-4 text-2xl leading-tight transition-colors">{creature.name}</p>
            </Link>
            <p className="text-muted-foreground px-5 pb-1 text-sm">
              Taming, base stats, breeding and colors are on the{' '}
              <Link href={`/creatures/${creature.slug}`} className="text-primary font-medium underline-offset-4 hover:underline">
                {creature.name} page
              </Link>
              .
            </p>
            <div className="p-5 pt-3">
              <Link href={`/maps/${map.slug}?creature=${creature.slug}`} className={buttonVariants({ size: 'lg', className: 'w-full' })}>
                <MapIcon aria-hidden /> Open the interactive {map.name} map
              </Link>
            </div>
          </section>

          {mostlyIn.length > 0 && (
            <Panel title="Mostly found in">
              <ul className="flex flex-wrap gap-1.5">
                {mostlyIn.map((region) => (
                  <li key={region}>
                    <Link href={`/maps/${map.slug}?tab=places&place=region-${toSlug(region)}`} prefetch={false} className={chip}>
                      {region}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {otherMaps.length > 0 && (
            <Panel title="Also spawns on">
              <ul className="flex flex-wrap gap-1.5">
                {otherMaps.map((s) => (
                  <li key={s.map}>
                    <Link href={`/maps/${s.map}/${creature.slug}`} prefetch={false} className={chip}>
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>

      {neighbours.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display mb-4 text-xl">Other creatures on {map.name}</h2>
          <ul className="flex flex-wrap gap-1.5">
            {neighbours.map((c) => (
              <li key={c.slug}>
                <Link href={`/maps/${map.slug}/${c.slug}`} prefetch={false} className={chip}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
