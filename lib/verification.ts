import { supabase } from './supabase'

export interface IdVerification {
  id: string
  user_id: string
  document_type: string
  id_photo_path: string
  selfie_path: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
  profiles?: {
    display_name: string
    avatar_url: string | null
  }
}

/** Upload a verification photo to private storage */
async function uploadVerificationPhoto(
  userId: string,
  filename: string,
  uri: string,
): Promise<string> {
  const path = `${userId}/${filename}`
  const response = await fetch(uri)
  const blob = await response.blob()

  const { error } = await supabase.storage
    .from('id-verifications')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (error) throw error

  return path
}

/** Submit ID verification with both ID photo and live selfie */
export async function submitVerification(
  userId: string,
  documentType: string,
  idPhotoUri: string,
  selfieUri: string,
) {
  // Upload both photos
  const idPhotoPath = await uploadVerificationPhoto(userId, `id_${Date.now()}.jpg`, idPhotoUri)
  const selfiePath = await uploadVerificationPhoto(userId, `selfie_${Date.now()}.jpg`, selfieUri)

  // Create verification record
  const { data, error } = await supabase
    .from('id_verifications')
    .insert({
      user_id: userId,
      document_type: documentType,
      id_photo_path: idPhotoPath,
      selfie_path: selfiePath,
    })
    .select()
    .single()
  if (error) throw error

  return data as IdVerification
}

/** Get the current user's latest verification status */
export async function getMyVerification(userId: string) {
  const { data, error } = await supabase
    .from('id_verifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as IdVerification | null
}

/** Admin: get all pending verifications */
export async function getPendingVerifications() {
  const { data, error } = await supabase
    .from('id_verifications')
    .select('*, profiles!id_verifications_user_id_profiles_fkey(display_name, avatar_url)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as unknown as IdVerification[]
}

/** Admin: get a signed URL to view a private verification photo */
export async function getSignedUrl(path: string) {
  const { data, error } = await supabase.storage
    .from('id-verifications')
    .createSignedUrl(path, 300) // 5 min expiry
  if (error) throw error
  return data.signedUrl
}

/** Admin: approve a verification */
export async function approveVerification(verificationId: string, adminId: string) {
  // Get the verification to find user_id
  const { data: verification, error: fetchErr } = await supabase
    .from('id_verifications')
    .select('user_id')
    .eq('id', verificationId)
    .single()
  if (fetchErr) throw fetchErr

  // Update verification status
  const { error: updateErr } = await supabase
    .from('id_verifications')
    .update({ status: 'approved', reviewed_by: adminId, updated_at: new Date().toISOString() })
    .eq('id', verificationId)
  if (updateErr) throw updateErr

  // Set user as verified
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ id_verified: true, updated_at: new Date().toISOString() })
    .eq('id', verification.user_id)
  if (profileErr) throw profileErr

  // Award KP: 100 base, 200 for Plus members
  const { data: userProfile } = await supabase.from('profiles').select('is_premium').eq('id', verification.user_id).single()
  const verifyKP = userProfile?.is_premium ? 200 : 100
  const { error: pointsErr } = await supabase.rpc('award_completion_points', {
    user_uuid: verification.user_id,
    points_to_add: verifyKP,
  })
  if (pointsErr) throw pointsErr

  // Log to persistent points feed
  await supabase.from('points_log').insert({
    user_id: verification.user_id,
    action: `for completing ID verification${userProfile?.is_premium ? ' (2x Plus bonus)' : ''}`,
    points: verifyKP,
  })
}

/** Admin: reject a verification */
export async function rejectVerification(verificationId: string, adminId: string, reason?: string) {
  const { error } = await supabase
    .from('id_verifications')
    .update({
      status: 'rejected',
      reviewed_by: adminId,
      rejection_reason: reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', verificationId)
  if (error) throw error
}
