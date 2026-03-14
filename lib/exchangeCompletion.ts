import { supabase } from './supabase'
import { getDistanceKm } from './location'
import { updateItemStatus } from './items'
import { updateMatchStatus } from './matches'

export interface ConfirmResult {
  bothConfirmed: boolean
  partnerName: string | null
}

export interface FinalizeResult {
  proximityVerified: boolean
  distanceM: number | null
}

export interface ConfirmationState {
  matchId: string
  giverId: string
  receiverId: string
  giverConfirmed: boolean
  receiverConfirmed: boolean
}

/** Record one side's completion confirmation + optional GPS location */
export async function confirmExchange(
  matchId: string,
  userId: string,
  role: 'giver' | 'receiver',
  location?: { lat: number; lng: number } | null,
): Promise<ConfirmResult> {
  const now = new Date().toISOString()
  const updates: Record<string, any> = {}

  if (role === 'giver') {
    updates.giver_confirmed_at = now
    if (location) {
      updates.giver_lat = location.lat
      updates.giver_lng = location.lng
    }
  } else {
    updates.receiver_confirmed_at = now
    if (location) {
      updates.receiver_lat = location.lat
      updates.receiver_lng = location.lng
    }
  }

  const { error } = await supabase
    .from('matches')
    .update(updates)
    .eq('id', matchId)
  if (error) throw error

  // Re-fetch to check if both sides confirmed
  const { data: match, error: fetchErr } = await supabase
    .from('matches')
    .select('status, giver_confirmed_at, receiver_confirmed_at, giver_id, receiver_id')
    .eq('id', matchId)
    .single()
  if (fetchErr) throw fetchErr

  // If match was already completed (e.g. old flow), treat as both confirmed
  const bothConfirmed = match.status === 'completed' || (!!match.giver_confirmed_at && !!match.receiver_confirmed_at)

  const partnerId = role === 'giver' ? match.receiver_id : match.giver_id
  let partnerName: string | null = null
  if (partnerId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', partnerId)
      .single()
    partnerName = profile?.display_name || null
  }

  return {
    bothConfirmed,
    partnerName,
  }
}

/** Finalize exchange: set statuses to completed, calculate proximity */
export async function finalizeExchange(
  matchId: string,
  itemId: string,
): Promise<FinalizeResult> {
  // Guard: skip if already completed
  const { data: match } = await supabase
    .from('matches')
    .select('status, giver_lat, giver_lng, receiver_lat, receiver_lng')
    .eq('id', matchId)
    .single()

  if (match?.status === 'completed') {
    return { proximityVerified: false, distanceM: null }
  }

  // Set match and item to completed
  await updateMatchStatus(matchId, 'completed')
  await updateItemStatus(itemId, 'completed')

  // Calculate proximity
  let proximityVerified = false
  let distanceM: number | null = null

  if (match?.giver_lat && match?.giver_lng && match?.receiver_lat && match?.receiver_lng) {
    const km = getDistanceKm(match.giver_lat, match.giver_lng, match.receiver_lat, match.receiver_lng)
    distanceM = Math.round(km * 1000)
    proximityVerified = km <= 0.2 // within 200m
  }

  return { proximityVerified, distanceM }
}

/** Get confirmation state for the accepted match on an item */
export async function getMatchConfirmationState(itemId: string): Promise<ConfirmationState | null> {
  const { data, error } = await supabase
    .from('matches')
    .select('id, giver_id, receiver_id, giver_confirmed_at, receiver_confirmed_at')
    .eq('item_id', itemId)
    .eq('status', 'accepted')
    .limit(1)
    .maybeSingle()
  if (error || !data) return null

  return {
    matchId: data.id,
    giverId: data.giver_id,
    receiverId: data.receiver_id,
    giverConfirmed: !!data.giver_confirmed_at,
    receiverConfirmed: !!data.receiver_confirmed_at,
  }
}

/** Batch fetch confirmation states for multiple items */
export async function getMatchConfirmationStates(itemIds: string[]): Promise<Record<string, ConfirmationState>> {
  if (itemIds.length === 0) return {}
  const { data, error } = await supabase
    .from('matches')
    .select('id, item_id, giver_id, receiver_id, giver_confirmed_at, receiver_confirmed_at')
    .in('item_id', itemIds)
    .eq('status', 'accepted')
  if (error || !data) return {}

  const result: Record<string, ConfirmationState> = {}
  for (const row of data as any[]) {
    result[row.item_id] = {
      matchId: row.id,
      giverId: row.giver_id,
      receiverId: row.receiver_id,
      giverConfirmed: !!row.giver_confirmed_at,
      receiverConfirmed: !!row.receiver_confirmed_at,
    }
  }
  return result
}
