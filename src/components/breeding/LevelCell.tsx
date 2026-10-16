import type { StatLevels, TopFlags } from '@/lib/breeding'

/**
 * Inheritable points for one stat: wild, plus mutated in violet ("38 +4").
 * When the wild/mutated split is unknown the combined total shows with a "?".
 * Record holders (best in your collection) are highlighted.
 */
export function LevelCell({ levels, top, className = '' }: { levels?: StatLevels; top?: TopFlags; className?: string }) {
  if (!levels) return <span className={`text-muted-foreground ${className}`}>—</span>
  if (levels.mutated === null) {
    return (
      <span
        className={`tabular-nums ${top?.total ? 'text-primary font-semibold' : ''} ${className}`}
        title="Wild and mutated points combined — import this creature's parents to split them"
      >
        {levels.total}
        <span className="text-muted-foreground ml-0.5 text-[0.8em]">?</span>
      </span>
    )
  }
  return (
    <span className={`tabular-nums whitespace-nowrap ${className}`}>
      <span className={top?.wild ? 'text-primary font-semibold' : ''} title={top?.wild ? 'Most wild points you own' : undefined}>
        {levels.wild}
      </span>
      {levels.mutated > 0 && (
        <span
          className={`ml-1 ${top?.mutated ? 'rounded bg-violet-500/15 px-1 font-semibold' : ''} text-violet-700 dark:text-violet-300`}
          title={`${levels.mutated / 2} ${levels.mutated === 2 ? 'mutation' : 'mutations'} (+${levels.mutated} mutated points)${top?.mutated ? ' — most mutated points you own' : ''}`}
        >
          +{levels.mutated}
        </span>
      )}
    </span>
  )
}
