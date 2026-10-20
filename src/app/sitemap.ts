import type { MetadataRoute } from 'next'
import { CreatureService } from '@/services/creature'
import { MapService } from '@/services/map'
import { absoluteUrl } from '@/lib/site'

/** Every prerendered public page. Spawn pages mirror /maps/[slug]/[creature]'s generateStaticParams. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'weekly', priority: 1 },
    ...['/creatures', '/maps', '/resources', '/armor', '/weapons'].map((path) => ({
      url: absoluteUrl(path),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),
  ]

  for (const c of CreatureService.getAll({ limit: 1000 }).results) {
    pages.push({ url: absoluteUrl(`/creatures/${c.slug}`), changeFrequency: 'monthly', priority: 0.8 })
  }

  for (const m of MapService.getAll().results) {
    pages.push({ url: absoluteUrl(`/maps/${m.slug}`), changeFrequency: 'monthly', priority: 0.8 })
    const map = MapService.getBySlug(m.slug)!
    const creatures = new Set(map.creatures.flatMap((c) => (c.creature && CreatureService.getBySlug(c.creature) ? [c.creature] : [])))
    for (const creature of creatures) {
      pages.push({ url: absoluteUrl(`/maps/${m.slug}/${creature}`), changeFrequency: 'monthly', priority: 0.6 })
    }
  }

  return pages
}
