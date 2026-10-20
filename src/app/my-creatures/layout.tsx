import type { Metadata } from 'next'

// Imported creatures live in the visitor's browser; there's nothing here for search engines.
export const metadata: Metadata = {
  title: 'My Creatures',
  robots: { index: false, follow: true },
}

export default function MyCreaturesLayout({ children }: { children: React.ReactNode }) {
  return children
}
