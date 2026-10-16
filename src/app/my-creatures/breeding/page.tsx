'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { parseAsArrayOf, parseAsString, useQueryState } from 'nuqs'
import { ArrowLeft, Check, Crown, Dna, Mars, Venus, X } from 'lucide-react'
import { getAllCreatures, type StoredCreature } from '@/lib/db'
import type { AseStatKey } from '@/lib/ark-stat-solver/ase-data'
import {
  MUTATION_COUNTER_LIMIT,
  P_INHERIT_HIGHER,
  computeBests,
  rankPairs,
  topFlags,
  type CollectionBests,
  type CreatureProfile,
  type OutcomeLevels,
  type RankedPair,
} from '@/lib/breeding'
import { STAT_META, formatPercent } from '@/lib/stat-meta'
import { speciesGroupKey, useCreatureProfiles } from '@/hooks/use-creature-profiles'
import { LevelCell } from '@/components/breeding/LevelCell'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// ─── Small pieces ──────────────────────────────────────────────────────────────

function SexIcon({ female, className = 'size-3.5' }: { female: boolean; className?: string }) {
  return female ? (
    <Venus aria-label="Female" className={`${className} shrink-0 text-pink-500`} />
  ) : (
    <Mars aria-label="Male" className={`${className} shrink-0 text-blue-500`} />
  )
}

function CreatureLink({ p }: { p: CreatureProfile }) {
  return (
    <Link href={`/my-creatures/${p.id}`} className="inline-flex min-w-0 items-center gap-1.5 underline-offset-4 hover:underline">
      <SexIcon female={p.creature.isFemale} />
      <span className="truncate font-medium">{p.creature.name || p.creature.dinoNameTag}</span>
    </Link>
  )
}

function Outcome({ o }: { o: OutcomeLevels }) {
  return <LevelCell levels={{ wild: o.wild, mutated: o.mutated, dom: 0, total: o.total }} />
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-2xl">{title}</h2>
        {description && <p className="text-muted-foreground mt-1 max-w-prose text-[15px]">{description}</p>}
      </div>
      {children}
    </section>
  )
}

// ─── Best stats you own ────────────────────────────────────────────────────────

