import { supabase } from './supabase'

export const REPORT_CATEGORIES = [
  'Inappropriate behaviour', 'Harassment', 'No-show', 'Suspicious activity',
  'Underage user', 'Inappropriate photo', 'Scam or money request', 'Other',
]

export async function submitReport(report: {
  reporter_id: string
  reported_user_id: string
  category: string
  details?: string
  item_id?: string
  conversation_id?: string
}) {
  const { data, error } = await supabase
    .from('reports')
    .insert(report)
    .select()
    .single()
  if (error) throw error
  return data
}
