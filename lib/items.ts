import { supabase } from './supabase'
import type { Category } from '../constants/theme'
import { getBoundingBox, getDistanceKm } from './location'
import { compressImage } from './imageUtils'

export interface Item {
  id: string
  user_id: string
  type: 'give' | 'need'
  title: string
  category: Category
  status: 'listed' | 'matched' | 'arranged' | 'ready' | 'completed' | 'cancelled'
  note: string | null
  urgency: 'whenever' | 'soon' | 'urgent' | null
  available_until: string | null
  food_expiry: string | null
  is_large_item: boolean
  needs_mover: boolean
  offer_in_return: string | null
  other_person_id: string | null
  handover_type: string | null
  drop_point: string | null
  drop_time: string | null
  match_expiry: string | null
  suburb: string
  lat: number | null
  lng: number | null
  created_at: string
  hold_mode: 'first_come' | 'happy_to_hold'
  updated_at: string
  item_photos?: ItemPhoto[]
}

export interface ItemPhoto {
  id: string
  item_id: string
  storage_path: string
  public_url: string
  position: number
}

/** Fetch the current user's items */
export async function getMyItems(userId: string) {
  const { data, error } = await supabase
    .from('items')
    .select('*, item_photos(*)')
    .eq('user_id', userId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Item[]
}

export interface BrowseItem extends Item {
  distance?: number
  profiles: {
    display_name: string
    completed_exchanges: number
    total_exchanges: number
    id_verified: boolean
    is_premium: boolean
    avatar_url: string | null
    mover_count: number
    points: number
    suburb: string | null
  }
}

/** Browse items from other users nearby */
export async function browseItems(options: {
  suburb: string
  lat?: number | null
  lng?: number | null
  radiusKm?: number
  category?: Category
  search?: string
  type?: 'give' | 'need'
  userId?: string
}) {
  const { suburb, lat, lng, radiusKm = 5, category, search, type, userId } = options
  const selectStr = '*, item_photos(*), profiles!items_user_id_profiles_fkey(display_name, completed_exchanges, total_exchanges, id_verified, is_premium, avatar_url, mover_count, points, suburb)'

  let query = supabase
    .from('items')
    .select(selectStr)
    .eq('status', 'listed')

  if (userId) {
    query = query.neq('user_id', userId)
  }

  if (lat && lng) {
    // Bounding box query for items with coords, plus suburb fallback for items without coords
    const box = getBoundingBox(lat, lng, radiusKm)
    query = query.or(
      `and(lat.gte.${box.minLat},lat.lte.${box.maxLat},lng.gte.${box.minLng},lng.lte.${box.maxLng}),and(lat.is.null,suburb.eq.${suburb})`
    )
  } else {
    // No GPS — fall back to suburb match
    query = query.eq('suburb', suburb)
  }

  if (category) {
    query = query.eq('category', category)
  }

  if (type) {
    query = query.eq('type', type)
  }

  if (search) {
    query = query.ilike('title', `%${search}%`)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error

  let items = data as BrowseItem[]

  // Calculate distance and sort by nearest
  if (lat && lng) {
    items = items.map(item => ({
      ...item,
      distance: item.lat && item.lng ? getDistanceKm(lat, lng, item.lat, item.lng) : undefined,
    }))
    // Filter out items beyond exact radius (bounding box is a square)
    items = items.filter(item => !item.distance || item.distance <= radiusKm)
    // Sort: items with distance first (nearest), then items without coords
    items.sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999))
  }

  return items
}

/** Find complementary items nearby (give↔need smart matching) */
/** Extract size and detail keywords from title + note for smarter matching */
function extractKeywords(title: string, note?: string | null): string[] {
  const text = `${title} ${note || ''}`.toLowerCase()
  // Size patterns: "size 12", "sz 10", "M", "XL", "12mo", etc.
  const sizePatterns = text.match(/\b(xx?[sl]|[sl]|[0-9]+\s*(mo|months?)?|size\s*[0-9]+|sz\s*[0-9]+)\b/gi) || []
  // Meaningful words (3+ chars, skip common filler)
  const filler = new Set(['the', 'and', 'for', 'has', 'with', 'that', 'this', 'from', 'some', 'any', 'good', 'great', 'like', 'just', 'very', 'been', 'have', 'will', 'please', 'thanks', 'still', 'also', 'need', 'give', 'item', 'condition', 'used', 'free'])
  const words = text.split(/\s+/).filter(w => w.length >= 3 && !filler.has(w))
  return [...new Set([...sizePatterns.map(s => s.toLowerCase().replace(/\s+/g, '')), ...words])]
}

