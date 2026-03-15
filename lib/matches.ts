import { supabase } from './supabase'
import { compressImage } from './imageUtils'

export interface OfferPhoto {
  id: string
  match_id: string
  public_url: string
  position: number
}

export interface Match {
  id: string
  item_id: string
  giver_id: string
  receiver_id: string
  status: 'pending' | 'held' | 'accepted' | 'declined' | 'completed' | 'cancelled'
  message: string | null
  hold_until: string | null
  created_at: string
  giver_confirmed_at: string | null
  receiver_confirmed_at: string | null
  meetup_location: string | null
  meetup_address: string | null
  meetup_time: string | null
  meetup_set_by: string | null
  meetup_at_home_of: string | null
}

interface OfferProfile {
  display_name: string | null
  avatar_url: string | null
  completed_exchanges: number
  total_exchanges: number
  id_verified: boolean
  is_premium: boolean
  points: number
  suburb: string | null
}

export interface PendingOffer extends Match {
  giver_profile: OfferProfile | null
  receiver_profile: OfferProfile | null
  offer_photos?: OfferPhoto[]
}

/** Create a match (express interest / offer) */
export async function createMatch(itemId: string, giverId: string, receiverId: string, message?: string) {
  const { data, error } = await supabase
    .from('matches')
    .insert({
      item_id: itemId,
      giver_id: giverId,
      receiver_id: receiverId,
      status: 'pending',
      message: message || null,
    })
    .select()
    .single()
  if (error) throw error
  return data as Match
}

/** Update match status */
export async function updateMatchStatus(matchId: string, status: Match['status']) {
  const { error } = await supabase
    .from('matches')
    .update({ status })
    .eq('id', matchId)
  if (error) throw error
}

