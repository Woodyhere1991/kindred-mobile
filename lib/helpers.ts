import { supabase } from './supabase'

export interface HelperRequest {
  id: number
  item_id: number
  requester_id: string
  helper_id: string | null
  status: 'open' | 'accepted' | 'completed' | 'cancelled'
  conversation_id: number | null
  note: string | null
  created_at: string
  updated_at: string
  // Joined
  items?: { title: string; type: string; suburb: string | null; lat: number | null; lng: number | null }
  requester?: { display_name: string }
}

/** Create a helper request for a large item */
export async function createHelperRequest(itemId: number, requesterId: string, note?: string) {
  const { data, error } = await supabase
    .from('helper_requests')
    .insert({ item_id: itemId, requester_id: requesterId, note: note || null })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Get open helper requests near the user */
export async function getOpenHelperRequests(suburb: string) {
  const { data, error } = await supabase
    .from('helper_requests')
    .select('*, items!helper_requests_item_id_fkey(title, type, suburb, lat, lng), profiles!helper_requests_requester_id_fkey(display_name)')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  // Filter by suburb (simple approach)
  return (data as unknown as HelperRequest[]).filter(r => r.items?.suburb === suburb)
}

/** Volunteer to help with a request */
export async function volunteerToHelp(requestId: number, helperId: string) {
  const { error } = await supabase
    .from('helper_requests')
    .update({ helper_id: helperId, status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('status', 'open')
  if (error) throw error
}

/** Mark a helper request as completed + award KP */
export async function completeHelperRequest(requestId: number, helperId: string) {
  const { error } = await supabase
    .from('helper_requests')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', requestId)
  if (error) throw error

  // Check if helper is a Plus member for 2x bonus
  const { data: prof } = await supabase.from('profiles').select('is_premium, mover_count').eq('id', helperId).single()
  const helperIsPremium = prof?.is_premium ?? false
  const moveKP = helperIsPremium ? 100 : 50

  // Award KP to helper (50, or 100 for Plus members)
  const { error: pointsErr } = await supabase.rpc('award_completion_points', {
    user_uuid: helperId,
    points_to_add: moveKP,
  })
  if (pointsErr) throw pointsErr

  // Log to points feed
  await supabase.from('points_log').insert({
    user_id: helperId,
    action: `for helping move a large item${helperIsPremium ? ' (2x Plus bonus)' : ''}`,
    points: moveKP,
  })

  // Increment mover_count for "Mover" badge tracking
  if (prof) {
    await supabase.from('profiles').update({ mover_count: (prof.mover_count || 0) + 1 }).eq('id', helperId)
  }
}

/** Get helper request for a specific item */
export async function getHelperRequestForItem(itemId: number | string) {
  const { data, error } = await supabase
    .from('helper_requests')
    .select('*, profiles!helper_requests_helper_id_fkey(display_name)')
    .eq('item_id', itemId)
    .in('status', ['open', 'accepted'])
    .maybeSingle()
  if (error) throw error
  return data as HelperRequest | null
}
