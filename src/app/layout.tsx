import type { Metadata } from 'next'
import { Geist, Geist_Mono, Fraunces, Inter_Tight } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
})

const fraunces = Fraunces({
  variable: '--font-display',
  subsets: ['latin'],
  axes: ['opsz', 'SOFT'],
})

// Inter Tight: usada solo para números editoriales en el dashboard
// (tabular-nums + lining-nums de fábrica, glifos diseñados para datos).
const interTight = Inter_Tight({
  variable: '--font-numbers',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'MAGNOLIA FOOD',
  description: 'Gestión gastronómica para MAGNOLIA FOOD',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${interTight.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
