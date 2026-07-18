'use client'

import Link from 'next/link'
import styles from './shell.module.css'
import ModeSwitch from './ModeSwitch.tsx'
import PlaceField from './PlaceField.tsx'
import TimeChip from './TimeChip.tsx'
import StatusPills from './StatusPills.tsx'
import ShareButton from './ShareButton.tsx'
import InspectorSheet from './InspectorSheet.tsx'
import { useAppState } from './app-state.tsx'

// The floating shell above either canvas: identity, Globe/Sky switch, place
// entry, observation time, the two status indicators, share and inspector.
export default function TopBar() {
  const { openInspector } = useAppState()
  return (
    <>
      <header className={styles.topbar}>
        <Link href="/about" className={styles.brand} aria-label="Night Glow — about this app">
          <span className={styles.brandDot} aria-hidden />
          Night Glow
        </Link>
        <ModeSwitch />
        <span className={styles.spacer} />
        <PlaceField />
        <TimeChip />
        <StatusPills />
        <ShareButton />
        <button type="button" className={styles.button} onClick={() => openInspector()}>
          Inspector
        </button>
      </header>
      <InspectorSheet />
    </>
  )
}
