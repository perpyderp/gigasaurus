import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeft, ExternalLink, MapPin, Package, PawPrint, Search, Shield } from 'lucide-react'
import { CreatureService } from '@/services/creature'
import { ResourceService } from '@/services/resource'
import { SaddleService } from '@/services/saddle'
import { CAVE_NODE_COLOR, MapCanvas, NODE_COLOR, RARITY } from '@/components/MapCanvas'
import { regionsForSpawns } from '@/lib/map-geometry'
import { toSlug } from '@/lib/slug'
import type { MapCreatureSpawn, MapDetail } from '@/schemas/map'

type Tab = 'creatures' | 'resources' | 'places'
type Box = [number, number, number, number]

interface CreatureRow {
  id: string
  name: string
  /** Creature page, when the spawn-table name resolves to one. */
  page: string | null
  image: string | null
  tameable: boolean
  spawns: MapCreatureSpawn[]
}

interface PlaceRow {
  id: string
  name: string
  detail?: string
  areas?: Box[]
  pins: { x: number; y: number; label?: string }[]
}

/** Places a player looks for, grouped for the Places tab. Ids are `<kind>-<slug>` for the `place` param. */
function placeGroups(map: MapDetail): { title: string; rows: PlaceRow[] }[] {
  const pin = (p: { name: string; x: number; y: number }) => [{ x: p.x, y: p.y, label: p.name }]
  return [
    {
      title: 'Obelisks and terminals',
      rows: map.landmarks.map((l, i) => ({ id: `landmark-${toSlug(l.name)}-${i}`, name: l.name, pins: pin(l) })),
    },
    {
      title: 'Artifacts',
      rows: map.artifacts.map((a, i) => ({ id: `artifact-${toSlug(a.name)}-${i}`, name: a.name.replace(/^Artifact of the /, ''), pins: pin(a) })),
    },
    {
      title: 'Caves',
      rows: map.caves.map((c, i) => ({
        id: `cave-${toSlug(c.name)}-${i}`,
        name: c.name,
        detail: c.holds.length ? c.holds.join(', ') : undefined,
        pins: pin(c),
      })),
    },
    {
      title: 'Player spawn zones',
      rows: map.player_spawns.map((s) => ({
        id: `spawn-${toSlug(s.name)}`,
        name: s.name,
        detail: `${s.points.length} beds`,
        pins: s.points.map(([x, y], i) => ({ x, y, label: i === 0 ? s.name : undefined })),
      })),
    },
    {
      title: 'Regions',
      rows: map.regions.map((r) => ({ id: `region-${toSlug(r.name)}`, name: r.name, areas: r.areas, pins: [] })),
    },
  ].filter((g) => g.rows.length)
}

function overlapScore(spawn: MapCreatureSpawn, areas: Box[]) {
  let s = 0
  for (const a of areas) {
    for (const r of spawn.regions) {
      const w = Math.min(Math.max(a[0], a[2]), Math.max(r[0], r[2])) - Math.max(Math.min(a[0], a[2]), Math.min(r[0], r[2]))
      const h = Math.min(Math.max(a[1], a[3]), Math.max(r[1], r[3])) - Math.max(Math.min(a[1], a[3]), Math.min(r[1], r[3]))
      if (w > 0 && h > 0) s += w * h * (r[4] + 1)
    }
  }
  return s
}

// ─── Small pieces ──────────────────────────────────────────────────────────────

function PickRow({ href, active, icon, label, meta }: { href: string; active: boolean; icon?: ReactNode; label: string; meta?: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={`flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{label}</span>
      {meta != null && (
        <span className={`shrink-0 text-xs tabular-nums ${active ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{meta}</span>
      )}
    </Link>
  )
}

function Swatch({ color, diamond }: { color: string; diamond?: boolean }) {
  return <span aria-hidden className={`size-2.5 ring-1 ring-black/40 ${diamond ? 'rotate-45' : 'rounded-sm'}`} style={{ backgroundColor: color }} />
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-card ring-border rounded-xl p-5 ring-1">
      <h2 className="font-display mb-4 text-xl">{title}</h2>
      {children}
    </section>
  )
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="max-w-prose list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed marker:text-muted-foreground">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  )
}

const chip = 'bg-secondary inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm'

// ─── Page ──────────────────────────────────────────────────────────────────────

