'use client'

import {
  CircularProgress,
  CircularProgressIndicator,
  CircularProgressTrack,
  CircularProgressRange,
  CircularProgressValueText,
} from '@/components/ui/circular-progress'

export type StatDisplayStyle = 'circle' | 'bar' | 'value'

interface StatBarProps {
  label: string
  value: number
  display?: string
  /** Pre-formatted breeding value, shown alongside the observed value when provided. */
  breedingDisplay?: string
  /** Pre-formatted max-potential value (this creature with all 88 dom levels in this stat). */
  maxPotentialDisplay?: string
  max: number
  color?: string
  style?: StatDisplayStyle
  /** Estimated point count (fallback when wild/dom are unavailable). */
  points?: number
  topPercent?: string
  /** Solved wild level count. When provided, replaces the points estimate. */
  wildLevels?: number
  /** Solved domesticated level count. */
  domLevels?: number
  /** Whether the wild/dom solution was exact. */
  solved?: boolean
}

const ringToBg: Record<string, string> = {
  'text-red-500':      'bg-red-500',
  'text-emerald-500':  'bg-emerald-500',
  'text-cyan-400':     'bg-cyan-400',
  'text-orange-500':   'bg-orange-500',
  'text-yellow-500':   'bg-yellow-500',
  'text-rose-500':     'bg-rose-500',
  'text-fuchsia-500':  'bg-fuchsia-500',
  'text-violet-500':   'bg-violet-500',
}

/** Grid template used by the ASE-style table view. Header + rows must share this. */
export const STAT_TABLE_GRID =
  'grid grid-cols-[minmax(0,1fr)_3rem_3rem_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 px-2'

/** Header row for the ASE-style table view. Render once above the StatBar rows. */
export function StatTableHeader() {
  return (
    <div className={`${STAT_TABLE_GRID} text-muted-foreground border-border/60 border-b py-1.5 text-[10px] uppercase tracking-wide`}>
      <span>Stat</span>
      <span className="text-blue-500 dark:text-blue-400 text-right" title="Wild levels">Wild</span>
      <span className="text-violet-500 dark:text-violet-400 text-right" title="Tamed (dom) levels">Tamed</span>
      <span className="text-foreground text-right" title="Current value from the export's Max Character Status Values">Value</span>
      <span className="text-right" title="Breeding value (genetic transfer)">Breeding</span>
      <span className="text-right" title="Max potential at 88 dom levels in this stat">Max</span>
    </div>
  )
}

export function StatBar({
  label, value, display, breedingDisplay, maxPotentialDisplay, max,
  color = 'text-emerald-500', style = 'circle',
  points, topPercent,
  wildLevels, domLevels, solved,
}: StatBarProps) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const displayValue = display ?? (Number.isInteger(value) ? String(value) : value.toFixed(1))
  const barBg = ringToBg[color] ?? 'bg-emerald-500'

  if (style === 'value') {
    // ASE-style table row: matches STAT_TABLE_GRID header above.
    return (
      <div className={`${STAT_TABLE_GRID} border-border/40 border-b py-1.5 text-sm last:border-b-0 hover:bg-muted/30 rounded-sm transition-colors`}>
        <span className={`font-medium ${color}`}>{label}</span>
        <span className={`text-right font-mono tabular-nums ${wildLevels !== undefined ? 'text-blue-500 dark:text-blue-400 font-semibold' : 'text-muted-foreground/40'} ${solved === false ? 'opacity-60' : ''}`}>
          {wildLevels !== undefined ? wildLevels : '—'}
        </span>
        <span className={`text-right font-mono tabular-nums ${domLevels !== undefined ? 'text-violet-500 dark:text-violet-400 font-semibold' : 'text-muted-foreground/40'} ${solved === false ? 'opacity-60' : ''}`}>
          {domLevels !== undefined ? domLevels : '—'}
        </span>
        <span className="text-foreground text-right font-mono tabular-nums font-semibold">{displayValue}</span>
        <span className="text-muted-foreground text-right font-mono text-xs tabular-nums">
          {breedingDisplay ?? '—'}
        </span>
        <span className="text-muted-foreground text-right font-mono text-xs tabular-nums">
          {maxPotentialDisplay ?? '—'}
        </span>
      </div>
    )
  }

  // Compact meta row reused by circle and bar modes.
  const meta = (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
      {wildLevels !== undefined ? (
        <span className={solved ? '' : 'opacity-60'}>
          <span className="text-muted-foreground">Wild </span>
          <span className="text-blue-500 dark:text-blue-400 font-semibold tabular-nums">{wildLevels}</span>
          {domLevels !== undefined && (
            <>
              <span className="text-muted-foreground"> · Tamed </span>
              <span className="text-violet-500 dark:text-violet-400 font-semibold tabular-nums">{domLevels}</span>
            </>
          )}
          {!solved && <span className="ml-1 text-amber-600 dark:text-amber-500" title="Solver could not find an exact integer fit">~</span>}
        </span>
      ) : (
        points !== undefined && <span>~{points} pts</span>
      )}
      {breedingDisplay && (
        <span>
          <span className="text-muted-foreground">Breeding </span>
          <span className="text-foreground font-mono tabular-nums">{breedingDisplay}</span>
        </span>
      )}
      {maxPotentialDisplay && (
        <span title="Max potential — this creature with all 88 dom levels assigned to this stat">
          <span className="text-muted-foreground">Max </span>
          <span className="text-foreground font-mono tabular-nums">{maxPotentialDisplay}</span>
        </span>
      )}
      {topPercent && <span className="text-emerald-600 dark:text-emerald-400">{topPercent}</span>}
    </div>
  )

  if (style === 'bar') {
    return (
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-sm font-medium ${color}`}>{label}</span>
          <span className="text-foreground font-mono text-sm tabular-nums">{displayValue}</span>
        </div>
        <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
          <div className={`${barBg} h-full rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
        {meta}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <CircularProgress value={pct} max={100} size={56} thickness={5}>
        <CircularProgressIndicator>
          <CircularProgressTrack />
          <CircularProgressRange className={color} />
        </CircularProgressIndicator>
        <CircularProgressValueText className="text-[10px]" />
      </CircularProgress>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-sm font-medium ${color}`}>{label}</span>
          <span className="text-foreground font-mono text-sm tabular-nums">{displayValue}</span>
        </div>
        {meta}
      </div>
    </div>
  )
}
