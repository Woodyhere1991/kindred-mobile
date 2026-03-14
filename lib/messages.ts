import { supabase } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { compressImage } from './imageUtils'

export interface Conversation {
  id: string
  match_id: string | null
  item_id: string
  user_id: string
  other_user_id: string
  blocked_by: string | null
  last_message: string | null
  last_message_at: string | null
  created_at: string
  // Joined fields
  other_user?: {
    display_name: string
    avatar_url: string | null
    id_verified: boolean
    completed_exchanges: number
    total_exchanges: number
    is_premium: boolean
    points: number
    suburb: string | null
  }
  item?: {
    title: string
    item_photos?: { public_url: string; position: number }[]
  }
  unread_count?: number
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  image_url: string | null
  scam_flagged: boolean
  read_at: string | null
  created_at: string
}

const SCAM_WORDS = ['pay first', 'bank transfer', 'send money', 'western union', 'gift card', 'crypto', 'bitcoin', 'paypal']

/** Fetch all conversations for the current user */
export async function getConversations(userId: string) {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      other_user:profiles!conversations_other_user_id_fkey(display_name, avatar_url, id_verified, completed_exchanges, total_exchanges, is_premium, points, suburb),
      item:items!conversations_item_id_fkey(title, item_photos(public_url, position))
    `)
    .or(`user_id.eq.${userId},other_user_id.eq.${userId}`)
    .neq('archived', true)
    .order('last_message_at', { ascending: false, nullsFirst: false })
  if (error) throw error

  // Batch unread counts in a single query instead of N+1
  const convIds = (data || []).map((c: any) => c.id)
  const unreadMap: Record<string, number> = {}
  if (convIds.length > 0) {
    const { data: unreadRows } = await supabase
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', convIds)
      .neq('sender_id', userId)
      .is('read_at', null)
    for (const row of unreadRows || []) {
      unreadMap[row.conversation_id] = (unreadMap[row.conversation_id] || 0) + 1
    }
  }

  return (data || []).map((conv: any) => ({ ...conv, unread_count: unreadMap[conv.id] ?? 0 })) as Conversation[]
}

/** Fetch messages for a conversation */
export async function getMessages(conversationId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as Message[]
}

/** Send a message directly */
export async function sendMessage(conversationId: string, senderId: string, content: string, imageUrl?: string) {
  const scamFlagged = SCAM_WORDS.some(w => content.toLowerCase().includes(w))

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      image_url: imageUrl || null,
      scam_flagged: scamFlagged,
    })
    .select()
    .single()
  if (error) throw error

  // Update conversation's last message
  await supabase
    .from('conversations')
    .update({
      last_message: imageUrl ? (content || '📷 Photo') : content,
      last_message_at: new Date().toISOString(),
    })
    .eq('id', conversationId)

  return data as Message
}

/** Upload a chat photo and return the public URL */
export async function uploadChatPhoto(senderId: string, conversationId: string, uri: string): Promise<string> {
  const filename = `${senderId}/${conversationId}/${Date.now()}.jpg`
  const compressed = await compressImage(uri)
  const response = await fetch(compressed)
  const blob = await response.blob()

  const { error: uploadError } = await supabase.storage
    .from('chat-photos')
    .upload(filename, blob, { contentType: 'image/jpeg', upsert: true })
  if (uploadError) throw uploadError

  const { data: { publicUrl } } = supabase.storage
    .from('chat-photos')
    .getPublicUrl(filename)

  return publicUrl
}

/** Create a new conversation */
export async function createConversation(
  userId: string,
  otherUserId: string,
  itemId: string,
  matchId?: string,
) {
  // Check if conversation already exists for this item between these users
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('item_id', itemId)
    .or(`and(user_id.eq.${userId},other_user_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},other_user_id.eq.${userId})`)
    .limit(1)

  if (existing && existing.length > 0) return existing[0] as Conversation

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: userId,
      other_user_id: otherUserId,
      item_id: itemId,
      match_id: matchId ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data as Conversation
}

/** Subscribe to new messages in a conversation (real-time) */
export function subscribeToMessages(
  conversationId: string,
  onMessage: (message: Message) => void,
): RealtimeChannel {
  return supabase
    .channel(`messages:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`,
    }, (payload) => {
      onMessage(payload.new as Message)
    })
    .subscribe()
}

/** Mark messages as read */
export async function markRead(conversationId: string, userId: string) {
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .is('read_at', null)
  if (error) throw error
}

/** Block a user in a conversation */
export async function blockUserInConversation(conversationId: string, userId: string) {
  const { error } = await supabase
    .from('conversations')
    .update({ blocked_by: userId })
    .eq('id', conversationId)
  if (error) throw error
}

/** Check if message content contains scam words */
export function isScamMessage(content: string): boolean {
  return SCAM_WORDS.some(w => content.toLowerCase().includes(w))
}
