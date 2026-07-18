'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import styles from './shell.module.css'
import {
  buildGlobeQuery,
  buildObserveQuery,
  parseCoordinateInput,
  parseGlobeState,
  parseObserveState,
} from '../../lib/scenario/url-state.ts'

// Typed coordinate entry — the keyboard and screen-reader path to any point,
// independent of the map/sky canvases.
export default function PlaceField() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const parsed = parseCoordinateInput(value)
    if (!parsed.ok) {
      setError(parsed.message)
      return
    }
    setError(null)
    setValue('')
    if (pathname.startsWith('/observe')) {
      const state = parseObserveState(searchParams)
      router.push(
        `/observe?${buildObserveQuery({
          ...state,
          latitudeDeg: parsed.latitudeDeg,
          longitudeDeg: parsed.longitudeDeg,
        }).toString()}`,
      )
    } else {
      const state = parseGlobeState(searchParams)
      router.push(
        `/globe?${buildGlobeQuery({
          ...state,
          latitudeDeg: parsed.latitudeDeg,
          longitudeDeg: parsed.longitudeDeg,
          zoom: Math.max(state.zoom, 11),
        }).toString()}`,
      )
    }
  }

  return (
    <form className={styles.placeForm} role="search" onSubmit={submit}>
      <label className="visually-hidden" htmlFor="place-field">
        Go to coordinates in decimal degrees
      </label>
      <input
        id="place-field"
        className={styles.textInput}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="lat, lon"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        aria-describedby={error ? 'place-field-error' : undefined}
      />
      <button className={styles.button} type="submit">
        Go
      </button>
      {error ? (
        <p id="place-field-error" className={styles.fieldError} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  )
}
