'use client'

import { useEffect, useState, useCallback } from 'react'
import { getAllCreatures, deleteCreature } from '@/lib/db'
import type { StoredCreature } from '@/lib/db'
import { CreatureCard } from '@/components/CreatureCard'
import { ImportDropzone } from '@/components/ImportDropzone'
import { DriveSync } from '@/components/DriveSync'

export default function MyCreaturesPage() {
  const [creatures, setCreatures] = useState<StoredCreature[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showImport, setShowImport] = useState(false)

  const load = useCallback(async () => {
    const all = await getAllCreatures()
    setCreatures(all)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleImported = useCallback(() => {
    load()
    setShowImport(false)
  }, [load])

  const handleRestored = useCallback(() => {
    load()
  }, [load])

  const filtered = creatures.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      c.dinoNameTag.toLowerCase().includes(q) ||
      c.tamer.toLowerCase().includes(q)
    )
  })

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">My Creatures</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              {creatures.length} creature{creatures.length !== 1 ? 's' : ''} stored locally
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImport((v) => !v)}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-medium transition-colors"
            >
              <span>+</span>
              Import
            </button>
          </div>
        </div>

        {/* Import panel */}
        {showImport && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
            <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
              Import Creature Exports
            </h2>
            <ImportDropzone onImported={handleImported} />
            <hr className="border-zinc-200 dark:border-zinc-800" />
            <div>
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Google Drive Sync
              </h3>
              <DriveSync onRestored={handleRestored} />
            </div>
          </div>
        )}

        {/* Search */}
        {creatures.length > 0 && (
          <input
            type="search"
            placeholder="Search by name, species, or tribe…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        )}

        {/* Grid */}
        {loading ? (
          <div className="text-center text-zinc-400 py-16">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <p className="text-5xl">🦕</p>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              {creatures.length === 0
                ? 'No creatures yet. Import a .ini export file to get started.'
                : 'No creatures match your search.'}
            </p>
            {creatures.length === 0 && (
              <button
                onClick={() => setShowImport(true)}
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Import your first creature →
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filtered.map((creature) => (
              <CreatureCard key={creature.id} creature={creature} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