/** Get matches for a user */
export async function getMatchesForUser(userId: string) {
  const { data, error } = await supabase
    .from('matches')
    .select('*, items(title, category, type)')
    .or(`giver_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

/** Check if user already has a pending offer on an item */
export async function getPendingMatchForUser(itemId: string, userId: string) {
  const { data, error } = await supabase
    .from('matches')
    .select('id')
    .eq('item_id', itemId)
    .or(`giver_id.eq.${userId},receiver_id.eq.${userId}`)
    .in('status', ['pending', 'held'])
    .maybeSingle()
  if (error) throw error
  return data
}

/** Get all pending offers for an item (for owner to review) */
export async function getPendingOffersForItem(itemId: string) {
  const profileFields = 'display_name, avatar_url, completed_exchanges, total_exchanges, id_verified, is_premium, points, suburb'
  const { data, error } = await supabase
    .from('matches')
    .select(`*, giver_profile:profiles!matches_giver_id_fkey(${profileFields}), receiver_profile:profiles!matches_receiver_id_fkey(${profileFields}), offer_photos(id, match_id, public_url, position)`)
    .eq('item_id', itemId)
    .in('status', ['pending', 'held'])
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as unknown as PendingOffer[]) || []
}

/** Accept one offer and auto-decline all others */
export async function acceptOffer(itemId: string, acceptedMatchId: string, acceptedUserId: string) {
  const { error: acceptErr } = await supabase
    .from('matches')
    .update({ status: 'accepted' })
    .eq('id', acceptedMatchId)
  if (acceptErr) throw acceptErr

  // Decline all other pending and held offers
  const { error: declineErr } = await supabase
    .from('matches')
    .update({ status: 'declined', hold_until: null })
    .eq('item_id', itemId)
    .in('status', ['pending', 'held'])
    .neq('id', acceptedMatchId)
  if (declineErr) throw declineErr

  const { error: itemErr } = await supabase
    .from('items')
    .update({
      status: 'matched',
      other_person_id: acceptedUserId,
      match_expiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', itemId)
  if (itemErr) throw itemErr
}

/** Withdraw a pending offer (requester cancels) */
export async function withdrawOffer(matchId: string) {
  const { error } = await supabase
    .from('matches')
    .update({ status: 'cancelled' })
    .eq('id', matchId)
  if (error) throw error
}

/** Hold an offer — owner needs time to decide */
export async function holdOffer(matchId: string, holdHours: number) {
  const holdUntil = new Date(Date.now() + holdHours * 60 * 60 * 1000).toISOString()
  const { error } = await supabase
    .from('matches')
    .update({ status: 'held', hold_until: holdUntil })
    .eq('id', matchId)
  if (error) throw error
}

/** Release a held offer back to pending */
export async function releaseHold(matchId: string) {
  const { error } = await supabase
    .from('matches')
    .update({ status: 'pending', hold_until: null })
    .eq('id', matchId)
  if (error) throw error
}

/** Cancel an accepted match and re-list item */
export async function cancelMatchAndRelist(itemId: string, matchId: string) {
  const { error: matchErr } = await supabase
    .from('matches')
    .update({ status: 'cancelled' })
    .eq('id', matchId)
  if (matchErr) throw matchErr

  const { error: itemErr } = await supabase
    .from('items')
    .update({
      status: 'listed',
      other_person_id: null,
      match_expiry: null,
    })
    .eq('id', itemId)
  if (itemErr) throw itemErr
}

/** Get pending offer counts for multiple items (batch) */
export async function getPendingOfferCounts(itemIds: string[]) {
  if (itemIds.length === 0) return {} as Record<string, number>
  const { data, error } = await supabase
    .from('matches')
    .select('item_id')
    .in('item_id', itemIds)
    .eq('status', 'pending')
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const row of data || []) {
    counts[row.item_id] = (counts[row.item_id] || 0) + 1
  }
  return counts
}

/** Upload a photo attached to an offer/match */
export async function uploadOfferPhoto(
  userId: string,
  matchId: string,
  uri: string,
  position: number,
) {
  const filename = `offer-photos/${userId}/${matchId}/${position}.jpg`
  const compressed = await compressImage(uri)
  const response = await fetch(compressed)
  const blob = await response.blob()

  const { error: uploadError } = await supabase.storage
    .from('item-photos')
    .upload(filename, blob, { contentType: 'image/jpeg', upsert: true })
  if (uploadError) throw uploadError

  const { data: { publicUrl } } = supabase.storage
    .from('item-photos')
    .getPublicUrl(filename)

  const { error: insertError } = await supabase
    .from('offer_photos')
    .insert({ match_id: matchId, storage_path: filename, public_url: publicUrl, position })
  if (insertError) throw insertError

  return publicUrl
}

/** Expire stale accepted matches where neither party confirmed after 48h */
export async function expireStaleMatches(userId: string) {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  try {
    // Find accepted matches older than 48h where the current user is involved
    // and neither party has confirmed yet
    const { data: stale } = await supabase
      .from('matches')
      .select('id, item_id')
      .eq('status', 'accepted')
      .or(`giver_id.eq.${userId},receiver_id.eq.${userId}`)
      .is('giver_confirmed_at', null)
      .is('receiver_confirmed_at', null)
      .lt('created_at', cutoff)
    if (!stale || stale.length === 0) return 0

    // Cancel each stale match and re-list the item
    for (const match of stale) {
      await supabase.from('matches').update({ status: 'cancelled' }).eq('id', match.id)
      await supabase.from('items').update({ status: 'listed', other_person_id: null, match_expiry: null }).eq('id', match.item_id)
    }
    return stale.length
  } catch (err) {
    console.error('Failed to expire stale matches:', err)
    return 0
  }
}

export interface OutgoingOffer {
  id: string
  item_id: string
  status: Match['status']
  message: string | null
  hold_until: string | null
  created_at: string
  updated_at: string
  item_title: string
  item_type: 'give' | 'need'
  item_category: string
  owner_name: string | null
  photo_url: string | null
  owner_profile: {
    display_name: string | null
    avatar_url: string | null
    completed_exchanges: number
    total_exchanges: number
    id_verified: boolean
    is_premium: boolean
    points: number
    suburb: string | null
  } | null
  giver_confirmed_at: string | null
  receiver_confirmed_at: string | null
  giver_id: string
  receiver_id: string
}

/** Get all requests/offers the user has sent (outgoing) */
export async function getOutgoingOffers(userId: string): Promise<OutgoingOffer[]> {
  // Try with profile join first, fall back without it if FK doesn't exist
  let data: any[] | null = null
  let hasProfiles = true

  const { data: d1, error: e1 } = await supabase
    .from('matches')
    .select('id, item_id, status, message, hold_until, created_at, giver_id, receiver_id, giver_confirmed_at, receiver_confirmed_at, items!inner(title, type, category, user_id, item_photos(public_url, position), profiles:profiles!items_user_id_profiles_fkey(display_name, avatar_url, completed_exchanges, total_exchanges, id_verified, is_premium, points, suburb))')
    .or(`giver_id.eq.${userId},receiver_id.eq.${userId}`)
    .in('status', ['pending', 'held', 'accepted', 'declined', 'completed'])
    .order('created_at', { ascending: false })

  if (e1) {
    // Fallback: query without profile join
    hasProfiles = false
    const { data: d2, error: e2 } = await supabase
      .from('matches')
      .select('id, item_id, status, message, hold_until, created_at, giver_id, receiver_id, giver_confirmed_at, receiver_confirmed_at, items!inner(title, type, category, user_id, item_photos(public_url, position))')
      .or(`giver_id.eq.${userId},receiver_id.eq.${userId}`)
      .in('status', ['pending', 'held', 'accepted', 'declined', 'completed'])
      .order('created_at', { ascending: false })
    if (e2) throw e2
    data = d2
  } else {
    data = d1
  }

  type Row = {
    id: string; item_id: string; status: string; message: string | null; hold_until: string | null
    created_at: string; giver_id: string; receiver_id: string; giver_confirmed_at: string | null; receiver_confirmed_at: string | null
    items: { title: string; type: string; category: string; user_id: string; item_photos: { public_url: string; position: number }[]; profiles?: { display_name: string | null; avatar_url: string | null; completed_exchanges: number; total_exchanges: number; id_verified: boolean; is_premium: boolean; points: number; suburb: string | null } }
  }

  const rows = (data as unknown as Row[]) || []

  // Only include requests where the user is NOT the item owner
  return rows
    .filter(r => r.items.user_id !== userId)
    .map(r => {
      const photos = r.items.item_photos || []
      photos.sort((a, b) => a.position - b.position)
      return {
        id: r.id,
        item_id: r.item_id,
        status: r.status as Match['status'],
        message: r.message,
        hold_until: r.hold_until,
        created_at: r.created_at,
        updated_at: r.created_at,
        item_title: r.items.title,
        item_type: r.items.type as 'give' | 'need',
        item_category: r.items.category,
        owner_name: hasProfiles ? (r.items.profiles?.display_name || null) : null,
        photo_url: photos.length > 0 ? photos[0].public_url : null,
        owner_profile: hasProfiles && r.items.profiles ? {
          display_name: r.items.profiles.display_name,
          avatar_url: r.items.profiles.avatar_url,
          completed_exchanges: r.items.profiles.completed_exchanges,
          total_exchanges: r.items.profiles.total_exchanges,
          id_verified: r.items.profiles.id_verified,
          is_premium: r.items.profiles.is_premium,
          points: r.items.profiles.points,
          suburb: r.items.profiles.suburb,
        } : null,
        giver_confirmed_at: r.giver_confirmed_at,
        receiver_confirmed_at: r.receiver_confirmed_at,
        giver_id: r.giver_id,
        receiver_id: r.receiver_id,
      }
    })
}
