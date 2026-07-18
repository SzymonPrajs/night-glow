import Link from 'next/link'

export default function AboutPage() {
  return (
    <main className="article">
      <h1>Night Glow</h1>
      <p>
        Night Glow reconstructs the environmental inputs that shape the night sky — artificial
        light emitted from the surface and the state of the atmosphere — computes physically
        based sky radiance, and lets you explore the result in two views.
      </p>
      <h2>Globe</h2>
      <p>
        A scientific map of the evidence: surface light emission and atmospheric products, each
        released as an immutable, versioned product. A cell&apos;s colour is a measured or
        reconstructed quantity — never a picture of the sky.
      </p>
      <h2>Sky</h2>
      <p>
        The sky computed for one committed place and time. The radiance you see is produced by
        validated Rust physics compiled to WebAssembly; the display only projects and tone-maps
        it. Exposure and enhancement controls change the picture, never the physics.
      </p>
      <h2>Scientific honesty</h2>
      <p>
        <strong>This deployment currently serves the synthetic contract fixture slice.</strong>{' '}
        The data path is real — immutable fixture releases, the coordinator worker, and the
        Physics Wasm module — but the products are small synthetic fixtures used to validate the
        architecture, not calibrated sky predictions. Every surface that shows data also shows
        its fidelity and provenance; the Inspector exposes the full scenario and result.
      </p>
      <p>
        Read <Link href="/methodology">Methodology</Link> for how the pipeline works, or go back
        to the <Link href="/globe">Globe</Link>.
      </p>
    </main>
  )
}
