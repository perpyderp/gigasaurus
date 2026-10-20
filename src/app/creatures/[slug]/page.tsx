import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ArrowLeft, Check, ExternalLink, PawPrint } from 'lucide-react'
import { CreatureService } from '@/services/creature'
import type { CreatureDetail } from '@/schemas/creature'
import { MySpeciesCreatures } from '@/components/MySpeciesCreatures'
import { CreatureSpawnMaps } from '@/components/CreatureSpawnMaps'
import { MapService } from '@/services/map'
import { CreatureSaddles } from '@/components/CreatureSaddles'
import { SaddleService } from '@/services/saddle'
import { mapSlug } from '@/lib/map-order'
import { STAT_CONFIG, type RelevantStat } from '@/lib/stat-calc'
import { JsonLd, breadcrumbs } from '@/components/JsonLd'

export async function generateStaticParams() {
  const { results } = CreatureService.getAll({ limit: 500 })
  return results.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const creature = CreatureService.getBySlug(slug)
  if (!creature) return { title: 'Creature Not Found' }
  const maps = MapService.forCreature(creature.slug).map((s) => s.name)
  const path = `/creatures/${creature.slug}`
  const title = creature.tameable
    ? `${creature.name}: Taming, Stats & Spawn Locations (ARK Ascended)`
    : `${creature.name}: Stats & Spawn Locations (ARK Ascended)`
  const where = maps.length ? ` Spawns on ${maps.length > 3 ? `${maps.slice(0, 3).join(', ')} and ${maps.length - 3} more maps` : maps.join(', ')}.` : ''
  const description = `${creature.name} in ARK: Survival Ascended: ${creature.tameable ? 'how to tame it, ' : ''}base stats and growth, ${creature.breedable ? 'breeding times, ' : ''}color regions and spawn maps.${where}${creature.dossier?.wild ? ` ${creature.dossier.wild}` : ''}`
  const n = creature.name.toLowerCase()
  return {
    title,
    description,
    keywords: [
      n,
      `ark ${n}`,
      `${n} ark ascended`,
      ...(creature.tameable ? [`${n} taming`, `how to tame ${n}`] : []),
      `${n} spawn`,
      ...maps.map((m) => `${n} ${m.toLowerCase()}`),
      ...(creature.alternate_names ?? []).map((a) => a.toLowerCase()),
    ],
    alternates: { canonical: path },
    openGraph: { title, description, url: path, images: creature.image ? [{ url: creature.image, alt: creature.name }] : undefined },
  }
}

// Species data keys → the stat keys (and colors) used for imported creatures.
const STAT_ORDER: Array<{ key: keyof CreatureDetail['base_stats_growth']; stat: RelevantStat; unit?: string }> = [
  { key: 'health', stat: 'health' },
  { key: 'stamina', stat: 'stamina' },
  { key: 'oxygen', stat: 'oxygen' },
  { key: 'food', stat: 'food' },
  { key: 'weight', stat: 'weight' },
  { key: 'melee', stat: 'meleeDamage' },
  { key: 'movement', stat: 'movementSpeed', unit: '%' },
  { key: 'torpidity', stat: 'torpidity' },
]

const CATEGORY_LABELS: Record<string, string> = {
  dinosaur: 'Dinosaur', fantasy: 'Fantasy', bird: 'Bird', fish: 'Fish',
  invertebrate: 'Invertebrate', mammal: 'Mammal', reptile: 'Reptile', other: 'Other',
}