export async function findSmartMatches(item: {
  id: string
  type: 'give' | 'need'
  title: string
  note?: string | null
  category: string
  suburb: string
  lat?: number | null
  lng?: number | null
  user_id: string
}): Promise<BrowseItem[]> {
  if (!item.suburb) return []
  const oppositeType = item.type === 'give' ? 'need' : 'give'
  const selectStr = '*, item_photos(*), profiles!items_user_id_profiles_fkey(display_name, completed_exchanges, total_exchanges, id_verified, is_premium, avatar_url, mover_count, points, suburb)'

  let query = supabase
    .from('items')
    .select(selectStr)
    .eq('status', 'listed')
    .eq('type', oppositeType)
    .neq('user_id', item.user_id)

  // Match by category first, then by proximity
  if (item.lat && item.lng) {
    const box = getBoundingBox(item.lat, item.lng, 10) // 10km radius
    query = query.or(
      `and(lat.gte.${box.minLat},lat.lte.${box.maxLat},lng.gte.${box.minLng},lng.lte.${box.maxLng}),and(lat.is.null,suburb.eq.${item.suburb})`
    )
  } else {
    query = query.eq('suburb', item.suburb)
  }

  // Prefer same category
  query = query.eq('category', item.category)

  // Fetch more candidates so we can rank by keyword relevance
  const { data, error } = await query.order('created_at', { ascending: false }).limit(20)
  if (error) throw error

  let matches = (data as BrowseItem[]) || []

  // Score by keyword overlap (title + note)
  const myKeywords = extractKeywords(item.title, item.note)
  if (myKeywords.length > 0) {
    matches = matches.map(m => {
      const theirKeywords = extractKeywords(m.title, m.note)
      const overlap = myKeywords.filter(k => theirKeywords.includes(k)).length
      return { ...m, _keywordScore: overlap }
    })
  }

  // Calculate distances
  if (item.lat && item.lng) {
    matches = matches.map(m => ({
      ...m,
      distance: m.lat && m.lng ? getDistanceKm(item.lat!, item.lng!, m.lat, m.lng) : undefined,
    }))
  }

  // Sort: keyword matches first, then by distance
  matches.sort((a, b) => {
    const scoreA = (a as any)._keywordScore ?? 0
    const scoreB = (b as any)._keywordScore ?? 0
    if (scoreB !== scoreA) return scoreB - scoreA
    return (a.distance ?? 999) - (b.distance ?? 999)
  })

  // Return top 5
  matches = matches.slice(0, 5)

  // If no same-category matches, try title-based search across all categories
  if (matches.length === 0) {
    const words = item.title.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    if (words.length > 0) {
      let fallbackQuery = supabase
        .from('items')
        .select(selectStr)
        .eq('status', 'listed')
        .eq('type', oppositeType)
        .neq('user_id', item.user_id)

      if (item.lat && item.lng) {
        const box = getBoundingBox(item.lat, item.lng, 10)
        fallbackQuery = fallbackQuery.or(
          `and(lat.gte.${box.minLat},lat.lte.${box.maxLat},lng.gte.${box.minLng},lng.lte.${box.maxLng}),and(lat.is.null,suburb.eq.${item.suburb})`
        )
      } else {
        fallbackQuery = fallbackQuery.eq('suburb', item.suburb)
      }

      fallbackQuery = fallbackQuery.ilike('title', `%${words[0]}%`)

      const { data: fbData } = await fallbackQuery.order('created_at', { ascending: false }).limit(5)
      if (fbData) {
        matches = fbData as BrowseItem[]
        if (item.lat && item.lng) {
          matches = matches.map(m => ({
            ...m,
            distance: m.lat && m.lng ? getDistanceKm(item.lat!, item.lng!, m.lat, m.lng) : undefined,
          }))
        }
      }
    }
  }

  return matches
}

/** Create a new listing */
export async function createItem(item: {
  user_id: string
  type: 'give' | 'need'
  title: string
  category: Category
  note?: string
  urgency?: string
  available_until?: string
  food_expiry?: string
  is_large_item?: boolean
  needs_mover?: boolean
  offer_in_return?: string
  hold_mode?: 'first_come' | 'happy_to_hold'
  suburb: string
  lat?: number
  lng?: number
}) {
  const { data, error } = await supabase
    .from('items')
    .insert(item)
    .select()
    .single()
  if (error) throw error
  return data as Item
}

/** Upload a photo for an item */
export async function uploadItemPhoto(
  userId: string,
  itemId: string,
  uri: string,
  position: number,
) {
  const filename = `${userId}/${itemId}/${position}.jpg`
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
    .from('item_photos')
    .insert({ item_id: itemId, storage_path: filename, public_url: publicUrl, position })
  if (insertError) throw insertError

  return publicUrl
}

