'use client'

/**
 * On a species page (/creatures/[slug]), lists the user's own imported creatures
 * of that species (read from IndexedDB) with links to each creature's page.
 * Searchable, filterable and paginated. Renders nothing until loaded, or if the
 * user owns none.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { IconMars, IconVenus, IconDna, IconStar, IconSearch, IconFilter } from '@tabler/icons-react'
import { getCreaturesBySlug } from '@/lib/db'
import type { StoredCreature } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CreatureFilterFields } from '@/components/CreatureFilterFields'
import { CreaturePagination } from '@/components/CreaturePagination'
import {
  EMPTY_FILTERS,
  activeFilterCount,
  filterAndSortCreatures,
  inGameName,
  paginate,
  totalMutations,
  type CreatureFilterState,
} from '@/lib/creature-filters'

const PAGE_SIZE_OPTIONS = [9, 18, 36]

export function MySpeciesCreatures({ slug }: { slug: string }) {
  const [creatures, setCreatures] = useState<StoredCreature[] | null>(null)
  const [filters, setFilters] = useState<CreatureFilterState>({ ...EMPTY_FILTERS, sort: 'level' })
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0])

  useEffect(() => {
    let cancelled = false
    getCreaturesBySlug(slug)
      .then((list) => { if (!cancelled) setCreatures(list) })
      .catch(() => { if (!cancelled) setCreatures([]) })
    return () => { cancelled = true }
  }, [slug])

  const filtered = useMemo(() => filterAndSortCreatures(creatures ?? [], filters), [creatures, filters])
  const { totalPages, page: safePage, items } = paginate(filtered, page, pageSize)

  // Still loading, or the user has no creatures of this species — render nothing.
  if (!creatures || creatures.length === 0) return null

  const updateFilters = (patch: Partial<CreatureFilterState>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setPage(1)
  }
  const clearFilters = () => updateFilters({ ...EMPTY_FILTERS, sort: 'level', search: filters.search })
  // 'level' is this list's default order, so it doesn't count as an active filter.
  const filterCount = activeFilterCount({ ...filters, sort: filters.sort === 'level' ? EMPTY_FILTERS.sort : filters.sort })

  return (
    <Card>
      <CardHeader className="gap-3 pb-3">
        <CardTitle className="font-display text-xl">
          Your {creatures.length === 1 ? 'tame' : `${creatures.length} tames`}
        </CardTitle>
        {creatures.length > 1 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <IconSearch size={14} aria-hidden className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" />
              <Input
                type="search"
                aria-label="Search your tames"
                placeholder="Search by name, in-game name or tribe"
                value={filters.search}
                onChange={(e) => updateFilters({ search: e.target.value })}
                className="h-10 pl-9 text-[15px]"
              />
            </div>
            <Button
              variant={filterCount > 0 ? 'default' : 'outline'}
              className="h-10 shrink-0 gap-2 px-4"
              aria-expanded={showFilters}
              onClick={() => setShowFilters((v) => !v)}
            >
              <IconFilter size={14} aria-hidden />
              Filters
              {filterCount > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">{filterCount}</Badge>}
            </Button>
          </div>
        )}
        {showFilters && (
          <CreatureFilterFields
            state={filters}
            onChange={updateFilters}
            onClear={clearFilters}
          />
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {filtered.length === 0 ? (
          <div className="border-border flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center">
            <p className="text-muted-foreground text-sm">None of your tames match your search and filters.</p>
            <Button variant="link" size="sm" onClick={() => updateFilters({ ...EMPTY_FILTERS, sort: filters.sort })}>
              Clear search and filters
            </Button>
          </div>
        ) : (
          <>
            {filtered.length !== creatures.length && (
              <p className="text-muted-foreground text-sm" aria-live="polite">
                {filtered.length} of {creatures.length} tames
              </p>
            )}
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((c) => <TameRow key={c.id} creature={c} />)}
            </ul>
          </>
        )}

        {filtered.length > PAGE_SIZE_OPTIONS[0] && (
          <CreaturePagination
            page={safePage}
            totalPages={totalPages}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1) }}
          />
        )}
      </CardContent>
    </Card>
  )
}

function TameRow({ creature: c }: { creature: StoredCreature }) {
  const mutations = totalMutations(c)
  const imprintPct = Math.round(c.imprintQuality * 100)
  const gameName = inGameName(c)

  return (
    <li>
      <Link
        href={`/my-creatures/${c.id}`}
        className="hover:border-primary/60 hover:bg-accent/40 flex h-full items-center gap-3 rounded-lg border p-3 transition-colors"
      >
        <div className={`rounded-full p-1 ${c.isFemale ? 'bg-pink-500/15 text-pink-500' : 'bg-blue-500/15 text-blue-500'}`}>
          {c.isFemale ? <IconVenus size={13} aria-label="Female" /> : <IconMars size={13} aria-label="Male" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-medium" title="Label in Gigasaurus">{c.name || c.dinoNameTag}</p>
          <p className="text-muted-foreground truncate text-xs" title="Name in game">
            {gameName ? <>In game: <span className="text-foreground/80">{gameName}</span></> : 'Unnamed in game'}
          </p>
          <p className="text-muted-foreground flex gap-3 text-sm">
            <span className="text-foreground font-semibold tabular-nums">Lv {c.level}</span>
            {c.tribe && <span className="truncate">{c.tribe}</span>}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          {mutations > 0 && (
            <Badge variant="outline" className="gap-1 border-violet-400/50 text-violet-700 dark:text-violet-300" title={`${mutations} mutations`}>
              <IconDna size={9} aria-hidden />{mutations}
            </Badge>
          )}
          {imprintPct > 0 && (
            <Badge variant="outline" className="gap-1 border-sky-400/50 text-sky-700 dark:text-sky-300" title={`${imprintPct}% imprinted`}>
              <IconStar size={9} aria-hidden />{imprintPct}%
            </Badge>
          )}
        </div>
      </Link>
    </li>
  )
}
