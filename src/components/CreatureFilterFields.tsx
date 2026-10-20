'use client'

/**
 * Gender / sort / mutations (and optionally species) selects for a list of the
 * user's creatures. Controlled: the caller owns the state, whether in the URL
 * (My Creatures) or in component state (species pages).
 */

import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  GENDER_LABELS,
  MUTATION_LABELS,
  SORT_LABELS,
  activeFilterCount,
  type CreatureFilterState,
} from '@/lib/creature-filters'

type FilterPatch = Partial<Omit<CreatureFilterState, 'search'>>

export function CreatureFilterFields({
  state,
  onChange,
  onClear,
  speciesList,
}: {
  state: CreatureFilterState
  onChange: (patch: FilterPatch) => void
  onClear: () => void
  /** Pass to show a species filter; omit on pages that are already one species. */
  speciesList?: string[]
}) {
  return (
    <div>
      <div className={`grid grid-cols-2 gap-3 ${speciesList ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
        {speciesList && (
          <FilterSelect
            label="Species"
            items={{ __all: 'All species', ...Object.fromEntries(speciesList.map((s) => [s, s])) }}
            value={state.species || '__all'}
            onValueChange={(v) => onChange({ species: v === '__all' ? '' : v })}
          />
        )}
        <FilterSelect
          label="Gender"
          items={GENDER_LABELS}
          value={state.gender || '__all'}
          onValueChange={(v) => onChange({ gender: v === '__all' ? '' : v })}
        />
        <FilterSelect
          label="Sort by"
          items={SORT_LABELS}
          value={state.sort}
          onValueChange={(v) => onChange({ sort: v })}
        />
        <FilterSelect
          label="Mutations"
          items={MUTATION_LABELS}
          value={state.mutations || '__all'}
          onValueChange={(v) => onChange({ mutations: v === '__all' ? '' : v })}
        />
      </div>

      {activeFilterCount(state) > 0 && (
        <Button variant="ghost" size="sm" className="mt-3 text-xs" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  )
}

function FilterSelect({
  label,
  items,
  value,
  onValueChange,
}: {
  label: string
  items: Record<string, string>
  value: string
  onValueChange: (value: string) => void
}) {
  return (
    <div className="space-y-1">
      <span className="text-muted-foreground text-sm font-medium">{label}</span>
      <Select items={items} value={value} onValueChange={(v) => onValueChange(String(v))}>
        <SelectTrigger className="h-10 w-full text-sm" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(items).map(([v, text]) => (
            <SelectItem key={v} value={v}>{text}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
