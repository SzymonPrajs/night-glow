import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import './globals.css'
import { AppStateProvider } from '../components/shell/app-state.tsx'
import TopBar from '../components/shell/TopBar.tsx'

export const metadata: Metadata = {
  title: 'Night Glow',
  description:
    'Physically based night-sky radiance from versioned environmental data — explore the evidence on the Globe, then stand under the Sky.',
}

export const viewport: Viewport = {
  themeColor: '#050914',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

function TopBarFallback() {
  return <header aria-hidden style={{ minHeight: 52 }} />
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppStateProvider>
          <Suspense fallback={<TopBarFallback />}>
            <TopBar />
          </Suspense>
          {children}
        </AppStateProvider>
      </body>
    </html>
  )
}
