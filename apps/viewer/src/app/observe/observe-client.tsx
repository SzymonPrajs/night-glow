'use client'

import dynamic from 'next/dynamic'

const ObserveView = dynamic(() => import('../../components/observe/ObserveView'), { ssr: false })

export default function ObserveClient() {
  return <ObserveView />
}
