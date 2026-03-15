import { supabase } from './supabase'

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

/** Get count of completed exchanges per meetup location */
export async function getMeetupStats(): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('matches')
    .select('meetup_location')
    .eq('status', 'completed')
    .not('meetup_location', 'is', null)
  const counts: Record<string, number> = {}
  for (const row of data || []) {
    const loc = row.meetup_location as string
    counts[loc] = (counts[loc] || 0) + 1
  }
  return counts
}

/** Static meet up point resources */
export const DROP_POINTS = [
  { name: 'Inglewood Community Centre', distance: '0.3 km', hours: 'Mon–Fri 8am–5pm', address: '90 Rata St, Inglewood', note: 'Public foyer area, well-lit with CCTV' },
  { name: 'Inglewood Library', distance: '0.4 km', hours: 'Mon–Fri 9:30am–5pm, Sat 10am–1pm', address: '42 Rata St, Inglewood', note: 'Front entrance, staffed during hours' },
  { name: 'Fun Ho! Toys Building', distance: '0.5 km', hours: 'Daily 10am–4pm', address: '25 Rata St, Inglewood', note: 'Covered entrance area, public space' },
]

/** Get home pickup/drop-off counts for one or more users (count follows the person, not the address) */
export async function getHomePickupCounts(userIds: string[]): Promise<Record<string, number>> {
  if (userIds.length === 0) return {}
  const { data } = await supabase
    .from('matches')
    .select('meetup_at_home_of')
    .eq('status', 'completed')
    .in('meetup_at_home_of', userIds)
  const counts: Record<string, number> = {}
  for (const row of data || []) {
    const uid = row.meetup_at_home_of as string
    counts[uid] = (counts[uid] || 0) + 1
  }
  return counts
}

export const STEPS_GIVE = ['Listed', 'Matched', 'Done']
export const STEPS_NEED = ['Listed', 'Matched', 'Done']
export const STEP_INDEX: Record<string, number> = { listed: 0, matched: 1, completed: 2 }
