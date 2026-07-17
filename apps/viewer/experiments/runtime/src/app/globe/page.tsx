import dynamic from 'next/dynamic'

const GlobeProbe = dynamic(() => import('../../components/globe-probe'))

export default function GlobePage() {
  return (
    <main>
      <div className="route-copy">
        <p className="eyebrow">Environment display path</p>
        <h1>Globe route</h1>
        <p>A client-only MapLibre globe with a synthetic custom scientific layer.</p>
      </div>
      <GlobeProbe />
    </main>
  )
}
