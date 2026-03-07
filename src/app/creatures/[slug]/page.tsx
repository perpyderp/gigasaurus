import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { CreatureService } from '@/services/creature'
import type { CreatureDetail } from '@/schemas/creature'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  IconArrowLeft,
  IconSword,
  IconEgg,
  IconMeat,
  IconWalk,
  IconDna,
  IconAlertTriangle,
} from '@tabler/icons-react'

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
  return {
    title: `${creature.name} — Gigasaurus`,
    description: creature.dossier?.wild ?? undefined,
  }
}

// ─── Stat display helpers ─────────────────────────────────────────────────────

function StatRow({ label, base, wildInc, tamedInc }: {
  label: string
  base: number | null
  wildInc?: number | null
  tamedInc?: number | null
}) {
  if (base === null) return null
  return (
    <tr className="border-border border-b last:border-0">
      <td className="py-1.5 pr-4 text-xs font-medium">{label}</td>
      <td className="py-1.5 pr-4 text-xs tabular-nums">{base.toLocaleString()}</td>
      <td className="py-1.5 pr-4 text-xs tabular-nums text-emerald-600 dark:text-emerald-400">
        {wildInc != null ? `+${wildInc}` : '—'}
      </td>
      <td className="py-1.5 text-xs tabular-nums text-sky-600 dark:text-sky-400">
        {tamedInc != null ? `+${(tamedInc * 100).toFixed(1)}%` : '—'}
      </td>
    </tr>
  )
}

const STAT_ORDER = [
  { key: 'health',    label: 'Health' },
  { key: 'stamina',   label: 'Stamina' },
  { key: 'oxygen',    label: 'Oxygen' },
  { key: 'food',      label: 'Food' },
  { key: 'weight',    label: 'Weight' },
  { key: 'melee',     label: 'Melee Damage' },
  { key: 'movement',  label: 'Movement Speed' },
  { key: 'torpidity', label: 'Torpidity' },
] as const

