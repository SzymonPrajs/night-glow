import type { Metadata } from 'next'
import Link from 'next/link'
import './styles.css'

export const metadata: Metadata = {
  title: 'Night Glow runtime proof',
  description: 'Bounded Next.js, MapLibre and WebGL2 feasibility experiment',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header>
          <Link href="/globe">Globe</Link>
          <Link href="/observe">Observe</Link>
          <span>M1 runtime proof</span>
        </header>
        {children}
      </body>
    </html>
  )
}
