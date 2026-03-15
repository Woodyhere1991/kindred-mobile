import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { router, Link, useLocalSearchParams } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { Colors, Radius } from '../../constants/theme'
import { signUp, sendPhoneOtp, verifyPhoneOtp } from '../../lib/auth'
import { useApp } from '../../lib/appContext'
import { supabase } from '../../lib/supabase'
import { searchAddresses, getAddressCoords, AddySuggestion } from '../../lib/addressAutocomplete'
import { containsProfanity } from '../../lib/profanityFilter'

export default function OnboardingScreen() {
  const { setIsAuthenticated, setOnboardingInProgress } = useApp()
  const { prefillEmail, prefillPassword } = useLocalSearchParams<{ prefillEmail?: string; prefillPassword?: string }>()
  const [step, setStep] = useState(0)

  // Google auth state
  const [isGoogleFlow, setIsGoogleFlow] = useState(false)

  // Step 0 fields (auth method)
  const [email, setEmail] = useState(prefillEmail || '')
  const [password, setPassword] = useState(prefillPassword || '')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Step 1 fields (details)
  const [name, setName] = useState('')
  const [dob, setDob] = useState('')
  const [suburb, setSuburb] = useState('')
  const [homeLat, setHomeLat] = useState<number | null>(null)
  const [homeLng, setHomeLng] = useState<number | null>(null)
  const [homeAddress, setHomeAddress] = useState('')
  const [addressSuggestions, setAddressSuggestions] = useState<AddySuggestion[]>([])
  const [addressDebounce, setAddressDebounce] = useState<ReturnType<typeof setTimeout> | null>(null)

  // Auto-format DOB: insert slashes as user types digits
  const handleDobChange = (text: string) => {
    // Strip everything except digits
    const digits = text.replace(/\D/g, '').slice(0, 8)
    let formatted = ''
    if (digits.length <= 2) {
      formatted = digits
    } else if (digits.length <= 4) {
      formatted = digits.slice(0, 2) + '/' + digits.slice(2)
    } else {
      formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4)
    }
    setDob(formatted)
  }

  // Step 2 fields (phone + terms)
  const [phone, setPhone] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedDisclaimer, setAcceptedDisclaimer] = useState(false)

  // Phone OTP verification
  const [phoneOtpSent, setPhoneOtpSent] = useState(false)
  const [phoneOtpCode, setPhoneOtpCode] = useState('')
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [phoneSending, setPhoneSending] = useState(false)
  const [phoneVerifying, setPhoneVerifying] = useState(false)
  const [phoneError, setPhoneError] = useState('')

  const [loading, setLoading] = useState(false)
  const [signUpMsg, setSignUpMsg] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)

  // --- Validation ---

  // DOB validation
  const parseDob = (d: string) => {
    const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!m) return null
    const [, dd, mm, yyyy] = m
    const date = new Date(+yyyy, +mm - 1, +dd)
    if (date.getDate() !== +dd || date.getMonth() !== +mm - 1) return null
    return date
  }
  const dobDate = parseDob(dob)
  const isOver18 = (() => {
    if (!dobDate) return false
    const today = new Date()
    const age = today.getFullYear() - dobDate.getFullYear()
    const monthDiff = today.getMonth() - dobDate.getMonth()
    return age > 18 || (age === 18 && (monthDiff > 0 || (monthDiff === 0 && today.getDate() >= dobDate.getDate())))
  })()
  const dobError = dob.length > 0 && !dobDate ? 'Use DD/MM/YYYY format' : dob.length > 0 && !isOver18 ? 'You must be 18 or older' : ''

  // Phone validation
  const phoneValid = phone.length === 0 || /^(\+?64|0)\d{7,10}$/.test(phone.replace(/[\s\-]/g, ''))

  // Email & password validation
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const hasUppercase = /[A-Z]/.test(password)
  const hasNumber = /\d/.test(password)
  const passwordValid = password.length >= 8 && hasUppercase && hasNumber

  // Step validations
  const isStep0Valid = isGoogleFlow
    ? true
    : emailValid && passwordValid && password === confirmPassword
  const nameHasProfanity = containsProfanity(name)
  const isStep1Valid = name.length >= 2 && !nameHasProfanity && !!dobDate && isOver18
  const isStep2Valid = acceptedTerms && acceptedDisclaimer

  // --- Phone OTP ---

  const handleSendPhoneOtp = async () => {
    if (!phoneValid || phone.length === 0) return
    setPhoneSending(true)
    setPhoneError('')
    try {
      let normalizedPhone = phone.replace(/[\s\-]/g, '')
      if (normalizedPhone.startsWith('0')) {
        normalizedPhone = '+64' + normalizedPhone.slice(1)
      } else if (!normalizedPhone.startsWith('+')) {
        normalizedPhone = '+' + normalizedPhone
      }
      await sendPhoneOtp(normalizedPhone)
      setPhoneOtpSent(true)
    } catch (err: any) {
      setPhoneError(err.message || 'Failed to send code')
    } finally {
      setPhoneSending(false)
    }
  }

  const handleVerifyPhoneOtp = async () => {
    if (phoneOtpCode.length !== 6) return
    setPhoneVerifying(true)
    setPhoneError('')
    try {
      let normalizedPhone = phone.replace(/[\s\-]/g, '')
      if (normalizedPhone.startsWith('0')) {
        normalizedPhone = '+64' + normalizedPhone.slice(1)
      } else if (!normalizedPhone.startsWith('+')) {
        normalizedPhone = '+' + normalizedPhone
      }
      await verifyPhoneOtp(normalizedPhone, phoneOtpCode)
      setPhoneVerified(true)
    } catch (err: any) {
      setPhoneError(err.message || 'Invalid code')
    } finally {
      setPhoneVerifying(false)
    }
  }

  // --- Google Sign Up ---

  const prefillFromGoogle = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const meta = user.user_metadata
      if (meta?.full_name || meta?.name) setName(meta.full_name || meta.name)
      if (user.email) setEmail(user.email)
    }
  }

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true)
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          localStorage.setItem('kindred_google_onboarding', 'true')
        }
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin + '/onboarding' },
        })
        if (error) throw error
        return
      }
      const redirectUri = 'kindred://oauth'
      const { data } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUri, skipBrowserRedirect: true },
      })
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri)
        if (result.type === 'success') {
          const codeParam = new URL(result.url).searchParams.get('code')
          if (codeParam) {
            // Set BEFORE session exchange so AuthGuard doesn't redirect during the gap
            setOnboardingInProgress(true)
            const { error } = await supabase.auth.exchangeCodeForSession(codeParam)
            if (!error) {
              await prefillFromGoogle()
              setIsGoogleFlow(true)
              setStep(1)
            } else {
              setOnboardingInProgress(false)
              setSignUpMsg(error.message)
            }
          }
        }
      }
    } catch (err: any) {
      setSignUpMsg(err.message || 'Google sign up failed.')
    } finally {
      setGoogleLoading(false)
    }
  }

  // Check if returning from Google OAuth on web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const wasGoogleOnboarding = localStorage.getItem('kindred_google_onboarding')
      if (wasGoogleOnboarding) {
        localStorage.removeItem('kindred_google_onboarding')
        // Set immediately so AuthGuard doesn't redirect before session check completes
        setOnboardingInProgress(true)
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            prefillFromGoogle()
            setIsGoogleFlow(true)
            setStep(1)
          } else {
            setOnboardingInProgress(false)
          }
        })
      }
    }
  }, [])

  // --- Final Sign Up ---

  const handleSignUp = async () => {
    setLoading(true)
    setSignUpMsg('')
    try {
      if (isGoogleFlow) {
        // Google flow: already authenticated, just upsert profile
        if (__DEV__) console.log('[Signup] Google flow — updating profile')
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase.from('profiles').upsert({
            id: user.id,
            display_name: name || user.user_metadata?.full_name || null,
            phone: phone || null,
            phone_verified: phoneVerified,
            suburb: suburb || null,
            lat: homeLat,
            lng: homeLng,
            home_address: homeAddress || null,
            dob: dob || null,
            avatar_url: user.user_metadata?.avatar_url || null,
          })
          if (phoneVerified) {
            await supabase.rpc('award_points', { user_uuid: user.id, points_to_add: 50 })
          }
        }

        // Navigate before clearing flag to prevent screen flash
        router.replace('/(tabs)')
        setTimeout(() => setOnboardingInProgress(false), 500)
        return
      }

      // Email flow: create account
      if (__DEV__) console.log('[Signup] Starting signup for:', email)
      const { user, session } = await signUp(email, password, {
        display_name: name,
        dob,
        suburb,
        phone: phone || undefined,
        lat: homeLat ?? undefined,
        lng: homeLng ?? undefined,
        home_address: homeAddress || undefined,
      })
      if (__DEV__) console.log('[Signup] Result:', { userId: user?.id, hasSession: !!session })

      if (!user) {
        setSignUpMsg('Something went wrong. Please try again.')
        return
      }

      // Save phone_verified status and award KP if verified during signup
      if (phoneVerified && user.id) {
        await supabase.from('profiles').upsert({
          id: user.id,
          phone_verified: true,
        })
        await supabase.rpc('award_completion_points', { user_uuid: user.id, points_to_add: 50 })
        await supabase.from('points_log').insert({ user_id: user.id, action: 'for verifying phone', points: 50 })
      }

      if (session) {
        setIsAuthenticated(true)
        if (session.user.email_confirmed_at) {
          router.replace('/(tabs)')
        } else {
          router.replace('/verify-email')
        }
      } else {
        setSignUpMsg('Check your email for a verification link, then sign in.')
        setTimeout(() => router.replace('/(auth)/login'), 3000)
      }
    } catch (err: any) {
      console.error('[Signup] Error:', err.message)
      setSignUpMsg(err.message || 'Sign up failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // --- Render ---

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <Text style={styles.title}>Kindred</Text>
            <Text style={styles.subtitle}>The community app powered by kindness</Text>
          </View>

          {/* Progress dots */}
          <View style={styles.dots}>
            {[0, 1, 2].map(i => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === step && styles.dotActive,
                  i < step && styles.dotDone,
                ]}
              />
            ))}
          </View>

          {/* ===== STEP 0: Auth Method ===== */}
          {step === 0 && (
            <View style={styles.section}>
              <Text style={styles.stepLabel}>STEP 1 OF 3</Text>
              <Text style={styles.stepTitle}>Get Started</Text>
              <Text style={styles.stepDesc}>Choose how to sign up.</Text>

              <TouchableOpacity
                style={[styles.googleBtn, googleLoading && styles.btnDisabled]}
                onPress={handleGoogleSignUp}
                disabled={googleLoading}
              >
                <Text style={styles.googleBtnText}>
                  {googleLoading ? 'Connecting...' : 'Sign Up with Google'}
                </Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or sign up with email</Text>
                <View style={styles.dividerLine} />
              </View>

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor={Colors.greyLight}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="8+ chars, uppercase & number"
                placeholderTextColor={Colors.greyLight}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              {password.length > 0 && (
                <View style={{ gap: 2, marginTop: 4 }}>
                  <Text style={[styles.hint, { color: password.length >= 8 ? '#16A34A' : Colors.red }]}>{password.length >= 8 ? '✓' : '✗'} At least 8 characters</Text>
                  <Text style={[styles.hint, { color: hasUppercase ? '#16A34A' : Colors.red }]}>{hasUppercase ? '✓' : '✗'} Uppercase letter</Text>
                  <Text style={[styles.hint, { color: hasNumber ? '#16A34A' : Colors.red }]}>{hasNumber ? '✓' : '✗'} Number</Text>
                </View>
              )}

              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Confirm your password"
                placeholderTextColor={Colors.greyLight}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <Text style={[styles.hint, { color: Colors.red }]}>Passwords don't match</Text>
              )}
            </View>
          )}

          {/* ===== STEP 1: Your Details ===== */}
          {step === 1 && (
            <View style={styles.section}>
              <Text style={styles.stepLabel}>STEP 2 OF 3</Text>
              <Text style={styles.stepTitle}>Your Details</Text>
              <Text style={styles.stepDesc}>Tell us a bit about you.</Text>

              <Text style={styles.label}>Display Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Your first name"
                placeholderTextColor={Colors.greyLight}
                value={name}
                onChangeText={setName}
                maxLength={30}
              />
              {nameHasProfanity && <Text style={[styles.hint, { color: Colors.red }]}>Please choose an appropriate name</Text>}

              <Text style={styles.label}>Date of Birth</Text>
              <TextInput
                style={styles.input}
                placeholder="DD/MM/YYYY"
                placeholderTextColor={Colors.greyLight}
                value={dob}
                onChangeText={handleDobChange}
                keyboardType="number-pad"
                maxLength={10}
              />
              <Text style={[styles.hint, dobError ? { color: Colors.red } : {}]}>
                {dobError || 'You must be 18 or older to use Kindred.'}
              </Text>

              <Text style={styles.label}>Home Address <Text style={{ fontWeight: '400', color: '#8B9AAD' }}>(optional)</Text></Text>
              {suburb ? (
                <View style={{ backgroundColor: '#E8F8F5', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.teal }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.teal }}>📍 {homeAddress || suburb}</Text>
                  <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>Address saved — you can change this later in Profile</Text>
                  <TouchableOpacity onPress={() => { setSuburb(''); setHomeLat(null); setHomeLng(null); setHomeAddress('') }} style={{ marginTop: 6 }}>
                    <Text style={{ fontSize: 12, color: '#C53030' }}>Clear</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Start typing your address..."
                    placeholderTextColor={Colors.greyLight}
                    value={homeAddress}
                    onChangeText={(text) => {
                      setHomeAddress(text)
                      if (addressDebounce) clearTimeout(addressDebounce)
                      if (text.length < 3) { setAddressSuggestions([]); return }
                      setAddressDebounce(setTimeout(async () => {
                        const results = await searchAddresses(text)
                        setAddressSuggestions(results)
                      }, 300))
                    }}
                  />
                  {addressSuggestions.length > 0 && (
                    <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#F2EDE7', borderRadius: 10, marginTop: 4, overflow: 'hidden' }}>
                      {addressSuggestions.map((s, i) => (
                        <TouchableOpacity
                          key={s.id}
                          style={{ padding: 12, borderBottomWidth: i < addressSuggestions.length - 1 ? 1 : 0, borderBottomColor: '#F2EDE7' }}
                          onPress={async () => {
                            setHomeAddress(s.a)
                            setAddressSuggestions([])
                            const coords = await getAddressCoords(s.id)
                            if (coords) {
                              setHomeLat(coords.lat)
                              setHomeLng(coords.lng)
                              setSuburb(coords.suburb || coords.city || s.a.split(',')[1]?.trim() || 'Home')
                            }
                          }}
                        >
                          <Text style={{ fontSize: 13, color: '#1B2A3D' }}>{s.a}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  <Text style={{ fontSize: 11, color: '#8B9AAD', marginTop: 4 }}>You can set this later in your profile. Browse requires a home address to show items near you.</Text>
                </>
              )}
            </View>
          )}

          {/* ===== STEP 2: Phone & Terms ===== */}
          {step === 2 && (
            <View style={styles.section}>
              <Text style={styles.stepLabel}>STEP 3 OF 3</Text>
              <Text style={styles.stepTitle}>Almost Done</Text>
              <Text style={styles.stepDesc}>A few final things.</Text>

              {/* Phone (optional) */}
              <Text style={styles.label}>Phone (optional)</Text>
              <TextInput
                style={[styles.input, phoneVerified && { backgroundColor: '#E8F8F5', borderColor: Colors.teal }]}
                placeholder="+64 21 xxx xxxx"
                placeholderTextColor={Colors.greyLight}
                value={phone}
                onChangeText={(t) => { setPhone(t); setPhoneOtpSent(false); setPhoneVerified(false); setPhoneOtpCode(''); setPhoneError('') }}
                keyboardType="phone-pad"
                editable={!phoneVerified}
              />
              {phone.length > 0 && !phoneValid && <Text style={[styles.hint, { color: Colors.red }]}>Enter a valid NZ phone number</Text>}

              {phoneVerified && (
                <Text style={[styles.hint, { color: Colors.teal, fontWeight: '600' }]}>Phone verified!</Text>
              )}

              {phone.length > 0 && phoneValid && !phoneVerified && !phoneOtpSent && (
                <TouchableOpacity
                  style={[styles.verifyBtn, phoneSending && styles.btnDisabled]}
                  onPress={handleSendPhoneOtp}
                  disabled={phoneSending}
                >
                  <Text style={styles.verifyBtnText}>{phoneSending ? 'Sending...' : 'Send Verification Code'}</Text>
                </TouchableOpacity>
              )}

              {phoneOtpSent && !phoneVerified && (
                <>
                  <Text style={[styles.hint, { color: Colors.teal }]}>Code sent! Check your texts.</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter 6-digit code"
                    placeholderTextColor={Colors.greyLight}
                    value={phoneOtpCode}
                    onChangeText={setPhoneOtpCode}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <TouchableOpacity
                    style={[styles.verifyBtn, phoneVerifying && styles.btnDisabled]}
                    onPress={handleVerifyPhoneOtp}
                    disabled={phoneVerifying || phoneOtpCode.length !== 6}
                  >
                    <Text style={styles.verifyBtnText}>{phoneVerifying ? 'Verifying...' : 'Verify Code'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSendPhoneOtp} disabled={phoneSending}>
                    <Text style={[styles.hint, { color: Colors.teal, textDecorationLine: 'underline' }]}>Resend code</Text>
                  </TouchableOpacity>
                </>
              )}

              {phoneError !== '' && <Text style={[styles.hint, { color: Colors.red }]}>{phoneError}</Text>}

              {/* Spacer before checkboxes */}
              <View style={{ height: 16 }} />

              {/* Terms & Privacy checkbox */}
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setAcceptedTerms(!acceptedTerms)}
              >
                <View style={[styles.checkBox, acceptedTerms && styles.checkBoxOn]}>
                  {acceptedTerms && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <Text style={styles.checkText}>
                  I accept the <Link href="/terms" style={styles.link}>Terms of Service</Link> and <Link href="/privacy" style={styles.link}>Privacy Policy</Link>
                </Text>
              </TouchableOpacity>

              {/* Disclaimer checkbox */}
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setAcceptedDisclaimer(!acceptedDisclaimer)}
              >
                <View style={[styles.checkBox, acceptedDisclaimer && styles.checkBoxOn]}>
                  {acceptedDisclaimer && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <Text style={styles.checkText}>
                  I understand that Kindred is a community sharing platform and that all exchanges are
                  between individual users. Kindred is not responsible for the quality, safety, or legality
                  of items listed, the conduct of users, or any loss, damage, or injury arising from
                  exchanges. I agree to exercise caution when meeting other users.
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {signUpMsg !== '' && (
          <View style={styles.msgBox}>
            <Text style={styles.msgText}>{signUpMsg}</Text>
          </View>
        )}

        <View style={styles.nav}>
          {step > 0 && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => setStep(step - 1)}
            >
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          )}

          {step === 0 && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.replace('/(auth)/login')}
            >
              <Text style={styles.backText}>Sign In</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.nextBtn,
              ((step === 0 && !isStep0Valid) ||
               (step === 1 && !isStep1Valid) ||
               (step === 2 && (!isStep2Valid || loading))) && styles.btnDisabled,
            ]}
            disabled={
              (step === 0 && !isStep0Valid) ||
              (step === 1 && !isStep1Valid) ||
              (step === 2 && (!isStep2Valid || loading))
            }
            onPress={() => {
              if (step < 2) setStep(step + 1)
              else handleSignUp()
            }}
          >
            <Text style={styles.nextText}>
              {step === 2 ? (loading ? 'Creating...' : 'Create Account') : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  scroll: { paddingHorizontal: 28, paddingTop: 48, paddingBottom: 24 },
  header: { alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 38, fontWeight: '700', color: Colors.teal },
  subtitle: { fontSize: 15, color: Colors.grey },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.sand },
  dotActive: { backgroundColor: Colors.teal, width: 24, borderRadius: 4 },
  dotDone: { backgroundColor: Colors.teal, opacity: 0.4 },
  section: { marginBottom: 24 },
  stepLabel: {
    fontSize: 11, fontWeight: '600', textTransform: 'uppercase',
    letterSpacing: 1.5, color: Colors.teal, marginBottom: 8,
  },
  stepTitle: { fontSize: 22, fontWeight: '600', color: Colors.dark, marginBottom: 6 },
  stepDesc: { fontSize: 14, color: Colors.grey, marginBottom: 16, lineHeight: 21 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.dark, marginBottom: 6 },
  hint: { fontSize: 11, color: Colors.grey, marginTop: -6, marginBottom: 12 },
  input: {
    width: '100%',
    padding: 14,
    borderWidth: 2,
    borderColor: Colors.sand,
    borderRadius: Radius.sm,
    fontSize: 15,
    backgroundColor: '#fff',
    color: Colors.dark,
    marginBottom: 12,
  },
  checkbox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  checkBox: {
    width: 22, height: 22, borderWidth: 2, borderColor: Colors.sand,
    borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  checkBoxOn: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  checkMark: { color: '#fff', fontSize: 12 },
  checkText: { flex: 1, fontSize: 12, color: Colors.grey, lineHeight: 18 },
  link: { color: Colors.teal, textDecorationLine: 'underline' },
  nav: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 28, paddingVertical: 16, paddingBottom: 32,
  },
  backBtn: {
    flex: 1, padding: 15, borderRadius: 50, alignItems: 'center',
    borderWidth: 2, borderColor: Colors.sand,
  },
  backText: { color: Colors.grey, fontSize: 15, fontWeight: '600' },
  nextBtn: {
    flex: 1, padding: 15, borderRadius: 50, alignItems: 'center',
    backgroundColor: Colors.teal,
  },
  btnDisabled: { backgroundColor: Colors.greyLight },
  nextText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  googleBtn: {
    padding: 16, backgroundColor: '#fff', borderRadius: 50, alignItems: 'center' as const,
    borderWidth: 2, borderColor: Colors.sand, marginBottom: 8,
  },
  googleBtnText: { color: Colors.dark, fontSize: 15, fontWeight: '600' as const },
  divider: { flexDirection: 'row' as const, alignItems: 'center' as const, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.sand },
  dividerText: { paddingHorizontal: 12, color: Colors.grey, fontSize: 12 },
  msgBox: {
    backgroundColor: '#FFF3E6', borderRadius: 12, padding: 14,
    marginHorizontal: 28, marginBottom: 8, borderWidth: 1, borderColor: '#F4A261',
  },
  msgText: { fontSize: 13, color: '#B8762A', textAlign: 'center', lineHeight: 18 },
  verifyBtn: {
    padding: 12, backgroundColor: Colors.teal, borderRadius: 50,
    alignItems: 'center', marginBottom: 8,
  },
  verifyBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
})
