import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Platform, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { Colors } from '../constants/theme'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/appContext'

export default function VerifyEmailScreen() {
  const { emailVerified } = useApp()
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [checking, setChecking] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  // Get the user's email on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email)
    })
  }, [])

  // Auto-advance when email gets verified (e.g. auth state change fires)
  useEffect(() => {
    if (emailVerified) {
      router.replace('/(tabs)')
    }
  }, [emailVerified])

  // Poll every 5 seconds to check if email was verified in browser
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.email_confirmed_at) {
          router.replace('/(tabs)')
        }
      } catch {}
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleResend = async () => {
    if (!userEmail) return
    setResending(true)
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: userEmail })
      if (error) throw error
      setResent(true)
    } catch (err: any) {
      const msg = err.message || 'Failed to resend email'
      if (Platform.OS === 'web') {
        alert(msg)
      } else {
        Alert.alert('Error', msg)
      }
    } finally {
      setResending(false)
    }
  }

  const handleCheckVerification = async () => {
    setChecking(true)
    try {
      // Refresh the session to pick up email confirmation
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      if (user?.email_confirmed_at) {
        router.replace('/(tabs)')
      } else {
        const msg = 'Email not yet verified. Please check your inbox and click the link.'
        if (Platform.OS === 'web') {
          alert(msg)
        } else {
          Alert.alert('Not Yet Verified', msg)
        }
      }
    } catch (err: any) {
      const msg = err.message || 'Could not check verification status'
      if (Platform.OS === 'web') {
        alert(msg)
      } else {
        Alert.alert('Error', msg)
      }
    } finally {
      setChecking(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/(auth)/login')
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.icon}>📧</Text>
        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.desc}>
          We've sent a verification link to{'\n'}
          <Text style={styles.email}>{userEmail || 'your email'}</Text>
        </Text>
        <Text style={styles.subdesc}>
          Please check your inbox (and spam folder) and click the link to continue.
        </Text>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleCheckVerification}
          disabled={checking}
        >
          <Text style={styles.primaryBtnText}>
            {checking ? 'Checking...' : "I've Verified My Email"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={handleResend}
          disabled={resending}
        >
          <Text style={styles.secondaryBtnText}>
            {resending ? 'Sending...' : resent ? 'Email Resent!' : 'Resend Verification Email'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  inner: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  icon: { fontSize: 56, marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.dark, marginBottom: 12 },
  desc: { fontSize: 15, color: Colors.grey, textAlign: 'center', lineHeight: 22 },
  email: { fontWeight: '600', color: Colors.teal },
  subdesc: {
    fontSize: 13, color: Colors.greyLight, textAlign: 'center',
    marginTop: 8, marginBottom: 32, lineHeight: 19,
  },
  primaryBtn: {
    width: '100%', padding: 16, backgroundColor: Colors.teal,
    borderRadius: 50, alignItems: 'center', marginBottom: 12,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  secondaryBtn: {
    width: '100%', padding: 16, borderRadius: 50, alignItems: 'center',
    borderWidth: 2, borderColor: Colors.sand, marginBottom: 12,
  },
  secondaryBtnText: { color: Colors.grey, fontSize: 15, fontWeight: '600' },
  signOutBtn: { padding: 12, marginTop: 8 },
  signOutText: { color: Colors.greyLight, fontSize: 14 },
})
