import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from "@vercel/speed-insights/next"

import type { Metadata } from "next"

import localFont from "next/font/local"

import { Inter } from "next/font/google"
import "./globals.css"
import { SideNav } from "@/components/SideNav"
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ["latin"] })
const arkFont = localFont({
    src: "./fonts/ARK-Regular.ttf",
    display: "swap",
    variable: "--font-ark-regular"
})

export const metadata: Metadata = {
    title: 'Gigasaurus',
    description: 'ARK API and helpful tools in one!',
}

export default function RootLayout({
        children,
    }: {
        children: React.ReactNode
    }) {
    return (
        <html lang="en">
            <body className={cn("flex flex-col", inter.className, arkFont.variable)}>
                <div className="flex flex-1 bg-theme-green-500">
                    {children}
                </div>
                <Analytics />
                <SpeedInsights />
            </body>
        </html>
    )
}
