import { supabase } from './supabase'
import { compressImage } from './imageUtils'

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

  // Check auth state before uploading
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated - please sign in again')

  const compressed = await compressImage(uri)
  const response = await fetch(compressed)
  const blob = await response.blob()

  const { error } = await supabase.storage
    .from('id-verifications')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (error) throw new Error(`Storage upload error: ${error.message} (statusCode: ${(error as any).statusCode})`)

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
  let idPhotoPath: string
  let selfiePath: string
  try {
    idPhotoPath = await uploadVerificationPhoto(userId, `id_${Date.now()}.jpg`, idPhotoUri)
  } catch (err: any) {
    throw new Error(`ID photo upload failed: ${err.message || err}`)
  }
  try {
    selfiePath = await uploadVerificationPhoto(userId, `selfie_${Date.now()}.jpg`, selfieUri)
  } catch (err: any) {
    throw new Error(`Selfie upload failed: ${err.message || err}`)
  }

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
  if (error) throw new Error(`Verification record failed: ${error.message}`)

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

/** Admin: approve a verification (uses SECURITY DEFINER RPC to bypass RLS) */
export async function approveVerification(verificationId: string, adminId: string) {
  const { error } = await supabase.rpc('admin_approve_verification', {
    verification_uuid: verificationId,
    admin_uuid: adminId,
  })
  if (error) throw error
}

/** Admin: reject a verification (uses SECURITY DEFINER RPC to bypass RLS) */
export async function rejectVerification(verificationId: string, adminId: string, reason?: string) {
  const { error } = await supabase.rpc('admin_reject_verification', {
    verification_uuid: verificationId,
    admin_uuid: adminId,
    reject_reason: reason || null,
  })
  if (error) throw error
}
