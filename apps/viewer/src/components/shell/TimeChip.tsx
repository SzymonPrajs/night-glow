'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import styles from './shell.module.css'
import {
  formatLocalWithOffset,
  formatUtc,
  fromLocalInputValue,
  toLocalInputValue,
} from '../../lib/format.ts'
import {
  buildGlobeQuery,
  buildObserveQuery,
  parseGlobeState,
  parseObserveState,
} from '../../lib/scenario/url-state.ts'

// Observation time, always displayed with its basis. The URL stores UTC ISO;
// the editor works in device-local wall time (presentation only). Applying a
// new time commits it to the URL, which on the Sky view starts a new scenario.
export default function TimeChip() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  const requestedTimeUtc = pathname.startsWith('/observe')
    ? parseObserveState(searchParams).requestedTimeUtc
    : parseGlobeState(searchParams).requestedTimeUtc

  const draftIso = fromLocalInputValue(draft)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const openEditor = () => {
    setDraft(toLocalInputValue(requestedTimeUtc))
    setOpen(true)
  }

  const commit = (iso: string) => {
    setOpen(false)
    if (pathname.startsWith('/observe')) {
      const state = parseObserveState(searchParams)
      router.push(`/observe?${buildObserveQuery({ ...state, requestedTimeUtc: iso }).toString()}`)
    } else {
      const state = parseGlobeState(searchParams)
      router.push(`/globe?${buildGlobeQuery({ ...state, requestedTimeUtc: iso }).toString()}`)
    }
  }

  return (
    <div className={styles.popoverAnchor}>
      <button
        type="button"
        className={styles.chip}
        onClick={() => (open ? setOpen(false) : openEditor())}
        aria-expanded={open}
        aria-label={`Observation time, ${formatLocalWithOffset(requestedTimeUtc)}; edit`}
      >
        <span className="mono">{formatLocalWithOffset(requestedTimeUtc)}</span>
      </button>
      {open ? (
        <>
          <button
            type="button"
            className={styles.backdrop}
            aria-label="Close time editor"
            onClick={() => setOpen(false)}
          />
          <div className={styles.popover} role="dialog" aria-label="Edit observation time" ref={panelRef}>
            <p className={styles.popoverTitle}>Observation time</p>
            <label className="visually-hidden" htmlFor="time-editor-input">
              Local date and time
            </label>
            <input
              id="time-editor-input"
              className={styles.textInput}
              style={{ width: '100%' }}
              type="datetime-local"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className={styles.popoverRow}>
              <span className="mono" style={{ color: 'var(--dim)', fontSize: 12 }}>
                {draftIso ? formatUtc(draftIso) : '—'}
              </span>
              <button type="button" className={styles.button} onClick={() => commit(new Date().toISOString())}>
                Now
              </button>
            </div>
            <div className={styles.popoverRow}>
              <button type="button" className={styles.button} onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.buttonPrimary}
                disabled={!draftIso}
                onClick={() => draftIso && commit(draftIso)}
              >
                Apply
              </button>
            </div>
            <p className={styles.popoverNote}>
              Local time is display-only; the scenario stores UTC. On the Sky view a new time
              starts a new computation.
            </p>
          </div>
        </>
      ) : null}
    </div>
  )
}
