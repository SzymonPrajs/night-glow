'use client'

import dynamic from 'next/dynamic'

const GlobeView = dynamic(() => import('../../components/globe/GlobeView'), { ssr: false })

export default function GlobeClient() {
  return <GlobeView />
}
