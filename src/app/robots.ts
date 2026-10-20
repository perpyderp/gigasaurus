import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Personal, browser-stored data and the JSON API: nothing for search results.
      disallow: ['/api/', '/my-creatures'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
