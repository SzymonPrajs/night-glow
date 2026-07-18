'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './shell.module.css'

// Copies the current URL: a copied link reproduces the same scientific
// question because the committed state lives in the query string.
export default function ShareButton() {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const copy = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Clipboard API unavailable (permissions, insecure context): fall back.
      const area = document.createElement('textarea')
      area.value = url
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1600)
  }

  return (
    <button
      type="button"
      className={styles.button}
      onClick={copy}
      aria-live="polite"
      aria-label="Copy share link"
    >
      {copied ? 'Copied' : 'Share'}
    </button>
  )
}