function BestStats({
  tracked,
  bests,
  byId,
}: {
  tracked: AseStatKey[]
  bests: CollectionBests
  byId: Map<string, CreatureProfile>
}) {
  const holdersList = (ids: string[]) => (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {ids.slice(0, 3).map((id) => byId.get(id) && <CreatureLink key={id} p={byId.get(id)!} />)}
      {ids.length > 3 && <span className="text-muted-foreground">+{ids.length - 3} more</span>}
    </span>
  )
  const sexHas = (ids: string[], female: boolean) => ids.some((id) => byId.get(id)?.creature.isFemale === female)

  return (
    <div className="bg-card ring-border overflow-x-auto rounded-xl p-1 ring-1">
      <table className="w-full min-w-[720px] text-[15px]">
        <thead>
          <tr className="text-muted-foreground border-border border-b text-left text-sm">
            <th scope="col" className="px-4 py-3 font-medium">Stat</th>
            <th scope="col" className="px-3 py-3 text-right font-medium">Best wild</th>
            <th scope="col" className="px-3 py-3 font-medium">Held by</th>
            <th scope="col" className="px-3 py-3 text-right font-medium text-violet-700 dark:text-violet-300">Best mutated</th>
            <th scope="col" className="px-3 py-3 font-medium">Held by</th>
            <th scope="col" className="px-3 py-3 text-center font-medium" title="A female carries the best wild + mutated points">On a female</th>
            <th scope="col" className="px-3 py-3 text-center font-medium" title="A male carries the best wild + mutated points">On a male</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {tracked.map((s) => {
            const b = bests[s]
            if (!b) return null
            return (
              <tr key={s}>
                <th scope="row" className="px-4 py-3 text-left font-medium">
                  <span className="inline-flex items-center gap-2.5">
                    <span aria-hidden className={`size-2.5 rounded-full ${STAT_META[s].dot}`} /> {STAT_META[s].label}
                  </span>
                </th>
                <td className="px-3 py-3 text-right text-lg font-semibold tabular-nums">{b.wild ?? '—'}</td>
                <td className="px-3 py-3 text-sm">{b.wildHolders.length ? holdersList(b.wildHolders) : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-3 text-right text-lg font-semibold tabular-nums text-violet-700 dark:text-violet-300">
                  {b.mutated ? `+${b.mutated}` : '0'}
                </td>
                <td className="px-3 py-3 text-sm">
                  {b.mutated ? holdersList(b.mutatedHolders) : <span className="text-muted-foreground">No mutations yet</span>}
                </td>
                {[true, false].map((female) => (
                  <td key={String(female)} className="px-3 py-3 text-center">
                    {sexHas(b.totalHolders, female) ? (
                      <Check aria-label="Yes" className="text-primary mx-auto size-5" />
                    ) : (
                      <X aria-label="No" className="text-muted-foreground/60 mx-auto size-5" />
                    )}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Suggested pairs ───────────────────────────────────────────────────────────

function PairCard({ pair, rank, trackedCount }: { pair: RankedPair; rank: number; trackedCount: number }) {
  const { mother, father, odds } = pair
  const mutationNote =
    !odds.motherCanMutate && !odds.fatherCanMutate
      ? `Both counters are ${MUTATION_COUNTER_LIMIT}+ — no new mutations`
      : !odds.motherCanMutate || !odds.fatherCanMutate
        ? `${!odds.motherCanMutate ? 'Mother' : 'Father'} is at ${MUTATION_COUNTER_LIMIT}+ — only the other can mutate`
        : null
  return (
    <article className="bg-card ring-border rounded-xl p-5 ring-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-display text-primary text-2xl tabular-nums">{rank}</span>
        <CreatureLink p={mother} />
        <span className="text-muted-foreground">with</span>
        <CreatureLink p={father} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground text-sm">Best stats a baby gets</dt>
          <dd className="text-xl font-semibold tabular-nums">
            {odds.expectedTopStats.toFixed(1)} <span className="text-muted-foreground text-sm font-normal">of {trackedCount} on average</span>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Chance of the best possible baby</dt>
          <dd className="text-xl font-semibold tabular-nums">{formatPercent(odds.pBestOffspring)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Chance of a new mutation</dt>
          <dd className="text-xl font-semibold tabular-nums text-violet-700 dark:text-violet-300">{formatPercent(odds.pMutation, 2)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Baby level</dt>
          <dd className="text-xl font-semibold tabular-nums">
            {odds.levelRange.min === odds.levelRange.max ? odds.levelRange.min : `${odds.levelRange.min}–${odds.levelRange.max}`}
          </dd>
        </div>
      </dl>
      {mutationNote && <p className="text-muted-foreground mt-2 text-sm">{mutationNote}</p>}

      <details className="group mt-4" open={rank === 1}>
        <summary className="text-primary cursor-pointer text-sm font-medium">What each stat can roll</summary>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-left">
              <th scope="col" className="py-1 font-medium">Stat</th>
              <th scope="col" className="py-1 text-right font-medium">Higher roll ({formatPercent(P_INHERIT_HIGHER, 0)})</th>
              <th scope="col" className="py-1 text-right font-medium">Lower roll ({formatPercent(1 - P_INHERIT_HIGHER, 0)})</th>
              <th scope="col" className="py-1 text-right font-medium">Reaches your best</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {odds.stats.map((st) => (
              <tr key={st.stat}>
                <th scope="row" className="py-1.5 text-left font-medium">{STAT_META[st.stat].label}</th>
                <td className="py-1.5 text-right"><Outcome o={st.high} /></td>
                <td className="py-1.5 text-right">{st.differs ? <Outcome o={st.low} /> : <span className="text-muted-foreground">same</span>}</td>
                <td className="py-1.5 text-right tabular-nums">{formatPercent(st.pReachBest, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </article>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

function BreedingPlanner() {
  const [collection, setCollection] = useState<StoredCreature[] | null>(null)
  const [speciesParam, setSpecies] = useQueryState('species', parseAsString.withDefault(''))
  const [trackedParam, setTracked] = useQueryState('stats', parseAsArrayOf(parseAsString))

  useEffect(() => {
    getAllCreatures().then(setCollection).catch(() => setCollection([]))
  }, [])

  const { profiles } = useCreatureProfiles(collection)

  // Species in the collection, most creatures first.
  const speciesOptions = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>()
    for (const c of collection ?? []) {
      const key = speciesGroupKey(c)
      const entry = counts.get(key) ?? { label: c.dinoNameTag.replace(/AA$/, ''), count: 0 }
      entry.count++
      counts.set(key, entry)
    }
    return [...counts.entries()].sort((a, b) => b[1].count - a[1].count)
  }, [collection])

  const species = speciesParam || speciesOptions[0]?.[0] || ''
  const group = useMemo(
    () => (profiles ? [...profiles.values()].filter((p) => speciesGroupKey(p.creature) === species) : []),
    [profiles, species],
  )
  const eligible = useMemo(() => group.find((p) => p.species)?.eligible ?? [], [group])
  const tracked = useMemo(
    () => (trackedParam ?? eligible).filter((s): s is AseStatKey => eligible.includes(s as AseStatKey)),
    [trackedParam, eligible],
  )
  const bests = useMemo(() => computeBests(group, eligible), [group, eligible])
  const byId = useMemo(() => new Map(group.map((p) => [p.id, p])), [group])
  // Babies can't breed until grown, but their points still count toward your bests.
  const pairs = useMemo(
    () => rankPairs(group.filter((p) => p.creature.babyAge >= 1), tracked, bests, 5),
    [group, tracked, bests],
  )
  const rows = useMemo(() => {
    const recordCount = (p: CreatureProfile) => tracked.filter((s) => topFlags(p.levels[s], bests[s]).total).length
    return [...group].sort((a, b) => recordCount(b) - recordCount(a) || b.creature.level - a.creature.level).map((p) => ({ p, records: recordCount(p) }))
  }, [group, tracked, bests])
  const unknownSplit = group.filter((p) => p.mutationSplit === 'unknown').length
  const unsolved = group.filter((p) => !p.solved).length

  const toggleStat = (s: AseStatKey) => {
    const next = tracked.includes(s) ? tracked.filter((t) => t !== s) : eligible.filter((e) => e === s || tracked.includes(e))
    setTracked(next.length === eligible.length ? null : next)
  }

  const speciesItems = Object.fromEntries(speciesOptions.map(([key, v]) => [key, `${v.label} (${v.count})`]))

  return (
    <main className="mx-auto max-w-7xl space-y-10 px-4 py-10">
      <div>
        <Link href="/my-creatures" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors">
          <ArrowLeft aria-hidden className="size-4" /> My Creatures
        </Link>
        <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-4xl leading-none sm:text-5xl">Breeding planner</h1>
            <p className="text-muted-foreground mt-3 max-w-xl text-[15px]">
              Where your best points are, which pairs combine them, and the odds of getting the baby you want.
            </p>
          </div>
          {speciesOptions.length > 0 && (
            <label className="w-full md:w-72">
              <span className="text-muted-foreground mb-1.5 block text-sm font-medium">Species</span>
              <Select items={speciesItems} value={species} onValueChange={(v) => { setSpecies(v as string); setTracked(null) }}>
                <SelectTrigger className="bg-card h-11 w-full text-[15px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {speciesOptions.map(([key, v]) => (
                    <SelectItem key={key} value={key}>{v.label} ({v.count})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          )}
        </div>
      </div>

      {collection === null || (collection.length > 0 && !profiles) ? (
        <div aria-busy className="bg-card ring-border h-64 animate-pulse rounded-xl ring-1" />
      ) : collection.length === 0 ? (
        <div className="border-border flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
          <p className="font-display text-2xl">Nothing to plan yet</p>
          <p className="text-muted-foreground max-w-md">Import creatures on the My Creatures page, then come back to compare them.</p>
          <Link href="/my-creatures" className="text-primary font-medium underline-offset-4 hover:underline">Go to My Creatures</Link>
        </div>
      ) : eligible.length === 0 ? (
        <p className="text-muted-foreground">No stat data for this species, so its points can&apos;t be compared.</p>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-sm font-medium">Stats you&apos;re breeding for</p>
            <div role="group" aria-label="Stats you're breeding for" className="flex flex-wrap gap-2">
              {eligible.map((s) => {
                const on = tracked.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleStat(s)}
                    className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors ${
                      on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span aria-hidden className={`size-2 rounded-full ${STAT_META[s].dot}`} /> {STAT_META[s].label}
                  </button>
                )
              })}
            </div>
            {(unknownSplit > 0 || unsolved > 0) && (
              <p className="text-muted-foreground text-sm">
                {unknownSplit > 0 && `${unknownSplit} ${unknownSplit === 1 ? 'creature has' : 'creatures have'} wild and mutated points combined because their parents aren't imported. `}
                {unsolved > 0 && `${unsolved} couldn't be solved exactly and ${unsolved === 1 ? 'is' : 'are'} left out of the bests and pairs.`}
              </p>
            )}
          </div>

          <Section
            title="Best stats you own"
            description="Wild and mutated points are inherited as a pair: a baby gets the higher wild and the higher mutated points of its parents together, or the lower of both. Keep each best on at least one female and one male."
          >
            <BestStats tracked={tracked} bests={bests} byId={byId} />
          </Section>

          <Section
            title="Pairs to breed next"
            description="Ranked by how many of your best stats a baby gets on average. Each stat independently takes the parents' higher points 55% of the time."
          >
            {pairs.length === 0 ? (
              <p className="text-muted-foreground">You need an adult, non-neutered female and male of this species.</p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {pairs.map((pair, i) => (
                  <PairCard key={`${pair.mother.id}-${pair.father.id}`} pair={pair} rank={i + 1} trackedCount={tracked.length} />
                ))}
              </div>
            )}
          </Section>

          <Section title={`Your ${speciesOptions.find(([k]) => k === species)?.[1].label ?? ''}s`}>
            <div className="bg-card ring-border overflow-x-auto rounded-xl p-1 ring-1">
              <table className="w-full min-w-[640px] text-[15px]">
                <thead>
                  <tr className="text-muted-foreground border-border border-b text-left text-sm">
                    <th scope="col" className="px-4 py-3 font-medium">Creature</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Level</th>
                    {tracked.map((s) => (
                      <th key={s} scope="col" className="px-3 py-3 text-right font-medium">{STAT_META[s].label}</th>
                    ))}
                    <th scope="col" className="px-3 py-3 text-right font-medium" title="Mutation counter, mother's side / father's side">Counter</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {rows.map(({ p, records }) => (
                    <tr key={p.id} className={p.solved ? '' : 'opacity-60'}>
                      <th scope="row" className="max-w-56 px-4 py-2.5 text-left">
                        <span className="flex items-center gap-2">
                          <CreatureLink p={p} />
                          {records > 0 && (
                            <span className="text-primary inline-flex items-center gap-0.5 text-xs font-semibold" title={`Best in ${records} tracked ${records === 1 ? 'stat' : 'stats'}`}>
                              <Crown aria-hidden className="size-3.5" />{records}
                            </span>
                          )}
                          {p.creature.babyAge < 1 && <span className="text-muted-foreground text-xs">baby</span>}
                        </span>
                      </th>
                      <td className="px-3 py-2.5 text-right tabular-nums">{p.creature.level}</td>
                      {tracked.map((s) => (
                        <td key={s} className="px-3 py-2.5 text-right">
                          <LevelCell levels={p.levels[s]} top={topFlags(p.levels[s], bests[s])} />
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        <span className={p.canMutate ? '' : 'text-muted-foreground'} title={p.canMutate ? undefined : `At ${MUTATION_COUNTER_LIMIT}+ — can't roll new mutations`}>
                          {p.counters.maternal} / {p.counters.paternal}
                        </span>
                        {p.newMutations != null && p.newMutations > 0 && (
                          <span className="ml-2 inline-flex items-center gap-0.5 text-xs font-medium text-violet-700 dark:text-violet-300" title="New mutations on this creature">
                            <Dna aria-hidden className="size-3" />+{p.newMutations}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-muted-foreground text-sm">
              <span className="text-primary font-semibold">Amber</span> marks the most wild points you own in a stat,{' '}
              <span className="rounded bg-violet-500/15 px-1 font-semibold text-violet-700 dark:text-violet-300">violet</span> the most
              mutated points. A <span className="font-semibold">?</span> means wild and mutated are combined.
            </p>
          </Section>
        </>
      )}
    </main>
  )
}

export default function BreedingPage() {
  return (
    <Suspense>
      <BreedingPlanner />
    </Suspense>
  )
}