/** Update item status */
export async function updateItemStatus(itemId: string, status: Item['status']) {
  const { error } = await supabase
    .from('items')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', itemId)
  if (error) throw error
}

/** Update item fields (handover, drop point, etc.) */
export async function updateItem(itemId: string, updates: Partial<Item>) {
  const { error } = await supabase
    .from('items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', itemId)
  if (error) throw error
}

export interface FeedItem extends BrowseItem {
  feedType: 'new_listing' | 'matched' | 'completed'
}

export interface PointsLogEntry {
  id: string
  title: string
  type: 'give' | 'need'
  status: string
  user_id: string
  display_name: string
  points: number
  action: string
  updated_at: string
}

/** Get points activity log — reads from persistent points_log table */
export async function getPointsLog(options: {
  suburb: string
  lat?: number | null
  lng?: number | null
  radiusKm?: number
  currentUserId?: string
}) {
  const { suburb, lat, lng, radiusKm = 10, currentUserId } = options

  // Query the persistent points_log table joined with profiles for display_name and location
  const { data, error } = await supabase
    .from('points_log')
    .select('id, user_id, item_id, item_title, item_type, action, points, created_at, profiles!points_log_user_id_fkey(display_name, suburb, lat, lng)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error

  type Row = {
    id: number; user_id: string; item_id: string | null; item_title: string | null
    item_type: string | null; action: string; points: number; created_at: string
    profiles: { display_name: string; suburb: string | null; lat: number | null; lng: number | null }
  }

  const rows = data as unknown as Row[]

  // Filter by location
  const filtered = rows.filter(row => {
    const p = row.profiles
    if (!p) return false
    if (lat && lng && p.lat && p.lng) {
      const box = getBoundingBox(lat, lng, radiusKm)
      return p.lat >= box.minLat && p.lat <= box.maxLat && p.lng >= box.minLng && p.lng <= box.maxLng
    }
    return p.suburb === suburb
  })

  return filtered.map(row => {
    const isOwn = row.user_id === currentUserId
    const name = isOwn ? 'You' : (row.profiles?.display_name || 'Someone')
    return {
      id: String(row.id),
      title: row.item_title || '',
      type: (row.item_type || 'give') as 'give' | 'need',
      status: row.points >= 25 ? 'completed' : 'listed',
      user_id: row.user_id,
      display_name: name,
      points: row.points,
      action: row.action,
      updated_at: row.created_at,
    } as PointsLogEntry
  })
}

export interface ExchangeReceipt {
  id: string
  item_id: string | null
  item_title: string
  item_type: 'give' | 'need'
  category: string | null
  giver_id: string
  receiver_id: string
  giver_name: string
  receiver_name: string
  rating: number | null
  points_earned: number
  proximity_verified: boolean
  proximity_distance_m: number | null
  completed_at: string
}

/** Get all exchange receipts for a user (both as giver and receiver) */
export async function getExchangeReceipts(userId: string): Promise<ExchangeReceipt[]> {
  const { data, error } = await supabase
    .from('exchange_receipts')
    .select('*')
    .or(`giver_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('completed_at', { ascending: false })
  if (error) throw error
  return (data || []) as ExchangeReceipt[]
}

/** Auto-detect category from item title */
export function autoCategory(text: string): Category {
  const l = text.toLowerCase()
  if (['couch', 'sofa', 'table', 'fridge', 'bed', 'desk', 'wardrobe', 'chair', 'shelf', 'drawers'].some(w => l.includes(w))) return 'furniture'
  if (['food', 'veges', 'eggs', 'bread', 'tins', 'beans', 'rice', 'milk', 'fruit', 'meat', 'frozen', 'soup'].some(w => l.includes(w))) return 'food'
  if (['jacket', 'coat', 'clothes', 'shoes', 'pants', 'shirt', 'dress', 'hoodie', 'jersey'].some(w => l.includes(w))) return 'clothing'
  if (['nappy', 'pram', 'baby', 'formula', 'cot', 'car seat', 'nappies', 'bottles'].some(w => l.includes(w))) return 'baby'
  if (['mow', 'lawn', 'fix', 'repair', 'paint', 'teach', 'drive', 'moving', 'clean', 'build', 'plumb'].some(w => l.includes(w))) return 'service'
  if (['kettle', 'toaster', 'vacuum', 'heater', 'iron', 'microwave', 'blender'].some(w => l.includes(w))) return 'household'
  return 'other'
}
