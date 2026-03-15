import { supabase } from './supabase'

export interface LeaderboardEntry {
  id: string
  display_name: string | null
  completed_exchanges: number
  points: number
  total_points: number
  avatar_url: string | null
  is_premium: boolean
}

export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'alltime'

/** Get top givers in a suburb (all-time), ordered by completed exchanges */
export async function getSuburbLeaderboard(suburb: string, limit = 10): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, completed_exchanges, points, avatar_url, is_premium')
    .ilike('suburb', suburb)
    .gt('completed_exchanges', 0)
    .order('completed_exchanges', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data || []).map((d: any) => ({ ...d, total_points: d.points })) as LeaderboardEntry[]
}

/** Get top earners in a suburb by points earned within a time period */
export async function getTimedLeaderboard(suburb: string, period: 'daily' | 'weekly' | 'monthly', limit = 10): Promise<LeaderboardEntry[]> {
  const now = new Date()
  let since: string
  if (period === 'daily') {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    since = d.toISOString()
  } else if (period === 'weekly') {
    const d = new Date(now)
    d.setDate(d.getDate() - d.getDay()) // start of week (Sunday)
    d.setHours(0, 0, 0, 0)
    since = d.toISOString()
  } else {
    const d = new Date(now.getFullYear(), now.getMonth(), 1)
    since = d.toISOString()
  }

  // Query points_log for the period, join with profiles (filtered by suburb)
  const { data, error } = await supabase
    .from('points_log')
    .select('user_id, points, profiles!inner(id, display_name, avatar_url, completed_exchanges, is_premium, suburb, points)')
    .gte('created_at', since)
    .gt('points', 0)
    .ilike('profiles.suburb', suburb)

  if (error) throw error
  if (!data || data.length === 0) return []

  // Aggregate points per user
  const userMap = new Map<string, LeaderboardEntry>()
  for (const row of data as any[]) {
    const uid = row.user_id
    const profile = row.profiles
    if (!profile) continue
    const existing = userMap.get(uid)
    if (existing) {
      existing.points += row.points
    } else {
      userMap.set(uid, {
        id: uid,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        completed_exchanges: profile.completed_exchanges || 0,
        points: row.points,
        total_points: profile.points || 0,
        is_premium: profile.is_premium ?? false,
      })
    }
  }

  // Sort by points earned in this period, descending
  const sorted = Array.from(userMap.values())
    .sort((a, b) => b.points - a.points)
    .slice(0, limit)
  return sorted
}
