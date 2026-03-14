/** Reliability level from score */
export const relLevel = (s: number | null) =>
  s === null ? 'new' : s >= 90 ? 'high' : s >= 70 ? 'mid' : 'low'

/** Time remaining from expiry date string */
export const getTimeLeft = (exp: string): string => {
  const ms = new Date(exp).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/** Relative date formatting */
export const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return days === 1 ? 'Yesterday' : `${days}d ago`
}

/** Static drop point resources */
export const DROP_POINTS = [
  { name: 'Inglewood Community Centre', distance: '0.3 km', hours: '8am-5pm' },
  { name: 'Inglewood Library', distance: '0.4 km', hours: '9:30am-5pm' },
  { name: 'Fun Ho! Toys Building', distance: '0.5 km', hours: '10am-4pm' },
]

export const STEPS_GIVE = ['Listed', 'Matched', 'Done']
export const STEPS_NEED = ['Listed', 'Matched', 'Done']
export const STEP_INDEX: Record<string, number> = { listed: 0, matched: 1, completed: 2 }