export type MapQuery = { creature?: string; resource?: string; place?: string; tab?: string; q?: string }

/**
 * The interactive map. Rendered statically by /maps/[slug] (nothing picked) and
 * on demand by the explore route that query-string URLs are rewritten to.
 */
export function MapView({ map, query }: { map: MapDetail; query: MapQuery }) {
  const tab: Tab =
    query.tab === 'resources' || query.tab === 'places' || query.tab === 'creatures'
      ? query.tab
      : query.resource ? 'resources' : query.place ? 'places' : 'creatures'
  const search = query.q?.trim().toLowerCase()

  // One row per spawn-table name, so "Aberrant Dodo" and "Dodo" stay distinct where both exist.
  const rows = new Map<string, CreatureRow>()
  for (const c of map.creatures) {
    const id = toSlug(c.name)
    const page = c.creature ? CreatureService.getBySlug(c.creature) : null
    const row = rows.get(id) ?? { id, name: c.name, page: c.creature, image: page?.image ?? null, tameable: false, spawns: [] }
    row.tameable ||= c.tameable
    row.spawns.push(c)
    rows.set(id, row)
  }
  const creatureList = [...rows.values()].sort((a, b) => a.name.localeCompare(b.name))
  const shownCreatures = search ? creatureList.filter((c) => c.name.toLowerCase().includes(search)) : creatureList

  // `creature` is a row id, or a creature slug from a creature page's link (which can cover several rows).
  let selectedCreature: CreatureRow | undefined
  if (query.creature && !query.resource && !query.place) {
    selectedCreature = rows.get(query.creature)
    if (!selectedCreature) {
      const matches = creatureList.filter((c) => c.page === query.creature)
      if (matches.length) {
        const page = CreatureService.getBySlug(query.creature)
        selectedCreature = {
          ...matches[0],
          id: query.creature,
          name: page?.name ?? matches[0].name,
          tameable: matches.some((m) => m.tameable),
          spawns: matches.flatMap((m) => m.spawns),
        }
      }
    }
  }
  const selectedResource = query.resource && !query.place ? map.resources.find((r) => r.key === query.resource) : undefined
  const places = placeGroups(map)
  const selectedPlace = query.place ? places.flatMap((g) => g.rows).find((r) => r.id === query.place) : undefined

  const spawnRegions = selectedCreature?.spawns.flatMap((s) => s.regions) ?? []
  const spawnPoints = selectedCreature?.spawns.flatMap((s) => s.points) ?? []
  const mostlyIn = selectedCreature ? regionsForSpawns(map.regions, spawnRegions, spawnPoints) : []

  // For a selected region: which creatures spawn there, most likely first.
  const creaturesHere = selectedPlace?.areas
    ? creatureList
        .map((c) => ({ c, s: c.spawns.reduce((sum, sp) => sum + overlapScore(sp, selectedPlace.areas!), 0) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 30)
        .map((x) => x.c)
    : []

  const href = (next: { creature?: string; resource?: string; place?: string; tab?: Tab }) => {
    const qs = new URLSearchParams()
    const t = next.tab ?? tab
    if (t !== 'creatures') qs.set('tab', t)
    if (query.q && t === 'creatures') qs.set('q', query.q)
    if (next.creature) qs.set('creature', next.creature)
    if (next.resource) qs.set('resource', next.resource)
    if (next.place) qs.set('place', next.place)
    const s = qs.toString()
    return s ? `/maps/${map.slug}?${s}` : `/maps/${map.slug}`
  }

  const overlayLabel = selectedCreature
    ? `Spawn areas for ${selectedCreature.name} on ${map.name}`
    : selectedResource
      ? `${selectedResource.name} nodes on ${map.name}`
      : selectedPlace
        ? `${selectedPlace.name} on ${map.name}`
        : `${map.name} map`

  const facts = [
    map.content_type && { label: 'Type', value: map.content_type },
    map.release.ase && { label: 'Released in Evolved', value: map.release.ase },
    map.release.asa && { label: 'Released in Ascended', value: map.release.asa },
    map.level_name && { label: 'Level name', value: <code className="bg-secondary rounded px-1.5 py-0.5 font-mono text-xs">{map.level_name}</code> },
    map.explorer_notes > 0 && { label: 'Explorer notes', value: map.explorer_notes },
    map.dossiers > 0 && { label: 'Dossiers', value: map.dossiers },
    map.caves.length > 0 && { label: 'Caves', value: map.caves.length },
  ].filter(Boolean) as { label: string; value: ReactNode }[]

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <Link href="/maps" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors">
        <ArrowLeft aria-hidden className="size-4" /> All maps
      </Link>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-5xl leading-none text-balance sm:text-6xl">{map.name}</h1>
          {map.summary && <p className="text-muted-foreground mt-3 max-w-2xl text-[15px]">{map.summary}</p>}
        </div>
        <a
          href={map.wiki_url}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1.5 text-sm transition-colors"
        >
          <ExternalLink aria-hidden className="size-4" /> {map.name} on the ARK Wiki
        </a>
      </div>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <MapCanvas
            image={map.image!}
            label={overlayLabel}
            priority
            regions={spawnRegions}
            points={spawnPoints}
            nodes={selectedResource?.nodes}
            caveNodes={selectedResource?.cave_nodes}
            areas={selectedPlace?.areas}
            pins={selectedPlace?.pins}
          >
            {!selectedCreature && !selectedResource && !selectedPlace && (
              <p className="bg-background/85 text-foreground absolute inset-x-4 bottom-4 rounded-lg px-4 py-3 text-center text-sm backdrop-blur-sm sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2">
                Pick a creature, resource or place to see where it is.
              </p>
            )}
          </MapCanvas>

          {selectedCreature && (
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-display text-2xl leading-tight">{selectedCreature.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {spawnRegions.length + spawnPoints.length} spawn {spawnRegions.length + spawnPoints.length === 1 ? 'area' : 'areas'}
                    {!selectedCreature.tameable && ', untameable here'}
                    {selectedCreature.page && (
                      <>
                        {' '}
                        <Link href={`/creatures/${selectedCreature.page}`} className="text-primary font-medium underline-offset-4 hover:underline">
                          View creature
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <ul aria-label="Rarity" className="flex flex-wrap gap-x-3 gap-y-1 text-xs sm:max-w-xs sm:justify-end">
                  {RARITY.toReversed().map((r) => (
                    <li key={r.label} className="inline-flex items-center gap-1.5">
                      <Swatch color={r.color} /> {r.label}
                    </li>
                  ))}
                </ul>
              </div>
              {mostlyIn.length > 0 && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Mostly in </span>
                  {mostlyIn.map((name, i) => (
                    <span key={name}>
                      {i > 0 && ', '}
                      <Link href={href({ tab: 'places', place: `region-${toSlug(name)}` })} className="font-medium underline-offset-4 hover:underline">
                        {name}
                      </Link>
                    </span>
                  ))}
                </p>
              )}
            </div>
          )}

          {selectedResource && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-display text-2xl leading-tight">{selectedResource.name}</p>
                <p className="text-muted-foreground text-sm">
                  {(selectedResource.nodes.length + selectedResource.cave_nodes.length).toLocaleString()} marked locations
                </p>
              </div>
              <ul aria-label="Legend" className="flex gap-3 text-xs">
                <li className="inline-flex items-center gap-1.5">
                  <Swatch color={NODE_COLOR} diamond /> Surface
                </li>
                {selectedResource.cave_nodes.length > 0 && (
                  <li className="inline-flex items-center gap-1.5">
                    <Swatch color={CAVE_NODE_COLOR} diamond /> Cave
                  </li>
                )}
              </ul>
            </div>
          )}

          {selectedPlace && (
            <div className="space-y-2">
              <p className="font-display text-2xl leading-tight">{selectedPlace.name}</p>
              {selectedPlace.detail && <p className="text-muted-foreground text-sm">{selectedPlace.detail}</p>}
              {selectedPlace.areas && (
                creaturesHere.length > 0 ? (
                  <div>
                    <p className="text-muted-foreground mb-2 text-sm">Creatures that spawn here, most likely first</p>
                    <ul className="flex flex-wrap gap-1.5">
                      {creaturesHere.map((c) => (
                        <li key={c.id}>
                          <Link href={href({ tab: 'creatures', creature: c.id })} className={`${chip} hover:text-primary transition-colors`}>
                            {c.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No creature spawn areas overlap this region.</p>
                )
              )}
            </div>
          )}

          <p className="text-muted-foreground text-xs">
            Spawn data from {map.spawn_data === 'ASA' ? 'ARK: Survival Ascended' : 'ARK: Survival Evolved'}
            {map.resource_data && map.resource_data !== map.spawn_data
              ? `, resource data from ${map.resource_data === 'ASA' ? 'Ascended' : 'Evolved'}`
              : ''}
            , mined from the game files by the ARK Wiki. Creatures roam a little outside their areas.
          </p>
        </div>

        <section aria-label="Pick what to show" className="bg-card ring-border rounded-xl ring-1">
          <nav aria-label="Show" className="border-border grid grid-cols-3 gap-1 border-b p-1.5">
            {(['creatures', 'resources', 'places'] as const).map((t) => (
              <Link
                key={t}
                href={href({ tab: t })}
                aria-current={tab === t ? 'page' : undefined}
                className={`flex h-10 items-center justify-center gap-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                  tab === t ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}
                <span className="text-muted-foreground hidden tabular-nums sm:inline">
                  {t === 'creatures' ? creatureList.length : t === 'resources' ? map.resources.length : places.reduce((n, g) => n + g.rows.length, 0)}
                </span>
              </Link>
            ))}
          </nav>

          {tab === 'creatures' && (
            <div>
              <form method="GET" action={`/maps/${map.slug}`} role="search" className="p-3">
                {selectedCreature && <input type="hidden" name="creature" value={selectedCreature.id} />}
                <label className="relative block">
                  <span className="sr-only">Search creatures on {map.name}</span>
                  <Search aria-hidden className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <input
                    type="search"
                    name="q"
                    autoComplete="off"
                    defaultValue={query.q}
                    placeholder="Search creatures"
                    className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring h-10 w-full rounded-lg border pr-3 pl-9 text-[15px] outline-none"
                  />
                </label>
              </form>
              {shownCreatures.length === 0 ? (
                <p className="text-muted-foreground px-4 pb-6 text-sm">No creature on {map.name} matches that search.</p>
              ) : (
                <ul className="max-h-[70vh] overflow-y-auto overscroll-contain px-1.5 pb-1.5 lg:max-h-[calc(100vh-15rem)]">
                  {shownCreatures.map((c) => (
                    // Astraeos lists 200+ creatures; skip rendering rows scrolled out of view.
                    <li key={c.id} className="[contain-intrinsic-size:auto_44px] [content-visibility:auto]">
                      <PickRow
                        href={href({ creature: c.id })}
                        active={selectedCreature?.id === c.id}
                        label={c.name}
                        meta={c.tameable ? undefined : 'Untameable'}
                        icon={
                          <span className="bg-plate relative aspect-[3/2] w-12 shrink-0 overflow-hidden rounded">
                            {c.image ? (
                              <Image src={c.image} alt="" fill sizes="48px" className="object-cover" />
                            ) : (
                              <PawPrint aria-hidden className="absolute inset-0 m-auto size-4 text-white/25" />
                            )}
                          </span>
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'resources' &&
            (map.resources.length === 0 ? (
              <p className="text-muted-foreground p-4 text-sm">The ARK Wiki has no resource map for {map.name} yet.</p>
            ) : (
              <ul className="max-h-[70vh] overflow-y-auto overscroll-contain p-1.5 lg:max-h-[calc(100vh-12rem)]">
                {map.resources.map((r) => {
                  const image = r.resource ? ResourceService.getBySlug(r.resource)?.image : null
                  return (
                    <li key={r.key}>
                      <PickRow
                        href={href({ tab: 'resources', resource: r.key })}
                        active={selectedResource?.key === r.key}
                        label={r.name}
                        meta={(r.nodes.length + r.cave_nodes.length).toLocaleString()}
                        icon={
                          <span className="slot relative size-9 shrink-0 rounded">
                            {image ? (
                              <Image src={image} alt="" fill sizes="36px" className="object-contain p-1" />
                            ) : (
                              <Package aria-hidden className="text-muted-foreground/50 absolute inset-0 m-auto size-4" />
                            )}
                          </span>
                        }
                      />
                    </li>
                  )
                })}
              </ul>
            ))}

          {tab === 'places' &&
            (places.length === 0 ? (
              <p className="text-muted-foreground p-4 text-sm">The ARK Wiki has no places marked for {map.name} yet.</p>
            ) : (
              <div className="max-h-[70vh] overflow-y-auto overscroll-contain p-1.5 lg:max-h-[calc(100vh-12rem)]">
                {places.map((g) => (
                  <div key={g.title} className="mb-2">
                    <h3 className="text-muted-foreground px-2 pt-2 pb-1 text-xs font-medium">{g.title}</h3>
                    <ul>
                      {g.rows.map((r) => (
                        <li key={r.id} className="[contain-intrinsic-size:auto_40px] [content-visibility:auto]">
                          <PickRow
                            href={href({ tab: 'places', place: r.id })}
                            active={selectedPlace?.id === r.id}
                            label={r.name}
                            meta={r.detail}
                            icon={<MapPin aria-hidden className="size-4 shrink-0 opacity-60" />}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
        </section>
      </div>

      <MapAbout map={map} facts={facts} />
    </main>
  )
}

/** Everything else the wiki says about the map, below the interactive part. */
function MapAbout({ map, facts }: { map: MapDetail; facts: { label: string; value: ReactNode }[] }) {
  return (
    <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
      <div className="space-y-6">
        {map.features.length > 0 && (
          <Section title="What makes it different">
            <Bullets items={map.features} />
          </Section>
        )}

        {map.asa_changes.length > 0 && (
          <Section title="Changes in Ascended">
            <Bullets items={map.asa_changes} />
          </Section>
        )}

        {map.roster.length > 0 && (
          <Section title="Creatures">
            <div className="space-y-5">
              {map.roster.map((g) => (
                <div key={g.group}>
                  <h3 className="text-muted-foreground mb-2 text-sm font-medium">
                    {g.group} <span className="tabular-nums">{g.names.length}</span>
                  </h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {g.names.map((name) => {
                      const page = CreatureService.getBySlug(name)
                      return (
                        <li key={name}>
                          {page ? (
                            <Link href={`/creatures/${page.slug}`} className={`${chip} hover:text-primary transition-colors`}>
                              {name}
                            </Link>
                          ) : (
                            <span className={`${chip} text-muted-foreground`}>{name}</span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </Section>
        )}

        {map.items.length > 0 && (
          <Section title={`Found only on ${map.name}`}>
            <div className="space-y-5">
              {map.items.map((g) => (
                <div key={g.group}>
                  <h3 className="text-muted-foreground mb-2 text-sm font-medium">{g.group}</h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {g.names.map((name) => {
                      const saddle = SaddleService.getBySlug(name)
                      const resource = saddle ? null : ResourceService.getBySlug(name)
                      const image = saddle?.image ?? resource?.image ?? null
                      const content = (
                        <>
                          {image ? (
                            <Image src={image} alt="" width={20} height={20} className="size-5 object-contain" />
                          ) : saddle ? (
                            <Shield aria-hidden className="size-4 opacity-50" />
                          ) : null}
                          {name}
                        </>
                      )
                      return (
                        <li key={name}>
                          {saddle && saddle.creatures[0] ? (
                            <Link href={`/creatures/${saddle.creatures[0]}`} className={`${chip} hover:text-primary transition-colors`}>
                              {content}
                            </Link>
                          ) : resource ? (
                            <Link href={`/resources?q=${encodeURIComponent(resource.name)}`} className={`${chip} hover:text-primary transition-colors`}>
                              {content}
                            </Link>
                          ) : (
                            <span className={chip}>{content}</span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>

      <div className="space-y-6">
        {facts.length > 0 && (
          <Section title="Overview">
            <dl className="divide-border divide-y text-[15px]">
              {facts.map((f) => (
                <div key={f.label} className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="text-muted-foreground shrink-0">{f.label}</dt>
                  <dd className="text-right font-medium tabular-nums">{f.value}</dd>
                </div>
              ))}
            </dl>
          </Section>
        )}
        {map.caves.some((c) => c.holds.length) && (
          <Section title="Artifact caves">
            <dl className="divide-border divide-y text-[15px]">
              {map.caves
                .filter((c) => c.holds.length)
                .map((c) => (
                  <div key={c.name} className="py-2">
                    <dt className="font-medium">{c.name}</dt>
                    <dd className="text-muted-foreground text-sm">{c.holds.join(', ')}</dd>
                  </div>
                ))}
            </dl>
          </Section>
        )}
      </div>
    </div>
  )
}
