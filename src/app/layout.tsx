import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gigasaurus",
  description: "ARK: Survival Ascended companion — creatures, armor, weapons, resources.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <nav className="sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 h-12 flex items-center gap-6">
            <Link href="/" className="font-bold text-zinc-900 dark:text-zinc-100 text-sm tracking-tight">
              🦕 Gigasaurus
            </Link>
            <Link href="/my-creatures" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              My Creatures
            </Link>
            <Link href="/api/openapi" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors ml-auto">
              API Docs
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
