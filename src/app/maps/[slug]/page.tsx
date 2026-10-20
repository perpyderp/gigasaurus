import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { MapService } from '@/services/map'
import { JsonLd, breadcrumbs } from '@/components/JsonLd'
import { MapView } from './map-view'

// Prerendered per map. Query-string URLs (?creature=, ?tab=, …) are rewritten to ./explore in next.config.ts.
export const dynamicParams = false

export async function generateStaticParams() {
  return MapService.getAll().results.map((m) => ({ slug: m.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const map = MapService.getBySlug(slug)
  if (!map) return { title: 'Map Not Found' }
  const title = `${map.name} Map: Creature Spawns, Resources & Caves`
  const description = `Interactive ARK: Survival Ascended map of ${map.name}: spawn locations for all ${map.creatures.length} creature spawn entries, resource nodes, caves, artifacts and obelisks.${map.summary ? ` ${map.summary}` : ''}`
  return {
    title,
    description,
    keywords: [`ark ${map.name.toLowerCase()}`, `${map.name.toLowerCase()} map`, `${map.name.toLowerCase()} spawns`, `${map.name.toLowerCase()} resources`, 'ark survival ascended'],
    alternates: { canonical: `/maps/${map.slug}` },
    openGraph: { title, description, url: `/maps/${map.slug}`, images: map.image ? [{ url: map.image, alt: `${map.name} map` }] : undefined },
  }
}

export default async function MapPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const map = MapService.getBySlug(slug)
  if (!map) notFound()
  return (
    <>
      <JsonLd
        data={breadcrumbs([
          { name: 'Maps', path: '/maps' },
          { name: map.name, path: `/maps/${map.slug}` },
        ])}
      />
      <MapView map={map} query={{}} />
    </>
  )
}
