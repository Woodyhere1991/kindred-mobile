import { supabase } from './supabase'

export interface PublicProfile {
  id: string
  display_name: string | null
  avatar_url: string | null
  suburb: string | null
  points: number
  id_verified: boolean
  is_premium: boolean
  completed_exchanges: number
  total_exchanges: number
  streak: number
  created_at: string | null
  lat: number | null
  lng: number | null
}

export interface ReliabilityStats {
  avgRating: number | null
  totalRatings: number
  fiveStarCount: number
}

/** Fetch a public profile by user ID */
export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, suburb, points, id_verified, is_premium, completed_exchanges, total_exchanges, streak, created_at, lat, lng')
    .eq('id', userId)
    .single()
  if (error || !data) return null
  return data as PublicProfile
}

/** Fetch reliability stats for a user (ratings they've received) */
export async function getReliabilityStats(userId: string): Promise<ReliabilityStats> {
  const { data, error } = await supabase
    .from('reliability')
    .select('rating')
    .eq('partner_id', userId)
    .eq('completed', true)
  if (error || !data || data.length === 0) {
    return { avgRating: null, totalRatings: 0, fiveStarCount: 0 }
  }
  const ratings = data.map(r => r.rating).filter(r => r != null) as number[]
  const avg = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
  const fiveStars = ratings.filter(r => r === 5).length
  return { avgRating: avg, totalRatings: ratings.length, fiveStarCount: fiveStars }
}
