import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Switch, Alert, TextInput, Modal, Platform, Image } from 'react-native'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useApp } from '../../lib/appContext'
import { signOut, sendPhoneOtp, verifyPhoneOtp } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { DROP_POINTS } from '../../lib/utils'
import { getCurrentLocation } from '../../lib/location'
import { searchAddresses, getAddressCoords, AddySuggestion } from '../../lib/addressAutocomplete'
import { submitVerification, getMyVerification, IdVerification } from '../../lib/verification'
import { containsProfanity, capitalizeName } from '../../lib/profanityFilter'
import { compressImage } from '../../lib/imageUtils'

export default function ProfileScreen() {
  const {
    userId, points, userName, suburb, idVerified, myReliability,
    setIsAuthenticated, profile, refreshProfile, isPremium, emailVerified, setPoints,
  } = useApp()
  const [editingProfile, setEditingProfile] = useState(false)
  const [editName, setEditName] = useState(userName)
  const [editSuburb, setEditSuburb] = useState(suburb)
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)
  const [homeAddress, setHomeAddress] = useState('')
  const [addressSuggestions, setAddressSuggestions] = useState<AddySuggestion[]>([])
  const [savingAddress, setSavingAddress] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [notifPush, setNotifPush] = useState(profile?.notification_push ?? true)
  const [notifEmail, setNotifEmail] = useState(profile?.notification_email ?? true)
  const [notifMatches, setNotifMatches] = useState(profile?.notification_matches ?? true)
  const [editingEmergency, setEditingEmergency] = useState(false)
  const [emergName, setEmergName] = useState(profile?.emergency_contact_name || '')
  const [emergPhone, setEmergPhone] = useState(profile?.emergency_contact_phone || '')
  const [savingEmergency, setSavingEmergency] = useState(false)
  // Blocked users
  const [showBlockedUsers, setShowBlockedUsers] = useState(false)
  const [blockedUsers, setBlockedUsers] = useState<{ id: string; blocked_id: string; display_name: string | null }[]>([])
  const [blockedLoading, setBlockedLoading] = useState(false)
  const [unblocking, setUnblocking] = useState<string | null>(null)

  // Phone verification
  const [showPhoneVerifyModal, setShowPhoneVerifyModal] = useState(false)
  const [phoneOtpSent, setPhoneOtpSent] = useState(false)
  const [phoneOtpCode, setPhoneOtpCode] = useState('')
  const [phoneSending, setPhoneSending] = useState(false)
  const [phoneVerifying, setPhoneVerifying] = useState(false)
  const [phoneError, setPhoneError] = useState('')

  const handleAddressInput = useCallback((text: string) => {
    setHomeAddress(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (text.length < 3) { setAddressSuggestions([]); return }
    debounceRef.current = setTimeout(async () => {
      const results = await searchAddresses(text)
      setAddressSuggestions(results)
    }, 300)
  }, [])

  const handleSelectAddress = useCallback(async (suggestion: AddySuggestion) => {
    setHomeAddress(suggestion.a)
    setAddressSuggestions([])
    setSavingAddress(true)
    try {
      const coords = await getAddressCoords(suggestion.id)
      if (coords) {
        await supabase.from('profiles').update({ lat: coords.lat, lng: coords.lng }).eq('id', userId)
        await refreshProfile()
        setHomeAddress('')
        const msg = 'Home location saved! Your address was not stored — only the coordinates.'
        Platform.OS === 'web' ? alert(msg) : Alert.alert('Done', msg)
      } else {
        const msg = 'Could not get coordinates for that address. Try another one.'
        Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg)
      }
    } catch (err) {
      console.error('Address select error:', err)
    } finally {
      setSavingAddress(false)
    }
  }, [userId, refreshProfile])

  const handleSendPhoneOtp = async () => {
    if (!profile?.phone) return
    setPhoneSending(true)
    setPhoneError('')
    try {
      let normalizedPhone = profile.phone.replace(/[\s\-]/g, '')
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
    if (phoneOtpCode.length !== 6 || !profile?.phone || !userId) return
    setPhoneVerifying(true)
    setPhoneError('')
    try {
      let normalizedPhone = profile.phone.replace(/[\s\-]/g, '')
      if (normalizedPhone.startsWith('0')) {
        normalizedPhone = '+64' + normalizedPhone.slice(1)
      } else if (!normalizedPhone.startsWith('+')) {
        normalizedPhone = '+' + normalizedPhone
      }
      await verifyPhoneOtp(normalizedPhone, phoneOtpCode)
      // Mark as verified in profile
      await supabase.from('profiles').update({ phone_verified: true }).eq('id', userId)
      // Award KP: 50 base, 100 for Plus
      const phoneKP = isPremium ? 100 : 50
      await supabase.rpc('award_completion_points', { user_uuid: userId, points_to_add: phoneKP })
      await supabase.from('points_log').insert({ user_id: userId, action: `for verifying phone${isPremium ? ' (2x Plus bonus)' : ''}`, points: phoneKP })
      setPoints(prev => prev + phoneKP)
      await refreshProfile()
      setShowPhoneVerifyModal(false)
      setPhoneOtpSent(false)
      setPhoneOtpCode('')
      const msg = `Phone verified! +${phoneKP} Kindness Points earned`
      if (Platform.OS === 'web') { alert(msg) } else { Alert.alert('Success', msg) }
    } catch (err: any) {
      setPhoneError(err.message || 'Invalid code')
    } finally {
      setPhoneVerifying(false)
    }
  }

  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [verifyStep, setVerifyStep] = useState<'choose' | 'id_photo' | 'selfie' | 'preview' | 'submitting'>('choose')
  const [verifyDocType, setVerifyDocType] = useState('')
  const [idPhotoUri, setIdPhotoUri] = useState<string | null>(null)
  const [selfieUri, setSelfieUri] = useState<string | null>(null)
  const [myVerification, setMyVerification] = useState<IdVerification | null>(null)
  const [verifyLoading, setVerifyLoading] = useState(false)
  useEffect(() => {
    if (userId && !idVerified) {
      getMyVerification(userId).then(v => setMyVerification(v)).catch(() => {})
    }
  }, [userId, idVerified])

  const myRelScore = myReliability.total === 0 ? null : Math.round((myReliability.completed / myReliability.total) * 100)

  const pickIdPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    })
    if (!result.canceled && result.assets[0]) {
      setIdPhotoUri(result.assets[0].uri)
      setVerifyStep('selfie')
    }
  }

  const takeIdPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      const msg = 'Camera permission is needed to take a photo of your ID.'
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Permission Needed', msg)
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
    })
    if (!result.canceled && result.assets[0]) {
      setIdPhotoUri(result.assets[0].uri)
      setVerifyStep('selfie')
    }
  }

  const takeSelfie = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      const msg = 'Camera permission is needed for the selfie step.'
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Permission Needed', msg)
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      cameraType: ImagePicker.CameraType.front,
    })
    if (!result.canceled && result.assets[0]) {
      setSelfieUri(result.assets[0].uri)
      setVerifyStep('preview')
    }
  }

  const handleSubmitVerification = async () => {
    if (!userId || !idPhotoUri || !selfieUri) return
    setVerifyStep('submitting')
    setVerifyLoading(true)
    try {
      await submitVerification(userId, verifyDocType, idPhotoUri, selfieUri)
      setShowVerifyModal(false)
      setMyVerification({ status: 'pending' } as IdVerification)
      const msg = 'Your ID has been submitted for review. We\'ll verify it within 24 hours.'
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Submitted!', msg)
    } catch (err: any) {
      setVerifyStep('preview')
      const msg = err.message || 'Failed to submit verification'
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg)
    } finally {
      setVerifyLoading(false)
    }
  }

  const resetVerifyModal = () => {
    setShowVerifyModal(false)
    setVerifyStep('choose')
    setVerifyDocType('')
    setIdPhotoUri(null)
    setSelfieUri(null)
  }

  const handleSaveProfile = async () => {
    if (!userId) return
    if (containsProfanity(editName)) {
      Platform.OS === 'web' ? alert('Please choose an appropriate name') : Alert.alert('Oops', 'Please choose an appropriate name')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: capitalizeName(editName),
          suburb: editSuburb,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
      if (error) throw error
      await refreshProfile()
      setEditingProfile(false)
    } catch (err: any) {
      Platform.OS === 'web' ? alert(err.message || 'Failed to save profile') : Alert.alert('Error', err.message || 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleUploadAvatar = async () => {
    if (!userId) return
    const options = [
      { text: 'Take Selfie', onPress: async () => {
        const perm = await ImagePicker.requestCameraPermissionsAsync()
        if (!perm.granted) { Alert.alert('Permission needed', 'Camera access is required to take a selfie.'); return }
        const result = await ImagePicker.launchCameraAsync({ cameraType: ImagePicker.CameraType.front, quality: 0.7 })
        if (!result.canceled && result.assets[0]) await uploadAvatar(result.assets[0].uri)
      }},
      { text: 'Choose Photo', onPress: async () => {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 })
        if (!result.canceled && result.assets[0]) await uploadAvatar(result.assets[0].uri)
      }},
      { text: 'Cancel', style: 'cancel' as const },
    ]
    if (Platform.OS === 'web') {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 })
      if (!result.canceled && result.assets[0]) await uploadAvatar(result.assets[0].uri)
    } else {
      Alert.alert('Profile Photo', 'Use a clear photo of your face', options)
    }
  }

  const uploadAvatar = async (uri: string) => {
    if (!userId) return
    try {
      const hadAvatar = !!profile?.avatar_url
      const filename = `${userId}/avatar.jpg`
      const compressed = await compressImage(uri, 600)
      const response = await fetch(compressed)
      const blob = await response.blob()
      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filename, blob, { contentType: 'image/jpeg', upsert: true })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(filename)
      // Add cache-buster so the image refreshes
      const freshUrl = `${publicUrl}?t=${Date.now()}`
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: freshUrl, updated_at: new Date().toISOString() })
        .eq('id', userId)
      if (updateError) throw updateError
      // Award +25 KP for first profile photo
      if (!hadAvatar) {
        try {
          await supabase.rpc('award_completion_points', { user_uuid: userId, points_to_add: 25 })
          setPoints(p => p + 25)
          await supabase.from('points_log').insert({
            user_id: userId,
            action: 'Uploaded profile photo',
            points: 25,
          })
          Platform.OS === 'web'
            ? alert('Photo uploaded! +25 Kindness Points earned')
            : Alert.alert('Photo Uploaded!', 'You earned +25 Kindness Points for adding a profile photo!')
        } catch { }
      }
      await refreshProfile()
    } catch (err: any) {
      Platform.OS === 'web' ? alert(err.message || 'Failed to upload photo') : Alert.alert('Error', err.message || 'Failed to upload photo')
    }
  }

  const handleSaveEmergency = async () => {
    if (!userId) return
    setSavingEmergency(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          emergency_contact_name: emergName,
          emergency_contact_phone: emergPhone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
      if (error) throw error
      await refreshProfile()
      setEditingEmergency(false)
    } catch (err: any) {
      Platform.OS === 'web' ? alert(err.message || 'Failed to save emergency contact') : Alert.alert('Error', err.message || 'Failed to save emergency contact')
    } finally {
      setSavingEmergency(false)
    }
  }

  const handleNotifToggle = async (field: string, value: boolean, revert: () => void) => {
    if (!userId) return
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', userId)
      if (error) throw error
    } catch (err) {
      revert()
      const msg = 'Failed to update notification preference. Please try again.'
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg)
    }
  }

  const doSignOut = async () => {
    try {
      await signOut()
      setIsAuthenticated(false)
      router.replace('/(auth)/login')
    } catch (err) {
      if (Platform.OS === 'web') {
        alert('Failed to sign out')
      } else {
        Alert.alert('Error', 'Failed to sign out')
      }
      console.error(err)
    }
  }

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      if (confirm('Are you sure you want to sign out?')) doSignOut()
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: doSignOut },
      ])
    }
  }

  const handleChangePassword = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        Platform.OS === 'web' ? alert('Could not find your email address.') : Alert.alert('Error', 'Could not find your email address.')
        return
      }
      const { error } = await supabase.auth.resetPasswordForEmail(user.email)
      if (error) throw error
      Platform.OS === 'web' ? alert('Check your email for a password reset link.') : Alert.alert('Email Sent', 'Check your email for a password reset link.')
    } catch (err: any) {
      Platform.OS === 'web' ? alert(err.message) : Alert.alert('Error', err.message)
    }
  }

  const doDeleteAccount = async () => {
    try {
      if (userId) {
        await supabase.from('profiles').delete().eq('id', userId)
      }
      await supabase.auth.signOut()
      setIsAuthenticated(false)
      router.replace('/(auth)/login')
    } catch (err: any) {
      if (Platform.OS === 'web') {
        alert(err.message || 'Failed to delete account')
      } else {
        Alert.alert('Error', err.message)
      }
    }
  }

  const handleDeleteAccount = () => {
    if (Platform.OS === 'web') {
      if (confirm('Are you sure? This action cannot be undone. All your data will be permanently deleted.')) {
        doDeleteAccount()
      }
    } else {
      Alert.alert(
        'Delete Account',
        'Are you sure? This action cannot be undone. All your data will be permanently deleted.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDeleteAccount },
        ]
      )
    }
  }

  const loadBlockedUsers = async () => {
    if (!userId) return
    setBlockedLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_blocks')
        .select('id, blocked_id, profiles!user_blocks_blocked_id_profiles_fkey(display_name)')
        .eq('blocker_id', userId)
      if (error) throw error
      setBlockedUsers((data || []).map((b: any) => ({
        id: b.id,
        blocked_id: b.blocked_id,
        display_name: b.profiles?.display_name || 'Unknown',
      })))
    } catch (err) {
      console.error('Failed to load blocked users:', err)
    } finally {
      setBlockedLoading(false)
    }
  }

  const handleUnblock = async (blockId: string, name: string) => {
    const doUnblock = async () => {
      setUnblocking(blockId)
      try {
        const { error } = await supabase.from('user_blocks').delete().eq('id', blockId)
        if (error) throw error
        setBlockedUsers(prev => prev.filter(b => b.id !== blockId))
        Platform.OS === 'web' ? alert(`${name} has been unblocked.`) : Alert.alert('Unblocked', `${name} has been unblocked.`)
      } catch (err: any) {
        Platform.OS === 'web' ? alert(err.message || 'Failed to unblock') : Alert.alert('Error', err.message || 'Failed to unblock')
      } finally {
        setUnblocking(null)
      }
    }
    if (Platform.OS === 'web') {
      if (confirm(`Unblock ${name}? They will be able to request your items again.`)) doUnblock()
    } else {
      Alert.alert('Unblock User', `Unblock ${name}? They will be able to request your items again.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unblock', onPress: doUnblock },
      ])
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kindred</Text>
        <Text style={styles.headerSub}>The community app powered by kindness</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.profileCardAccent} />
          <TouchableOpacity style={styles.avatarWrap} onPress={handleUploadAvatar} activeOpacity={0.7}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{userName ? userName.charAt(0) : '?'}</Text>
              </View>
            )}
            <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: '#1A9E8F', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>+</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.profileName}>{userName || 'Set your name'}</Text>
          <Text style={styles.profileSub}>{suburb || 'Set your suburb'}</Text>

          <View style={styles.badges}>
            {emailVerified && <View style={styles.badge}><Text style={styles.badgeText}>✓ Email</Text></View>}
            {profile?.phone_verified ? (
              <View style={styles.badge}><Text style={styles.badgeText}>✓ Phone</Text></View>
            ) : profile?.phone ? (
              <TouchableOpacity style={[styles.badge, { borderColor: '#1A9E8F', backgroundColor: '#E8F8F5' }]} onPress={() => setShowPhoneVerifyModal(true)}>
                <Text style={[styles.badgeText, { color: '#1A9E8F' }]}>Verify Phone +{isPremium ? 100 : 50} Kindness Points</Text>
              </TouchableOpacity>
            ) : null}
            {idVerified && <View style={[styles.badge, styles.badgeGold]}><Text style={[styles.badgeText, styles.badgeTextGold]}>🛡️ ID Verified</Text></View>}
            {(profile?.mover_count ?? 0) >= 3 && <View style={[styles.badge, { backgroundColor: '#FFF3E6', borderColor: '#E8A040' }]}><Text style={[styles.badgeText, { color: '#E8A040' }]}>🚚 Mover</Text></View>}
          </View>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{points}</Text>
              <Text style={styles.statLabel}>Kindness Points</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{myRelScore !== null ? myRelScore + '%' : '--'}</Text>
              <Text style={styles.statLabel}>Reliable</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{myReliability.completed}</Text>
              <Text style={styles.statLabel}>Exchanges</Text>
            </View>
          </View>
        </View>

        {/* Plus upsell */}
        {!isPremium ? (
          <View style={styles.plusBanner}>
            <Text style={{ fontSize: 24, textAlign: 'center' }}>⭐</Text>
            <Text style={[styles.plusBannerTitle, { textAlign: 'center' }]}>Kindred Plus</Text>
            <Text style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 4 }}>Do more, earn more, and let the app work harder for you.</Text>
            <Text style={{ fontSize: 12, color: '#8B9AAD', textAlign: 'center', marginBottom: 14 }}>Plus members power the Kindred community — your support helps us keep growing!</Text>
            <View style={{ gap: 6, marginBottom: 16 }}>
              <Text style={{ fontSize: 13, color: '#1B2A3D' }}>✓  2x Kindness Points on everything</Text>
              <Text style={{ fontSize: 13, color: '#1B2A3D' }}>✓  Unlimited daily listings</Text>
              <Text style={{ fontSize: 13, color: '#1B2A3D' }}>✓  Smart matching — we find gives for your needs</Text>
              <Text style={{ fontSize: 13, color: '#1B2A3D' }}>✓  Plus badge on your profile</Text>
            </View>
            <TouchableOpacity style={{ backgroundColor: '#D4A843', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }} onPress={() => {
              const msg = 'Kindred Plus is coming soon! We\'ll let you know when it\'s available.'
              Platform.OS === 'web' ? alert(msg) : Alert.alert('Coming Soon', msg)
            }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Upgrade to Plus</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.plusActiveBanner}>
            <Text style={styles.plusActiveText}>⭐ Plus Member — thank you for powering kindness!</Text>
          </View>
        )}

        {/* ID Verify prompt */}
        {!idVerified && (
          myVerification?.status === 'pending' ? (
            <View style={[styles.verifyCard, { borderColor: '#8B9AAD' }]}>
              <Text style={styles.verifyIcon}>🕐</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.verifyTitle}>Verification Pending</Text>
                <Text style={styles.verifyDesc}>We're reviewing your ID — usually within 24 hours</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.verifyCard} onPress={() => { resetVerifyModal(); setShowVerifyModal(true) }}>
              <Text style={styles.verifyIcon}>🛡️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.verifyTitle}>{myVerification?.status === 'rejected' ? 'Verification Declined — Try Again' : 'Verify ID'}</Text>
                <Text style={styles.verifyDesc}>+{isPremium ? 200 : 100} Kindness Points{isPremium ? ' (2x Plus bonus)' : ''}, gold badge, builds trust{'\n'}Your ID is never stored or shared</Text>
              </View>
              <Text style={styles.verifyArrow}>›</Text>
            </TouchableOpacity>
          )
        )}

        {/* Phone Verify prompt */}
        {!profile?.phone_verified && (
          <TouchableOpacity style={styles.verifyCard} onPress={() => {
            if (!profile?.phone) {
              const msg = 'Add your phone number in Settings below first, then come back to verify it.'
              Platform.OS === 'web' ? alert(msg) : Alert.alert('Add Phone First', msg)
            } else {
              setShowPhoneVerifyModal(true)
            }
          }}>
            <Text style={styles.verifyIcon}>📱</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.verifyTitle}>Verify Phone</Text>
              <Text style={styles.verifyDesc}>+{isPremium ? 100 : 50} Kindness Points{isPremium ? ' (2x Plus bonus)' : ''}, adds a trust badge{'\n'}Your number is never shared with others</Text>
            </View>
            <Text style={styles.verifyArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Email Verify prompt */}
        {!emailVerified && (
          <TouchableOpacity style={styles.verifyCard} onPress={() => router.push('/verify-email')}>
            <Text style={styles.verifyIcon}>📧</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.verifyTitle}>Verify Email</Text>
              <Text style={styles.verifyDesc}>Confirm your email to secure your account</Text>
            </View>
            <Text style={styles.verifyArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Privacy note */}
        {(!idVerified || !profile?.phone_verified || !emailVerified) && (
          <Text style={{ fontSize: 11, color: '#8B9AAD', textAlign: 'center', marginTop: -4, marginBottom: 8, paddingHorizontal: 20 }}>
            Your ID, phone number, and address are never shared publicly. ID photos are deleted after review and never stored.
          </Text>
        )}

        {/* Home Location card */}
        <View style={styles.settingsCard}>
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Text style={{ fontSize: 20 }}>🏠</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1B2A3D' }}>Home Location</Text>
                {profile?.lat ? (
                  <Text style={{ fontSize: 12, color: '#6BA368' }}>Location saved — Browse shows items near you</Text>
                ) : (
                  <Text style={{ fontSize: 12, color: '#8B9AAD' }}>Set your home so Browse shows items near you</Text>
                )}
              </View>
            </View>
            <TouchableOpacity
              style={[styles.locationBtn, locating ? { opacity: 0.6 } : undefined]}
              disabled={locating}
              onPress={async () => {
                const doSave = async () => {
                  setLocating(true)
                  try {
                    const loc = await getCurrentLocation()
                    if (loc) {
                      await supabase.from('profiles').update({ lat: loc.lat, lng: loc.lng }).eq('id', userId)
                      await refreshProfile()
                      const msg = 'Home location saved!'
                      Platform.OS === 'web' ? alert(msg) : Alert.alert('Done', msg)
                    } else {
                      const msg = 'Location permission denied. Enable it in your device settings, or enter your address below.'
                      Platform.OS === 'web' ? alert(msg) : Alert.alert('Permission Needed', msg)
                    }
                  } catch (err) {
                    console.error('Location error:', err)
                  } finally {
                    setLocating(false)
                  }
                }
                if (Platform.OS === 'web') {
                  if (confirm('Are you at home right now?')) doSave()
                  else alert('No worries — you can enter your home address below instead.')
                } else {
                  Alert.alert('Are you at home?', 'We\'ll save this as your home location for browsing nearby items.', [
                    { text: 'No', style: 'cancel', onPress: () => Alert.alert('Tip', 'You can enter your home address below instead.') },
                    { text: 'Yes, I\'m home', onPress: doSave },
                  ])
                }
              }}
            >
              <Text style={styles.locationBtnText}>{locating ? 'Getting location...' : profile?.lat ? '📍 Update from GPS' : '📍 Set home from GPS'}</Text>
            </TouchableOpacity>
            <Text style={styles.formLabelSmall}>Or search your home address</Text>
            <TextInput
              style={[styles.editInput, { marginBottom: 0 }]}
              value={homeAddress}
              onChangeText={handleAddressInput}
              placeholder="Start typing your address..."
              placeholderTextColor="#C8D1DC"
              editable={!savingAddress}
            />
            {savingAddress && (
              <Text style={{ fontSize: 12, color: '#1A9E8F', marginTop: 6 }}>Saving location...</Text>
            )}
            {addressSuggestions.length > 0 && (
              <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#F2EDE7', borderRadius: 10, marginTop: 4, overflow: 'hidden' }}>
                {addressSuggestions.map((s, i) => (
                  <TouchableOpacity
                    key={s.id}
                    style={{ padding: 12, borderBottomWidth: i < addressSuggestions.length - 1 ? 1 : 0, borderBottomColor: '#F2EDE7' }}
                    onPress={() => handleSelectAddress(s)}
                  >
                    <Text style={{ fontSize: 13, color: '#1B2A3D' }}>{s.a}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={styles.privacyNote}>Your address is never stored — only coordinates are saved</Text>
          </View>
        </View>

        {/* Account section */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.settingsCard}>
          <TouchableOpacity style={styles.settingsRow} onPress={() => { setEditingProfile(!editingProfile); setEditName(userName); setEditSuburb(suburb) }}>
            <Text style={styles.settingsLabel}>Edit Profile</Text>
            <Text style={styles.settingsArrow}>›</Text>
          </TouchableOpacity>
          {editingProfile && (
            <View style={styles.editProfile}>
              <Text style={styles.formLabel}>Name</Text>
              <TextInput
                style={styles.editInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Your name"
                placeholderTextColor="#C8D1DC"
              />
              <Text style={styles.formLabel}>Suburb</Text>
              <TextInput
                style={styles.editInput}
                value={editSuburb}
                onChangeText={setEditSuburb}
                placeholder="Your suburb"
                placeholderTextColor="#C8D1DC"
              />
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSaveProfile}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity style={styles.settingsRow} onPress={handleChangePassword}>
            <Text style={styles.settingsLabel}>Change Password</Text>
            <Text style={styles.settingsArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Safety section */}
        <Text style={styles.sectionTitle}>Safety</Text>
        <View style={styles.settingsCard}>
          <TouchableOpacity style={styles.settingsRow} onPress={() => { setEditingEmergency(!editingEmergency); setEmergName(profile?.emergency_contact_name || ''); setEmergPhone(profile?.emergency_contact_phone || '') }}>
            <Text style={styles.settingsLabel}>Emergency Contact</Text>
            <Text style={styles.settingsValue}>
              {profile?.emergency_contact_name || 'Not set'} <Text style={styles.settingsArrow}>›</Text>
            </Text>
          </TouchableOpacity>
          {editingEmergency && (
            <View style={styles.editProfile}>
              <Text style={styles.formLabel}>Contact Name</Text>
              <TextInput style={styles.editInput} value={emergName} onChangeText={setEmergName} placeholder="Name" placeholderTextColor="#C8D1DC" />
              <Text style={styles.formLabel}>Phone Number</Text>
              <TextInput style={styles.editInput} value={emergPhone} onChangeText={setEmergPhone} placeholder="Phone" placeholderTextColor="#C8D1DC" keyboardType="phone-pad" />
              <TouchableOpacity style={[styles.saveBtn, savingEmergency && { opacity: 0.6 }]} onPress={handleSaveEmergency} disabled={savingEmergency}>
                <Text style={styles.saveBtnText}>{savingEmergency ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity style={styles.settingsRow} onPress={() => { setShowBlockedUsers(true); loadBlockedUsers() }}>
            <Text style={styles.settingsLabel}>Blocked Users</Text>
            <Text style={styles.settingsArrow}>›</Text>
          </TouchableOpacity>
          <View style={[styles.settingsRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.settingsLabel}>Drop Points</Text>
            <Text style={styles.settingsValue}>{DROP_POINTS.length} nearby</Text>
          </View>
        </View>

        {/* Notifications section */}
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingsRow}>
            <Text style={styles.settingsLabel}>Push</Text>
            <Switch
              value={notifPush}
              onValueChange={(v) => { setNotifPush(v); handleNotifToggle('notification_push', v, () => setNotifPush(!v)) }}
              trackColor={{ true: '#1A9E8F' }}
            />
          </View>
          <View style={[styles.settingsRow, !isPremium && { borderBottomWidth: 0 }]}>
            <Text style={styles.settingsLabel}>Email</Text>
            <Switch
              value={notifEmail}
              onValueChange={(v) => { setNotifEmail(v); handleNotifToggle('notification_email', v, () => setNotifEmail(!v)) }}
              trackColor={{ true: '#1A9E8F' }}
            />
          </View>
          {isPremium && (
            <View style={[styles.settingsRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.settingsLabel}>Smart Match Alerts</Text>
              <Switch
                value={notifMatches}
                onValueChange={(v) => { setNotifMatches(v); handleNotifToggle('notification_matches', v, () => setNotifMatches(!v)) }}
                trackColor={{ true: '#1A9E8F' }}
              />
            </View>
          )}
        </View>

        {/* Help section */}
        <Text style={styles.sectionTitle}>Help</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingsRow}>
            <Text style={styles.settingsLabel}>Crisis: 1737 | Emergency: 111</Text>
          </View>
          <TouchableOpacity style={styles.settingsRow} onPress={() => router.push('/terms')}>
            <Text style={styles.settingsLabel}>Terms of Service</Text>
            <Text style={styles.settingsArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Danger buttons */}
        <TouchableOpacity style={styles.dangerBtn} onPress={handleSignOut}>
          <Text style={styles.dangerBtnText}>Sign Out</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.dangerBtn, styles.dangerBtnLight]} onPress={handleDeleteAccount}>
          <Text style={[styles.dangerBtnText, styles.dangerBtnTextLight]}>Delete Account</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ID Verification Modal */}
      <Modal visible={showVerifyModal} animationType="slide" transparent onRequestClose={resetVerifyModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.verifyModal}>
            {verifyStep === 'choose' && (
              <>
                <Text style={styles.verifyModalTitle}>Verify Your Identity</Text>
                <Text style={styles.verifyModalDesc}>Choose a document type. You'll earn +{isPremium ? 200 : 100} Kindness Points{isPremium ? ' (2x Plus bonus)' : ''} and a gold badge.</Text>
                {[
                  { icon: '🪪', label: 'Driver\'s Licence', desc: 'NZ or international' },
                  { icon: '📘', label: 'Passport', desc: 'Any country' },
                  { icon: '🔐', label: 'RealMe', desc: 'NZ digital identity' },
                ].map(opt => (
                  <TouchableOpacity key={opt.label} style={styles.verifyOption} onPress={() => {
                    setVerifyDocType(opt.label)
                    setVerifyStep('id_photo')
                  }}>
                    <Text style={styles.verifyOptIcon}>{opt.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.verifyOptLabel}>{opt.label}</Text>
                      <Text style={styles.verifyOptDesc}>{opt.desc}</Text>
                    </View>
                    <Text style={styles.settingsArrow}>›</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.verifyCancelBtn} onPress={resetVerifyModal}>
                  <Text style={styles.verifyCancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}

            {verifyStep === 'id_photo' && (
              <>
                <Text style={styles.verifyModalTitle}>Step 1: Photo of Your ID</Text>
                <Text style={styles.verifyModalDesc}>Take a clear photo of your {verifyDocType}, or select one from your gallery.</Text>
                <TouchableOpacity style={styles.verifyActionBtn} onPress={takeIdPhoto}>
                  <Text style={styles.verifyActionBtnText}>📷 Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.verifyActionBtn, styles.verifyActionBtnAlt]} onPress={pickIdPhoto}>
                  <Text style={[styles.verifyActionBtnText, styles.verifyActionBtnTextAlt]}>🖼️ Choose from Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.verifyCancelBtn} onPress={() => setVerifyStep('choose')}>
                  <Text style={styles.verifyCancelText}>Back</Text>
                </TouchableOpacity>
              </>
            )}

            {verifyStep === 'selfie' && (
              <>
                <Text style={styles.verifyModalTitle}>Step 2: Live Selfie</Text>
                <Text style={styles.verifyModalDesc}>Take a selfie now so we can confirm you match your ID. This must be a live photo — no gallery.</Text>
                {idPhotoUri && (
                  <View style={styles.verifyPhotoPreview}>
                    <Image source={{ uri: idPhotoUri }} style={styles.verifyThumb} />
                    <Text style={styles.verifyPhotoLabel}>ID photo captured</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.verifyActionBtn} onPress={takeSelfie}>
                  <Text style={styles.verifyActionBtnText}>🤳 Take Selfie</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.verifyCancelBtn} onPress={() => { setIdPhotoUri(null); setVerifyStep('id_photo') }}>
                  <Text style={styles.verifyCancelText}>Back</Text>
                </TouchableOpacity>
              </>
            )}

            {verifyStep === 'preview' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.verifyModalTitle}>Review & Submit</Text>
                <Text style={styles.verifyModalDesc}>Check both photos are clear and your face is visible.</Text>
                <View style={styles.verifyPreviewRow}>
                  <View style={styles.verifyPreviewCol}>
                    <Text style={styles.verifyPreviewLabel}>ID Document</Text>
                    {idPhotoUri && <Image source={{ uri: idPhotoUri }} style={styles.verifyPreviewImg} />}
                  </View>
                  <View style={styles.verifyPreviewCol}>
                    <Text style={styles.verifyPreviewLabel}>Selfie</Text>
                    {selfieUri && <Image source={{ uri: selfieUri }} style={styles.verifyPreviewImg} />}
                  </View>
                </View>
                <TouchableOpacity style={styles.verifyActionBtn} onPress={handleSubmitVerification}>
                  <Text style={styles.verifyActionBtnText}>Submit for Review</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.verifyActionBtn, styles.verifyActionBtnAlt]} onPress={() => { setIdPhotoUri(null); setSelfieUri(null); setVerifyStep('id_photo') }}>
                  <Text style={[styles.verifyActionBtnText, styles.verifyActionBtnTextAlt]}>Retake Photos</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.verifyCancelBtn} onPress={resetVerifyModal}>
                  <Text style={styles.verifyCancelText}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {verifyStep === 'submitting' && (
              <View style={{ alignItems: 'center', padding: 20 }}>
                <Text style={{ fontSize: 32, marginBottom: 12 }}>🔄</Text>
                <Text style={styles.verifyModalTitle}>Uploading...</Text>
                <Text style={styles.verifyModalDesc}>Please wait while we upload your photos.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Phone Verification Modal */}
      <Modal visible={showPhoneVerifyModal} animationType="slide" transparent onRequestClose={() => setShowPhoneVerifyModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Verify Phone Number</Text>
            <Text style={styles.modalSubtitle}>Verify your phone to earn +{isPremium ? 100 : 50} Kindness Points</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#1B2A3D', textAlign: 'center', marginBottom: 16 }}>{profile?.phone}</Text>

            {!phoneOtpSent ? (
              <>
                <TouchableOpacity
                  style={[styles.modalBtn, phoneSending && { backgroundColor: '#C4C4C4' }]}
                  onPress={handleSendPhoneOtp}
                  disabled={phoneSending}
                >
                  <Text style={styles.modalBtnText}>{phoneSending ? 'Sending...' : 'Send Verification Code'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 13, color: '#1A9E8F', textAlign: 'center', marginBottom: 12 }}>Code sent! Check your texts.</Text>
                <TextInput
                  style={styles.phoneOtpInput}
                  placeholder="Enter 6-digit code"
                  placeholderTextColor="#8B9AAD"
                  value={phoneOtpCode}
                  onChangeText={setPhoneOtpCode}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <TouchableOpacity
                  style={[styles.modalBtn, (phoneVerifying || phoneOtpCode.length !== 6) && { backgroundColor: '#C4C4C4' }]}
                  onPress={handleVerifyPhoneOtp}
                  disabled={phoneVerifying || phoneOtpCode.length !== 6}
                >
                  <Text style={styles.modalBtnText}>{phoneVerifying ? 'Verifying...' : 'Verify Code'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSendPhoneOtp} disabled={phoneSending}>
                  <Text style={{ fontSize: 13, color: '#1A9E8F', textAlign: 'center', marginTop: 8, textDecorationLine: 'underline' }}>Resend code</Text>
                </TouchableOpacity>
              </>
            )}

            {phoneError !== '' && <Text style={{ fontSize: 13, color: '#E74C3C', textAlign: 'center', marginTop: 8 }}>{phoneError}</Text>}

            <TouchableOpacity style={{ marginTop: 16 }} onPress={() => { setShowPhoneVerifyModal(false); setPhoneOtpSent(false); setPhoneOtpCode(''); setPhoneError('') }}>
              <Text style={{ fontSize: 14, color: '#8B9AAD', textAlign: 'center' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Blocked Users Modal */}
      <Modal visible={showBlockedUsers} animationType="slide" transparent onRequestClose={() => setShowBlockedUsers(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Blocked Users</Text>
            <Text style={styles.modalSubtitle}>These users cannot request your items or message you.</Text>
            {blockedLoading ? (
              <Text style={{ textAlign: 'center', color: '#8B9AAD', padding: 20 }}>Loading...</Text>
            ) : blockedUsers.length === 0 ? (
              <Text style={{ textAlign: 'center', color: '#8B9AAD', padding: 20 }}>No blocked users</Text>
            ) : (
              <View style={{ maxHeight: 300 }}>
                <ScrollView>
                  {blockedUsers.map(b => (
                    <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F2EDE7' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8F5F3', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A9E8F' }}>{(b.display_name || 'U').charAt(0).toUpperCase()}</Text>
                        </View>
                        <Text style={{ fontSize: 14, color: '#1B2A3D' }}>{b.display_name}</Text>
                      </View>
                      <TouchableOpacity
                        style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: '#FDE8E8' }}
                        onPress={() => handleUnblock(b.id, b.display_name || 'this user')}
                        disabled={unblocking === b.id}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#C53030' }}>{unblocking === b.id ? '...' : 'Unblock'}</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
            <TouchableOpacity style={{ marginTop: 16, padding: 12, alignItems: 'center' }} onPress={() => setShowBlockedUsers(false)}>
              <Text style={{ fontSize: 14, color: '#8B9AAD' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF9F6' },
  header: { paddingHorizontal: 18, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F2EDE7' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#1A9E8F' },
  headerSub: { fontSize: 11, color: '#8B9AAD' },
  content: { flex: 1, padding: 16 },
  profileCard: { backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center', marginBottom: 16, shadowColor: '#1B2A3D', shadowOpacity: 0.08, shadowRadius: 16, elevation: 2, position: 'relative', overflow: 'hidden' },
  profileCardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: '#1A9E8F' },
  avatarWrap: { position: 'relative', width: 80, marginBottom: 10, marginTop: 4 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1A9E8F', alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 3, borderColor: '#fff', shadowColor: '#1B2A3D', shadowOpacity: 0.08, shadowRadius: 16, overflow: 'hidden' as const },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  profileName: { fontSize: 22, fontWeight: '600', color: '#1B2A3D' },
  profileSub: { fontSize: 12, color: '#8B9AAD' },
  badges: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 50, backgroundColor: '#E8F5F3' },
  badgeGold: { backgroundColor: '#FFF8E1', borderWidth: 1, borderColor: '#E8C84B' },
  badgeText: { fontSize: 10, fontWeight: '600', color: '#147A6E' },
  badgeTextGold: { color: '#D4A843' },
  stats: { flexDirection: 'row', gap: 20, marginTop: 16 },
  stat: { alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '700', color: '#1A9E8F' },
  statLabel: { fontSize: 10, color: '#8B9AAD' },
  verifyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#1B2A3D', shadowOpacity: 0.04, elevation: 1, borderWidth: 2, borderColor: '#D4A843' },
  verifyIcon: { fontSize: 28 },
  verifyTitle: { fontSize: 14, fontWeight: '600', color: '#1B2A3D' },
  verifyDesc: { fontSize: 12, color: '#8B9AAD' },
  verifyArrow: { fontSize: 20, color: '#C8D1DC' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#8B9AAD', marginBottom: 8, marginTop: 8 },
  settingsCard: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, shadowColor: '#1B2A3D', shadowOpacity: 0.04, elevation: 1, overflow: 'hidden' },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 13, borderBottomWidth: 1, borderBottomColor: '#F2EDE7' },
  settingsLabel: { fontSize: 13, color: '#1B2A3D' },
  settingsValue: { fontSize: 13, color: '#8B9AAD' },
  settingsArrow: { color: '#C8D1DC', fontSize: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#1B2A3D', marginBottom: 6 },
  editProfile: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#F2EDE7' },
  editInput: { borderWidth: 2, borderColor: '#F2EDE7', borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 15, color: '#1B2A3D', backgroundColor: '#fff' },
  saveBtn: { backgroundColor: '#1A9E8F', paddingVertical: 12, borderRadius: 50, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  locationBtn: { backgroundColor: '#E8F5F3', borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 8 },
  locationBtnText: { color: '#1A9E8F', fontWeight: '600', fontSize: 13 },
  locationSaved: { fontSize: 12, color: '#6BA368', marginBottom: 8 },
  locationHint: { fontSize: 12, color: '#8B9AAD', marginBottom: 8 },
  formLabelSmall: { fontSize: 12, color: '#8B9AAD', marginBottom: 6, marginTop: 8 },
  privacyNote: { fontSize: 10, color: '#C8D1DC', marginTop: 6, marginBottom: 12 },
  dangerBtn: { backgroundColor: '#FDE8E8', borderWidth: 2, borderColor: '#F5A5A5', borderRadius: 16, padding: 14, alignItems: 'center', marginTop: 8 },
  dangerBtnText: { color: '#C53030', fontWeight: '600', fontSize: 14 },
  dangerBtnLight: { backgroundColor: '#fff', marginBottom: 24 },
  dangerBtnTextLight: { color: '#C53030' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(27,42,61,0.4)', justifyContent: 'center' },
  verifyModal: { backgroundColor: '#fff', borderRadius: 24, padding: 24, margin: 20, maxHeight: '80%' as any },
  verifyModalTitle: { fontSize: 20, fontWeight: '700', color: '#1B2A3D', marginBottom: 4 },
  verifyModalDesc: { fontSize: 13, color: '#8B9AAD', marginBottom: 16, lineHeight: 18 },
  verifyOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 2, borderColor: '#F2EDE7', borderRadius: 14, marginBottom: 8, backgroundColor: '#FBF9F6' },
  verifyOptIcon: { fontSize: 24 },
  verifyOptLabel: { fontSize: 14, fontWeight: '600', color: '#1B2A3D' },
  verifyOptDesc: { fontSize: 11, color: '#8B9AAD' },
  verifyCancelBtn: { marginTop: 12, padding: 12, alignItems: 'center' as const },
  verifyCancelText: { fontSize: 14, color: '#8B9AAD' },
  verifyActionBtn: { backgroundColor: '#1A9E8F', borderRadius: 14, padding: 16, alignItems: 'center' as const, marginBottom: 8 },
  verifyActionBtnText: { color: '#fff', fontWeight: '600' as const, fontSize: 15 },
  verifyActionBtnAlt: { backgroundColor: '#E8F5F3' },
  verifyActionBtnTextAlt: { color: '#1A9E8F' },
  verifyPhotoPreview: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, backgroundColor: '#E8F5F3', borderRadius: 10, padding: 10, marginBottom: 12 },
  verifyThumb: { width: 48, height: 48, borderRadius: 8 },
  verifyPhotoLabel: { fontSize: 13, color: '#147A6E', fontWeight: '500' as const },
  verifyPreviewRow: { flexDirection: 'row' as const, gap: 12, marginBottom: 16 },
  verifyPreviewCol: { flex: 1, alignItems: 'center' as const },
  verifyPreviewLabel: { fontSize: 12, fontWeight: '600' as const, color: '#8B9AAD', marginBottom: 6 },
  verifyPreviewImg: { width: '100%' as any, aspectRatio: 1, borderRadius: 12, backgroundColor: '#F2EDE7' },

  // Plus upsell
  plusBanner: { backgroundColor: '#FFF8E1', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1.5, borderColor: '#D4A843' },
  plusBannerTitle: { fontSize: 17, fontWeight: '700' as const, color: '#D4A843', marginBottom: 4 },
  plusActiveBanner: { backgroundColor: '#FFF8E1', borderRadius: 16, padding: 14, marginBottom: 20, alignItems: 'center' as const, borderWidth: 1, borderColor: '#D4A843' },
  plusActiveText: { fontSize: 13, color: '#D4A843', fontWeight: '600' as const, textAlign: 'center' as const },

  // Phone verify modal
  modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 24, margin: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700' as const, color: '#1B2A3D', textAlign: 'center' as const, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: '#8B9AAD', textAlign: 'center' as const, marginBottom: 12 },
  modalBtn: { backgroundColor: '#1A9E8F', borderRadius: 50, padding: 16, alignItems: 'center' as const, marginTop: 8 },
  modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' as const },
  phoneOtpInput: {
    width: '100%' as any, padding: 14, borderWidth: 2, borderColor: '#F2EDE7',
    borderRadius: 12, fontSize: 18, backgroundColor: '#FBF9F6', color: '#1B2A3D',
    textAlign: 'center' as const, letterSpacing: 8, marginBottom: 8,
  },
})
