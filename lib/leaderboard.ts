import { supabase } from './supabase'

export interface LeaderboardEntry {
  id: string
  display_name: string | null
  completed_exchanges: number
  points: number
  avatar_url: string | null
}

/** Get top givers in a suburb, ordered by completed exchanges */
export async function getSuburbLeaderboard(suburb: string, limit = 10): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, completed_exchanges, points, avatar_url')
    .ilike('suburb', suburb)
    .gt('completed_exchanges', 0)
    .order('completed_exchanges', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data || []) as LeaderboardEntry[]
}
