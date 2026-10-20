import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Barlow } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/SiteFooter'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site'
import './globals.css'

const arkFont = localFont({
  src: './fonts/ARK-Regular.ttf',
  variable: '--font-ark',
  display: 'swap',
})

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-barlow',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME}: ARK Survival Ascended Creatures, Maps & Spawns`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'ark survival ascended',
    'ark ascended',
    'asa',
    'ark creatures',
    'ark spawn map',
    'ark taming',
    'ark map',
    'ark ragnarok',
    'ark the island',
    'ark aberration',
    'ark breeding',
  ],
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_US',
    images: [{ url: '/giga-glasses.png', width: 520, height: 520, alt: SITE_NAME }],
  },
  twitter: { card: 'summary_large_image' },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${arkFont.variable} ${barlow.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <NuqsAdapter>
            <TooltipProvider>
              <SiteNav />
              <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
                <div className="flex-1">{children}</div>
                <SiteFooter />
              </div>
            </TooltipProvider>
          </NuqsAdapter>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
