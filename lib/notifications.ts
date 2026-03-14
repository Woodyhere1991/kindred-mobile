import { supabase } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface Notification {
  id: string
  user_id: string
  type: 'match' | 'claimed' | 'arranged' | 'message' | 'points' | 'reminder' | 'system'
  title: string
  body: string | null
  item_id: string | null
  match_id: string | null
  read_at: string | null
  created_at: string
}

/** Fetch notifications for the current user */
export async function getNotifications(userId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data as Notification[]
}

/** Count unread notifications */
export async function getUnreadCount(userId: string) {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)
  if (error) throw error
  return count ?? 0
}

/** Mark a notification as read */
export async function markNotificationRead(notificationId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
  if (error) throw error
}

/** Mark all notifications as read */
export async function markAllRead(userId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
  if (error) throw error
}

/** Create a notification */
export async function createNotification(notification: {
  user_id: string
  type: Notification['type']
  title: string
  body: string
  item_id?: string
  match_id?: string
}) {
  const { error } = await supabase
    .from('notifications')
    .insert(notification)
  if (error) throw error
}

/** Subscribe to new notifications (real-time) */
export function subscribeToNotifications(
  userId: string,
  onNotification: (notification: Notification) => void,
): RealtimeChannel {
  return supabase
    .channel(`notifications:${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      onNotification(payload.new as Notification)
    })
    .subscribe()
}
