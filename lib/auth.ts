import { supabase } from './supabase'

// Email/Password Sign Up
export async function signUp(
  email: string,
  password: string,
  metadata?: { display_name?: string; dob?: string; suburb?: string; phone?: string; lat?: number; lng?: number },
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: metadata ? { data: metadata } : undefined,
  })
  if (error) throw error
  return data
}

// Email/Password Sign In
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

// Sign Out
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// Phone OTP
export async function sendPhoneOtp(phone: string) {
  const { data, error } = await supabase.auth.signInWithOtp({ phone })
  if (error) throw error
  return data
}

export async function verifyPhoneOtp(phone: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
  if (error) throw error
  return data
}

// Get current session
export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

// Create user profile
export async function createUserProfile(userId: string, profile: {
  display_name: string
  dob: string
  suburb: string
  address_encrypted?: string
  lat?: number
  lng?: number
}) {
  const { error } = await supabase.from('profiles').insert({
    id: userId,
    ...profile,
  })
  if (error) throw error
}
