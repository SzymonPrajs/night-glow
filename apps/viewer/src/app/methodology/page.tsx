import Link from 'next/link'

export default function MethodologyPage() {
  return (
    <main className="article">
      <h1>Methodology</h1>
      <h2>The pipeline</h2>
      <p>
        <strong>Environment</strong> reconstructs scientific input fields — corrected surface
        emission and four-dimensional atmospheric state — as immutable, independently versioned
        releases. <strong>Physics</strong> resolves astronomy and builds an optical atmosphere
        from those releases, then solves radiative transfer and observation response, returning
        versioned observer render products. <strong>The Viewer</strong> (this app) owns
        interaction, WebGL resources and display transforms only; it contains no scientific
        equations. In the browser, both scientific packages run as WebAssembly modules
        coordinated by a worker that handles scheduling, progress, cancellation and buffer
        lifetime.
      </p>
      <h2>What a control can and cannot do</h2>
      <p>
        Place, time and atmosphere selection are <strong>physical controls</strong>: changing one
        creates a new scenario revision and recomputes, with staged progress and the previous
        result retained (and labelled) until the new one is coherent. Exposure, enhancement and
        tone mapping are <strong>display-only controls</strong>: they act on the retained
        high-dynamic-range product and never trigger a computation.
      </p>
      <h2>Separate axes, never collapsed</h2>
      <p>
        Data validity (valid, missing, masked, censored, not covered), runtime availability
        (loading, available, failed), evidence class, uncertainty and numerical fidelity are
        distinct properties. &ldquo;Dark&rdquo;, &ldquo;zero&rdquo;, &ldquo;missing&rdquo; and
        &ldquo;not loaded&rdquo; are never interchangeable, and a runtime failure never changes a
        scientific validity. The two status indicators in the top bar report runtime and
        scientific state independently.
      </p>
      <h2>Current limits</h2>
      <p>
        This build runs the synthetic contract fixture slice: one pinned emission release (2 × 2
        cells over central Poland), one pinned atmosphere release (2 × 2 × 3), and one pinned
        standard-scenario selection valid at 2024-01-15T00:00:00Z. Requests outside that
        validity fail closed with a structured reason rather than fabricating an answer. The
        Inspector exposes the scenario, product identities, stage timings and provenance hashes
        for every result.
      </p>
      <p>
        Back to <Link href="/about">About</Link> or the <Link href="/globe">Globe</Link>.
      </p>
    </main>
  )
}