const CATEGORY_LABELS: Record<string, string> = {
  dinosaur: 'Dinosaur', fantasy: 'Fantasy', bird: 'Bird', fish: 'Fish',
  invertebrate: 'Invertebrate', mammal: 'Mammal', reptile: 'Reptile', other: 'Other',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CreatureSpeciesPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const creature: CreatureDetail | null = CreatureService.getBySlug(slug)
  if (!creature) notFound()

  const saddles = Array.isArray(creature.saddle)
    ? creature.saddle
    : creature.saddle
    ? [creature.saddle]
    : []

  return (
    <main className="bg-background min-h-screen">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">

        <Link
          href="/creatures"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <IconArrowLeft size={14} /> Creatures
        </Link>

        {/* ── Hero ── */}
        <Card>
          <CardContent className="flex gap-4 p-5">
            <div className="bg-muted relative h-36 w-36 shrink-0 overflow-hidden rounded-lg">
              {creature.image ? (
                <Image
                  src={creature.image}
                  alt={creature.name}
                  fill
                  className="object-contain p-2"
                  sizes="144px"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-5xl opacity-20">🦕</div>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <h1 className="text-2xl font-bold">{creature.name}</h1>
                {creature.dossier && (
                  <p className="text-muted-foreground text-sm italic">{creature.dossier.species}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{CATEGORY_LABELS[creature.category] ?? creature.category}</Badge>
                {creature.dossier && (
                  <>
                    <Badge variant="outline">{creature.dossier.diet}</Badge>
                    <Badge variant="outline">{creature.dossier.temperament}</Badge>
                  </>
                )}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {creature.tameable && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ Tameable</span>
                )}
                {creature.rideable && (
                  <span className="text-sky-600 dark:text-sky-400 font-medium">✓ Rideable</span>
                )}
                {creature.breedable && (
                  <span className="text-violet-600 dark:text-violet-400 font-medium">✓ Breedable</span>
                )}
                {creature.rider_weaponry && (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">✓ Rider Weaponry</span>
                )}
              </div>

              {creature.dossier && (
                <p className="text-muted-foreground text-xs">
                  {creature.dossier.time}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Dossier ── */}
        {creature.dossier && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Dossier</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">Wild</p>
                <p className="leading-relaxed">{creature.dossier.wild}</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">Domesticated</p>
                <p className="leading-relaxed">{creature.dossier.domesticated}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Base Stats ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Base Stats &amp; Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full">
              <thead>
                <tr className="border-border border-b">
                  <th className="py-1.5 pr-4 text-left text-xs font-medium">Stat</th>
                  <th className="py-1.5 pr-4 text-left text-xs font-medium">Base</th>
                  <th className="py-1.5 pr-4 text-left text-xs font-medium text-emerald-600 dark:text-emerald-400">Wild +</th>
                  <th className="py-1.5 text-left text-xs font-medium text-sky-600 dark:text-sky-400">Tamed %</th>
                </tr>
              </thead>
              <tbody>
                {STAT_ORDER.map(({ key, label }) => {
                  const block = creature.base_stats_growth[key]
                  return (
                    <StatRow
                      key={key}
                      label={label}
                      base={block.base}
                      wildInc={block.level_increase?.wild}
                      tamedInc={block.level_increase?.tamed}
                    />
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* ── Taming ── */}
        {creature.tameable && creature.taming && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <IconMeat size={14} /> Taming
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method</span>
                <span className="font-medium">{creature.taming.method ?? '—'}</span>
              </div>
              {creature.taming.kibble && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Preferred Kibble</span>
                  <span className="font-medium">{creature.taming.kibble} Kibble</span>
                </div>
              )}
              {creature.drag_weight != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Drag Weight</span>
                  <span className="font-medium">{creature.drag_weight.toLocaleString()}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Saddle ── */}
        {saddles.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <IconWalk size={14} /> Saddle
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {saddles.map((s, i) => (
                <div key={i} className="flex justify-between">
                  <span>{s.name ?? 'Unknown Saddle'}</span>
                  <span className="text-muted-foreground">
                    {s.engram_level != null ? `Engram Lv ${s.engram_level}` : 'Tekgram'}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* ── Breeding ── */}
        {creature.breedable && creature.egg && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <IconEgg size={14} /> Breeding
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {creature.egg.name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Egg</span>
                  <span className="font-medium">
                    {Array.isArray(creature.egg.name) ? creature.egg.name.join(' / ') : creature.egg.name}
                  </span>
                </div>
              )}
              {creature.egg.incubation && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Incubation Temp</span>
                    <span className="font-medium">{creature.egg.incubation.range}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Incubation Time</span>
                    <span className="font-medium">{creature.egg.incubation.incubation_time}</span>
                  </div>
                </>
              )}
              {creature.egg.gestation_time && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gestation Time</span>
                  <span className="font-medium">{creature.egg.gestation_time}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Baby → Juvenile</span>
                <span className="font-medium">{creature.egg.baby_time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Maturation</span>
                <span className="font-medium">{creature.egg.total_maturation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Breeding Interval</span>
                <span className="font-medium">{creature.egg.breeding_interval}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Tech info ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <IconDna size={14} /> Technical Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {creature.entity_id && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entity ID</span>
                <code className="bg-muted rounded px-1.5 py-0.5 text-xs">{creature.entity_id}</code>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cloneable</span>
              <span>{creature.cloneable ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">API Slug</span>
              <code className="bg-muted rounded px-1.5 py-0.5 text-xs">{slug}</code>
            </div>
          </CardContent>
        </Card>

        {/* ── API link ── */}
        <div className="flex items-center gap-2 text-xs">
          <IconSword size={12} className="text-muted-foreground" />
          <span className="text-muted-foreground">Raw API:</span>
          <Link
            href={`/api/creatures/${slug}`}
            target="_blank"
            className="text-primary font-mono hover:underline"
          >
            /api/creatures/{slug}
          </Link>
        </div>
      </div>
    </main>
  )
}