function Panel({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-card ring-border rounded-xl p-5 ring-1 ${className}`}>
      <h2 className="font-display mb-4 text-xl">{title}</h2>
      {children}
    </section>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  )
}

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 })
// Scraped timers carry milliseconds ("4h 59m 58.561s"); whole seconds are what players read.
const time = (t: string) => t.replace(/(\d+)\.\d+s/g, '$1s')

export default async function CreatureSpeciesPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const creature: CreatureDetail | null = CreatureService.getBySlug(slug)
  if (!creature) notFound()

  const hasSpawnMaps = MapService.forCreature(creature.slug).length > 0
  // Scraped saddle data (with icons) when we have it; the creature's own saddle text otherwise.
  const saddleData = SaddleService.forCreature(creature.slug)
  const saddles = Array.isArray(creature.saddle)
    ? creature.saddle
    : creature.saddle
      ? [creature.saddle]
      : []

  const traits = [
    { on: creature.tameable, label: 'Tameable' },
    { on: creature.rideable, label: 'Rideable' },
    { on: creature.breedable, label: 'Breedable' },
    { on: creature.rider_weaponry, label: 'Rider can use weapons' },
  ].filter((t) => t.on)

  // Scraped incubation text reads "32 - 34 °C / 90 - 93 °F Egg Incubator: 33 °C / 91 °F".
  const [incubationRange, incubatorSetting] = (creature.egg?.incubation?.range ?? '').split(/\s*Egg Incubator:\s*/)

  const growth = creature.egg
    ? [
        creature.egg.incubation
          ? { label: 'Incubation', time: creature.egg.incubation.incubation_time }
          : creature.egg.gestation_time
            ? { label: 'Gestation', time: creature.egg.gestation_time }
            : null,
        { label: 'Baby', time: creature.egg.baby_time },
        { label: 'Juvenile', time: creature.egg.juvenile_time },
        { label: 'Adolescent', time: creature.egg.adolescent_time },
      ].filter((s): s is { label: string; time: string } => !!s && !!s.time)
    : []

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <JsonLd
        data={breadcrumbs([
          { name: 'Creatures', path: '/creatures' },
          { name: creature.name, path: `/creatures/${creature.slug}` },
        ])}
      />
      <Link
        href="/creatures"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" /> All creatures
      </Link>

      {/* Hero: the dossier is the creature's identity in game, so it gets the most room. */}
      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center">
        <div className="bg-plate ring-border relative aspect-[3/2] overflow-hidden rounded-xl ring-1">
          {creature.image ? (
            <Image
              src={creature.image}
              alt={`${creature.name} dossier`}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 720px"
              className="object-cover"
            />
          ) : (
            <PawPrint aria-hidden className="absolute inset-0 m-auto size-16 text-white/15" strokeWidth={1.5} />
          )}
        </div>

        <div>
          <p className="text-muted-foreground text-sm">{CATEGORY_LABELS[creature.category] ?? creature.category}</p>
          <h1 className="font-display mt-1 text-5xl leading-none sm:text-6xl">{creature.name}</h1>
          {creature.dossier?.species && (
            <p className="text-muted-foreground mt-3 text-lg italic">{creature.dossier.species}</p>
          )}
          {creature.alternate_names && creature.alternate_names.length > 0 && (
            <p className="text-muted-foreground mt-2 text-sm">
              Also known as <span className="text-foreground">{creature.alternate_names.join(', ')}</span>
            </p>
          )}

          {traits.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2">
              {traits.map((t) => (
                <li key={t.label} className="bg-secondary inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium">
                  <Check aria-hidden className="text-primary size-4" /> {t.label}
                </li>
              ))}
            </ul>
          )}

          <dl className="divide-border border-border mt-6 divide-y border-y text-[15px]">
            {creature.dossier?.diet && <Fact label="Diet">{creature.dossier.diet}</Fact>}
            {creature.dossier?.temperament && <Fact label="Temperament">{creature.dossier.temperament}</Fact>}
            {creature.dossier?.time && <Fact label="Era">{creature.dossier.time}</Fact>}
            {creature.drag_weight != null && <Fact label="Drag weight">{creature.drag_weight.toLocaleString()}</Fact>}
          </dl>

          {creature.wiki_url && (
            <a
              href={creature.wiki_url}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground mt-4 inline-flex items-center gap-1.5 text-sm transition-colors"
            >
              <ExternalLink aria-hidden className="size-4" /> {creature.name} on the ARK Wiki
            </a>
          )}
        </div>
      </div>

      <div className="mt-10 space-y-6">
        <MySpeciesCreatures slug={slug} />

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
          <div className="space-y-6">
            {hasSpawnMaps && (
              <Panel title="Where it spawns">
                <CreatureSpawnMaps slug={creature.slug} name={creature.name} />
              </Panel>
            )}

            <Panel title="Base stats and growth">
              <div className="-mx-1 overflow-x-auto">
                <table className="w-full min-w-[420px] text-[15px]">
                  <thead>
                    <tr className="text-muted-foreground border-border border-b text-left text-sm">
                      <th scope="col" className="px-1 pb-2 font-medium">Stat</th>
                      <th scope="col" className="px-1 pb-2 text-right font-medium">Base</th>
                      <th scope="col" className="px-1 pb-2 text-right font-medium">Per wild level</th>
                      <th scope="col" className="px-1 pb-2 text-right font-medium">Per tamed level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {STAT_ORDER.map(({ key, stat, unit = '' }) => {
                      const block = creature.base_stats_growth[key]
                      if (!block || block.base === null) return null
                      const wild = block.level_increase?.wild
                      const tamed = block.level_increase?.tamed
                      const cfg = STAT_CONFIG[stat]
                      return (
                        <tr key={key}>
                          <th scope="row" className="px-1 py-2.5 text-left font-medium">
                            <span className="inline-flex items-center gap-2.5">
                              <span aria-hidden className={`size-2.5 rounded-full ${cfg.ringColor.replace('text-', 'bg-')}`} />
                              {cfg.label}
                            </span>
                          </th>
                          <td className="px-1 py-2.5 text-right font-semibold tabular-nums">{fmt(block.base)}{unit}</td>
                          <td className="text-muted-foreground px-1 py-2.5 text-right tabular-nums">
                            {wild != null ? `+${fmt(wild)}` : '—'}
                          </td>
                          <td className="text-muted-foreground px-1 py-2.5 text-right tabular-nums">
                            {tamed != null ? `+${(tamed * 100).toFixed(1)}%` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>

            {creature.dossier && (
              <Panel title="Dossier">
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="text-muted-foreground mb-1.5 text-sm font-medium">In the wild</h3>
                    <p className="max-w-prose leading-relaxed">{creature.dossier.wild}</p>
                  </div>
                  <div>
                    <h3 className="text-muted-foreground mb-1.5 text-sm font-medium">Once tamed</h3>
                    <p className="max-w-prose leading-relaxed">{creature.dossier.domesticated}</p>
                  </div>
                </div>
              </Panel>
            )}

            {creature.breedable && creature.egg && (
              <Panel title="Breeding">
                {growth.length > 0 && (
                  <ol className="grid grid-cols-2 gap-px overflow-hidden rounded-lg sm:grid-cols-4">
                    {growth.map((s, i) => (
                      <li key={s.label} className="bg-secondary p-3">
                        <p className="text-muted-foreground text-xs">
                          <span className="text-primary font-semibold">{i + 1}</span> {s.label}
                        </p>
                        <p className="mt-1 font-semibold tabular-nums">{time(s.time)}</p>
                      </li>
                    ))}
                  </ol>
                )}
                <dl className="divide-border mt-3 divide-y text-[15px]">
                  <Fact label="Fully grown after">{time(creature.egg.total_maturation)}</Fact>
                  <Fact label="Mate again after">{creature.egg.breeding_interval}</Fact>
                  {incubationRange && <Fact label="Incubation temperature">{incubationRange}</Fact>}
                  {incubatorSetting && <Fact label="Egg incubator setting">{incubatorSetting}</Fact>}
                  {creature.egg.name && (
                    <Fact label="Egg">
                      {Array.isArray(creature.egg.name) ? creature.egg.name.join(', ') : creature.egg.name}
                    </Fact>
                  )}
                </dl>
              </Panel>
            )}
          </div>

          <div className="space-y-6">
            {creature.tameable && creature.taming && (
              <Panel title="Taming">
                <dl className="divide-border divide-y text-[15px]">
                  <Fact label="Method">{creature.taming.method ?? '—'}</Fact>
                  {creature.taming.kibble && <Fact label="Preferred kibble">{creature.taming.kibble}</Fact>}
                </dl>
              </Panel>
            )}

            {saddleData.length > 0 ? (
              <Panel title={saddleData.length === 1 ? 'Saddle' : 'Saddles'}>
                <CreatureSaddles saddles={saddleData} />
              </Panel>
            ) : saddles.length > 0 && (
              <Panel title="Saddle">
                <dl className="divide-border divide-y text-[15px]">
                  {saddles.map((s, i) => (
                    <Fact key={i} label={s.name ?? 'Saddle'}>
                      {s.engram_level != null ? `Level ${s.engram_level}` : 'Tekgram'}
                    </Fact>
                  ))}
                </dl>
              </Panel>
            )}

            {!hasSpawnMaps && creature.maps && creature.maps.length > 0 && (
              <Panel title="Spawns on">
                <ul className="flex flex-wrap gap-1.5">
                  {creature.maps.map((m) => (
                    <li key={m}>
                      <Link
                        href={`/maps/${mapSlug(m)}?creature=${creature.slug}`}
                        className="bg-secondary hover:text-primary inline-block rounded-md px-2 py-1 text-sm transition-colors"
                      >
                        {m}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            <Panel title="Technical">
              <dl className="divide-border divide-y text-[15px]">
                {creature.entity_id && (
                  <Fact label="Entity ID">
                    <code className="bg-secondary rounded px-1.5 py-0.5 font-mono text-xs break-all">{creature.entity_id}</code>
                  </Fact>
                )}
                <Fact label="Cloneable">{creature.cloneable ? 'Yes' : 'No'}</Fact>
                <Fact label="API">
                  <Link href={`/api/creatures/${slug}`} target="_blank" className="text-primary font-mono text-sm hover:underline">
                    /api/creatures/{slug}
                  </Link>
                </Fact>
              </dl>
            </Panel>
          </div>
        </div>
      </div>
    </main>
  )
}
