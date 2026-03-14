import { supabase } from './supabase'

export interface Qualification {
  id: number
  user_id: string
  title: string
  category: 'trade' | 'professional' | 'first_aid' | 'licence' | 'reference' | 'other'
  document_path: string
  status: 'pending' | 'verified' | 'rejected'
  reviewed_by: string | null
  rejection_reason: string | null
  created_at: string
}

export const QUAL_CATEGORIES = [
  { id: 'trade', label: 'Trade Certificate', icon: '🔧', desc: 'Builder, electrician, plumber, etc.' },
  { id: 'professional', label: 'Professional', icon: '📋', desc: 'Engineering, teaching, nursing, etc.' },
  { id: 'first_aid', label: 'First Aid', icon: '🩹', desc: 'First aid certificate' },
  { id: 'licence', label: 'Licence', icon: '🪪', desc: 'Driver licence, forklift, etc.' },
  { id: 'reference', label: 'Reference', icon: '📝', desc: 'Written reference or testimonial' },
  { id: 'other', label: 'Other', icon: '📎', desc: 'Any other qualification' },
] as const

/** Upload a qualification document photo */
async function uploadQualDoc(userId: string, photoUri: string): Promise<string> {
  const path = `${userId}/${Date.now()}.jpg`
  const response = await fetch(photoUri)
  const blob = await response.blob()

  const { error } = await supabase.storage
    .from('qualifications')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (error) throw error
  return path
}

/** Submit a new qualification for review */
export async function submitQualification(userId: string, title: string, category: string, photoUri: string) {
  const docPath = await uploadQualDoc(userId, photoUri)

  const { data, error } = await supabase
    .from('qualifications')
    .insert({
      user_id: userId,
      title,
      category,
      document_path: docPath,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Get user's qualifications */
export async function getMyQualifications(userId: string): Promise<Qualification[]> {
  const { data, error } = await supabase
    .from('qualifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Qualification[]
}

/** Get verified qualifications for a user (public view) */
export async function getVerifiedQualifications(userId: string): Promise<Qualification[]> {
  const { data, error } = await supabase
    .from('qualifications')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'verified')
  if (error) throw error
  return data as Qualification[]
}

/** Admin: get pending qualifications */
export async function getPendingQualifications() {
  const { data, error } = await supabase
    .from('qualifications')
    .select('*, profiles!qualifications_user_id_fkey(display_name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as (Qualification & { profiles: { display_name: string } })[]
}

/** Admin: get signed URL for document */
export async function getQualDocUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('qualifications')
    .createSignedUrl(path, 300) // 5 min
  if (error) throw error
  return data.signedUrl
}

/** Admin: approve a qualification */
export async function approveQualification(qualId: number, adminId: string) {
  const { data: qual, error: fetchErr } = await supabase
    .from('qualifications')
    .update({
      status: 'verified',
      reviewed_by: adminId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', qualId)
    .select()
    .single()
  if (fetchErr) throw fetchErr
}

/** Admin: reject a qualification */
export async function rejectQualification(qualId: number, adminId: string, reason?: string) {
  const { error } = await supabase
    .from('qualifications')
    .update({
      status: 'rejected',
      reviewed_by: adminId,
      rejection_reason: reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', qualId)
  if (error) throw error
}
