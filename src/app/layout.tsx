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
  title: 'Gigasaurus',
  description: 'ARK: Survival Ascended companion — creatures, armor, weapons, resources.',
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
