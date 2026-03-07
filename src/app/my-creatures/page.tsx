'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import { useQueryState, useQueryStates, parseAsInteger, parseAsString } from 'nuqs'
import { IconSearch, IconFilter, IconUpload, IconCloudUpload, IconCloudDown } from '@tabler/icons-react'
import { getAllCreatures } from '@/lib/db'
import type { StoredCreature } from '@/lib/db'
import { CreatureCard } from '@/components/CreatureCard'
import { ImportDropzone } from '@/components/ImportDropzone'
import { DriveSync } from '@/components/DriveSync'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'

const PAGE_SIZE_OPTIONS = [12, 24, 48]

function MyCreaturesContent() {
  const [creatures, setCreatures] = useState<StoredCreature[]>([])
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // nuqs-synced state
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''))
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1))
  const [pageSize, setPageSize] = useQueryState('size', parseAsInteger.withDefault(24))
  const [{ gender, sort, species, mutationsOnly }, setFilters] = useQueryStates({
    gender: parseAsString.withDefault(''),
    sort: parseAsString.withDefault('updated'),
    species: parseAsString.withDefault(''),
    mutationsOnly: parseAsString.withDefault(''),
  })

  const load = useCallback(async () => {
    const all = await getAllCreatures()
    setCreatures(all)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleImported = useCallback(() => { load(); setShowImport(false) }, [load])
  const handleRestored = useCallback(() => { load() }, [load])

  // Distinct species for filter dropdown
  const speciesList = useMemo(() => {
    const tags = [...new Set(creatures.map((c) => c.dinoNameTag.replace(/AA$/, '')))]
    return tags.sort()
  }, [creatures])

  // Filter + sort
  const filtered = useMemo(() => {
    let result = [...creatures]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.dinoNameTag.toLowerCase().includes(q) ||
        c.tamer.toLowerCase().includes(q)
      )
    }
    if (species) {
      result = result.filter((c) => c.dinoNameTag.replace(/AA$/, '') === species)
    }
    if (gender === 'm') result = result.filter((c) => !c.isFemale)
    if (gender === 'f') result = result.filter((c) => c.isFemale)
    if (mutationsOnly === '1') result = result.filter((c) => c.mutationsMale + c.mutationsFemale > 0)

    result.sort((a, b) => {
      switch (sort) {
        case 'level': return b.level - a.level
        case 'melee': return b.stats.meleeDamage - a.stats.meleeDamage
        case 'health': return b.stats.health - a.stats.health
        case 'name': return a.name.localeCompare(b.name)
        case 'imported': return b.importedAt - a.importedAt
        default: return b.updatedAt - a.updatedAt
      }
    })

    return result
  }, [creatures, search, species, gender, mutationsOnly, sort])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const activeFilterCount = [
    gender !== '',
    species !== '',
    mutationsOnly === '1',
    sort !== 'updated',
  ].filter(Boolean).length

  const clearFilters = () => {
    setFilters({ gender: '', sort: 'updated', species: '', mutationsOnly: '' })
    setPage(1)
  }

  return (
    <main className="bg-background min-h-screen">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">

        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-wide">My Creatures</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {creatures.length} creature{creatures.length !== 1 ? 's' : ''} stored locally
            </p>
          </div>
          <Button onClick={() => setShowImport((v) => !v)} className="gap-2">
            <IconUpload size={14} />
            Import
          </Button>
        </div>

        {/* Import panel */}
        {showImport && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Import Creature Exports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ImportDropzone onImported={handleImported} />
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <IconCloudUpload size={14} /> Google Drive Sync
                </p>
                <DriveSync onRestored={handleRestored} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search + Filter bar */}
        {creatures.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <IconSearch size={14} className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="search"
                placeholder="Search by name, species, or tribe…"
                value={search}
                onChange={(e) => { setSearch(e.target.value || null); setPage(1) }}
                className="pl-9"
              />
            </div>
            <Button
              variant={activeFilterCount > 0 ? 'default' : 'outline'}
              size="sm"
              className="gap-2 shrink-0"
              onClick={() => setShowFilters((v) => !v)}
            >
              <IconFilter size={14} />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">{activeFilterCount}</Badge>
              )}
            </Button>
          </div>
        )}

        {/* Filter panel */}
        {showFilters && creatures.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {/* Species */}
                <div className="space-y-1">
                  <label className="text-muted-foreground text-xs font-medium">Species</label>
                  <Select value={species} onValueChange={(v) => { setFilters({ species: v === '__all' ? '' : v }); setPage(1) }}>
                    <SelectTrigger className="h-8 w-full text-xs">
                      <SelectValue placeholder="All species" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">All species</SelectItem>
                      {speciesList.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Gender */}
                <div className="space-y-1">
                  <label className="text-muted-foreground text-xs font-medium">Gender</label>
                  <Select value={gender || '__all'} onValueChange={(v) => { setFilters({ gender: v === '__all' ? '' : v }); setPage(1) }}>
                    <SelectTrigger className="h-8 w-full text-xs">
                      <SelectValue placeholder="Any gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">Any gender</SelectItem>
                      <SelectItem value="m">♂ Male</SelectItem>
                      <SelectItem value="f">♀ Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort */}
                <div className="space-y-1">
                  <label className="text-muted-foreground text-xs font-medium">Sort by</label>
                  <Select value={sort} onValueChange={(v) => { setFilters({ sort: v }); setPage(1) }}>
                    <SelectTrigger className="h-8 w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="updated">Recently updated</SelectItem>
                      <SelectItem value="imported">Recently imported</SelectItem>
                      <SelectItem value="level">Highest level</SelectItem>
                      <SelectItem value="melee">Highest melee</SelectItem>
                      <SelectItem value="health">Highest health</SelectItem>
                      <SelectItem value="name">Name A–Z</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Mutations filter */}
                <div className="space-y-1">
                  <label className="text-muted-foreground text-xs font-medium">Mutations</label>
                  <Select value={mutationsOnly === '1' ? '1' : '__all'} onValueChange={(v) => { setFilters({ mutationsOnly: v === '1' ? '1' : '' }); setPage(1) }}>
                    <SelectTrigger className="h-8 w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">Any</SelectItem>
                      <SelectItem value="1">Has mutations</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" className="mt-3 text-xs" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Grid */}
        {loading ? (
          <div className="text-muted-foreground py-16 text-center">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="space-y-3 py-20 text-center">
            <p className="text-5xl">🦕</p>
            <p className="text-muted-foreground text-sm">
              {creatures.length === 0
                ? 'No creatures yet. Import a .ini export file to get started.'
                : 'No creatures match your search.'}
            </p>
            {creatures.length === 0 && (
              <Button variant="link" onClick={() => setShowImport(true)}>
                Import your first creature →
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {paginated.map((creature) => (
                <CreatureCard key={creature.id} creature={creature} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-4 pt-2">
                <div className="text-muted-foreground text-xs">
                  Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage <= 1}
                    onClick={() => setPage(safePage - 1)}
                    className="h-7 px-2 text-xs"
                  >
                    ←
                  </Button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const p = Math.max(1, Math.min(totalPages - 4, safePage - 2)) + i
                    return (
                      <Button
                        key={p}
                        variant={p === safePage ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPage(p)}
                        className="h-7 w-7 p-0 text-xs"
                      >
                        {p}
                      </Button>
                    )
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage(safePage + 1)}
                    className="h-7 px-2 text-xs"
                  >
                    →
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">Per page:</span>
                  <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
                    <SelectTrigger className="h-7 w-16 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default function MyCreaturesPage() {
  return (
    <Suspense>
      <MyCreaturesContent />
    </Suspense>
  )
}
