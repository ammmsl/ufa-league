/**
 * Returns the next Tuesday or Friday at 20:30 MVT (Indian/Maldives, UTC+5).
 * If today is Tuesday or Friday and it's before 20:30 MVT, returns today.
 */
export function nextGameDay(): Date {
  const now = new Date()
  // Create a Date whose wall-clock values represent the current time in MVT
  const mvt = new Date(now.toLocaleString('en-US', { timeZone: 'Indian/Maldives' }))
  const day = mvt.getDay() // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

  let daysUntilNext = 0
  if (day === 2 && mvt.getHours() < 20) daysUntilNext = 0      // Tuesday before 20:30
  else if (day === 5 && mvt.getHours() < 20) daysUntilNext = 0  // Friday before 20:30
  else if (day < 2) daysUntilNext = 2 - day                     // Mon → Tue
  else if (day < 5) daysUntilNext = 5 - day                     // Wed/Thu → Fri
  else daysUntilNext = 7 - day + 2                               // Fri 20:30+, Sat, Sun → next Tue

  const next = new Date(mvt)
  next.setDate(mvt.getDate() + daysUntilNext)
  next.setHours(20, 30, 0, 0)
  return next
}

/**
 * Format a Date (whose wall-clock represents MVT) as a datetime-local input value.
 * e.g. "2026-03-10T20:30"
 */
export function toDatetimeLocal(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${day}T${h}:${min}`
}

/**
 * Convert a datetime-local string (e.g. "2026-03-10T20:30") to an
 * offset-aware ISO string in MVT (+05:00) suitable for Postgres timestamptz.
 */
export function toMVTIso(datetimeLocal: string): string {
  return `${datetimeLocal}:00+05:00`
}
