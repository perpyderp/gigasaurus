import type { ReactNode } from 'react'
import { TriangleAlert, Info } from 'lucide-react'
import { MUTATION_COUNTER_LIMIT, type CreatureProfile } from '@/lib/breeding'
import { formatPercent } from '@/lib/stat-meta'

function Fact({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div title={hint}>
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

function Notice({ tone, children }: { tone: 'info' | 'warn'; children: ReactNode }) {
  const Icon = tone === 'warn' ? TriangleAlert : Info
  return (
    <p
      className={`flex gap-2 rounded-lg border px-3 py-2.5 text-sm ${
        tone === 'warn'
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200'
          : 'border-border bg-muted/50 text-muted-foreground'
      }`}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

/** Where a creature's levels come from, its taming or breeding background, and mutation headroom. */
export function LevelSummary({ profile }: { profile: CreatureProfile }) {
  const { totals, creature } = profile
  // Inheritable points = wild + mutated, always known per stat; the split may not be.
  const inheritable = Object.values(profile.levels).reduce((n, lv) => n + lv!.total, 0)
  const mutated = totals.mutated
  const computed = 1 + inheritable + totals.dom
  const segments = [
    mutated === null
      ? { label: 'Wild + mutated', value: inheritable, cls: 'bg-foreground/70' }
      : { label: 'Wild', value: inheritable - mutated, cls: 'bg-foreground/70' },
    { label: 'Mutated', value: mutated ?? 0, cls: 'bg-violet-500' },
    { label: 'Tamed', value: totals.dom, cls: 'bg-primary' },
  ].filter((s) => s.value > 0)
  const segTotal = Math.max(1, segments.reduce((n, s) => n + s.value, 0))

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm">
          <span className="font-semibold">Level {creature.level}</span>
          <span className="text-muted-foreground">
            {' '}= 1 base
            {segments.map((s) => ` + ${s.value} ${s.label.toLowerCase()}`).join('')}
          </span>
        </p>
        <div className="bg-muted mt-2 flex h-2.5 overflow-hidden rounded-full" aria-hidden>
          {segments.map((s) => (
            <div key={s.label} className={s.cls} style={{ width: `${(s.value / segTotal) * 100}%` }} />
          ))}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {profile.taming && profile.te != null && (
          <>
            <Fact label="Taming effectiveness" value={formatPercent(profile.te)} />
            <Fact
              label="Tamed at level"
              value={profile.taming.exact ? profile.taming.preTameLevel : `~${profile.taming.preTameLevel}`}
            />
            <Fact
              label="Bonus levels from taming"
              value={`+${profile.taming.bonusLevels}`}
              hint="floor(level × TE ÷ 2) — these count as wild points and are inherited"
            />
          </>
        )}
        {profile.isBred && (
          <>
            <Fact label="Imprint" value={formatPercent(creature.imprintQuality, 0)} />
            <Fact
              label="Mutation counter"
              value={
                <span>
                  {profile.counters.maternal}
                  <span className="text-muted-foreground text-sm font-normal"> mother&apos;s side</span>
                  {' / '}
                  {profile.counters.paternal}
                  <span className="text-muted-foreground text-sm font-normal"> father&apos;s</span>
                </span>
              }
              hint="Counts every mutation in the ancestry, not this creature's own mutated points"
            />
            <Fact
              label="New mutations"
              value={profile.newMutations ?? '?'}
              hint={profile.newMutations === null ? 'Import both parents to see whether this creature mutated' : 'Mutations that happened when this creature was bred'}
            />
          </>
        )}
        <Fact
          label="Can make new mutations"
          value={profile.canMutate ? 'Yes' : 'No'}
          hint={`Only creatures with a total counter under ${MUTATION_COUNTER_LIMIT} can be the source of a new mutation. Mutated points are still passed on either way.`}
        />
      </dl>

      {!profile.solved && (
        <Notice tone="warn">
          These stats don&apos;t match any exact set of points, so the numbers below are a best guess. This usually means the
          server uses custom stat multipliers or the creature is modded.
        </Notice>
      )}
      {profile.solved && computed !== creature.level && (
        <Notice tone="warn">Points add up to level {computed}, but the export says {creature.level}.</Notice>
      )}
      {profile.mutationSplit === 'unknown' && (
        <Notice tone="info">
          This creature has mutations in its ancestry, but its parents aren&apos;t imported, so wild and mutated points are shown
          together (marked <span className="font-semibold">*</span> and <span className="font-semibold">?</span>). Import both
          parents to split them.
        </Notice>
      )}
      {!profile.canMutate && (
        <Notice tone="info">
          Counter at {profile.counters.total}: this creature can no longer roll new mutations, but it still passes its
          mutated points to babies. Pair it with partners under {MUTATION_COUNTER_LIMIT} to keep mutating.
        </Notice>
      )}
    </div>
  )
}
