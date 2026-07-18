// Display formatting helpers. Every rendered time states its basis (UTC or
// local-with-offset); local civil time is presentation-only and never stored.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatLatitude(deg: number): string {
  return `${Math.abs(deg).toFixed(4)}° ${deg >= 0 ? 'N' : 'S'}`
}

export function formatLongitude(deg: number): string {
  return `${Math.abs(deg).toFixed(4)}° ${deg >= 0 ? 'E' : 'W'}`
}

export function formatLatLon(latitudeDeg: number, longitudeDeg: number): string {
  return `${formatLatitude(latitudeDeg)}, ${formatLongitude(longitudeDeg)}`
}

export function formatHeight(meters: number): string {
  return `${Math.round(meters)} m`
}

export function formatDegrees(deg: number, digits = 1): string {
  return `${deg.toFixed(digits)}°`
}

export function formatUtc(iso: string): string {
  const date = new Date(iso)
  return (
    `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()} · ` +
    `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())} UTC`
  )
}

function utcOffsetString(date: Date): string {
  // getTimezoneOffset() is minutes behind UTC (negative east of Greenwich).
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '−'
  const abs = Math.abs(offsetMinutes)
  return `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`
}

export function formatLocalWithOffset(iso: string): string {
  const date = new Date(iso)
  return (
    `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()} · ` +
    `${pad2(date.getHours())}:${pad2(date.getMinutes())} UTC${utcOffsetString(date)}`
  )
}

export function formatValue(value: number, unit: string): string {
  const formatted = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6 }).format(value)
  return unit === '1' ? formatted : `${formatted} ${unit}`
}

// Value of an ISO UTC instant as a <input type="datetime-local"> value,
// expressed in the device's local zone.
export function toLocalInputValue(iso: string): string {
  const date = new Date(iso)
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
    `T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  )
}

// Inverse of toLocalInputValue: the local wall-clock input becomes a UTC ISO
// instant. Returns null for unparseable input. Whole-second results drop the
// milliseconds suffix so the canonical fixture form ("...T00:00:00Z") is
// reproduced exactly — the coordinator pins times by string identity.
export function fromLocalInputValue(value: string): string | null {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().replace(/\.000Z$/, 'Z')
}
