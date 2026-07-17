import dynamic from 'next/dynamic'

const ObserverProbe = dynamic(() => import('../../components/observer-probe'))

export default function ObservePage() {
  return (
    <main>
      <div className="route-copy">
        <p className="eyebrow">Physics render-product path</p>
        <h1>Observer route</h1>
        <p>A separate client-only WebGL2 engine with explicit resource ownership.</p>
      </div>
      <ObserverProbe />
    </main>
  )
}
