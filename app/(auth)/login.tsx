import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, KeyboardAvoidingView,
  Platform, Alert,
} from 'react-native'
import { Link, router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import { Colors, Radius } from '../../constants/theme'
import { signIn } from '../../lib/auth'
import { useApp } from '../../lib/appContext'
import { supabase } from '../../lib/supabase'

// Email validation regex
const isValidEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export default function LoginScreen() {
  const { setIsAuthenticated } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing Information', 'Please enter both email and password')
      return
    }
    if (!isValidEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address')
      return
    }
    setLoading(true)
    try {
      await signIn(email, password)
      setIsAuthenticated(true)
      router.replace('/(tabs)')
    } catch (err: any) {
      const msg = err.message || ''
      if (msg.toLowerCase().includes('invalid login credentials')) {
        // No account with these credentials — offer to create one
        const goSignUp = Platform.OS === 'web'
          ? confirm("No account found with that email. Would you like to create one?")
          : await new Promise<boolean>(resolve =>
              Alert.alert(
                'No Account Found',
                "We couldn't find an account with that email. Would you like to create one?",
                [
                  { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                  { text: 'Create Account', onPress: () => resolve(true) },
                ],
              )
            )
        if (goSignUp) {
          router.push({ pathname: '/(auth)/onboarding', params: { prefillEmail: email, prefillPassword: password } })
        }
      } else {
        if (Platform.OS === 'web') {
          alert(msg)
        } else {
          Alert.alert('Sign In Error', msg)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  // Google Sign In
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    try {
      if (Platform.OS === 'web') {
        // On web, use Supabase's built-in OAuth redirect
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        })
        if (error) throw error
        // Supabase redirects the page — onAuthStateChange handles the rest
        return
      }

      // On native, use WebBrowser with proper redirect URI
      const redirectUri = makeRedirectUri()
      const { data } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      })

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri)
        if (result.type === 'success') {
          // Check for code in query params or hash fragment
          const url = new URL(result.url)
          const codeParam = url.searchParams.get('code') || new URLSearchParams(url.hash.slice(1)).get('code')
          if (!codeParam) {
            Alert.alert('Sign In Failed', 'Could not complete Google sign in. Please try again.')
            return
          }
          const { error } = await supabase.auth.exchangeCodeForSession(codeParam)
          if (error) {
            Alert.alert('Sign In Error', error.message)
          } else {
            setIsAuthenticated(true)
            router.replace('/(tabs)')
          }
        }
      }
    } catch (err: any) {
      Alert.alert('Google Sign In Error', err.message)
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Kindred</Text>
          <Text style={styles.subtitle}>The community app powered by kindness</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={Colors.greyLight}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={Colors.greyLight}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Sign In */}
          <TouchableOpacity
            style={[styles.googleBtn, googleLoading && styles.btnDisabled]}
            onPress={handleGoogleSignIn}
            disabled={googleLoading}
          >
            <Text style={styles.googleBtnText}>
              {googleLoading ? 'Connecting...' : 'Continue with Google'}
            </Text>
          </TouchableOpacity>

          <Link href="/(auth)/onboarding" asChild>
            <TouchableOpacity style={styles.secondaryBtn}>
              <Text style={styles.secondaryText}>Create Account</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/(auth)/forgot-password" asChild>
            <TouchableOpacity style={styles.forgotBtn}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  inner: { flex: 1, justifyContent: 'center', padding: 28 },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 38, fontWeight: '700', color: Colors.teal },
  subtitle: { fontSize: 15, color: Colors.grey, marginTop: 4 },
  form: { gap: 12 },
  input: {
    width: '100%',
    padding: 14,
    borderWidth: 2,
    borderColor: Colors.sand,
    borderRadius: Radius.sm,
    fontSize: 15,
    backgroundColor: '#fff',
    color: Colors.dark,
  },
  btn: {
    padding: 16,
    backgroundColor: Colors.teal,
    borderRadius: 50,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { backgroundColor: Colors.greyLight },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  secondaryBtn: {
    padding: 16,
    borderRadius: 50,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.sand,
  },
  secondaryText: { color: Colors.grey, fontSize: 15, fontWeight: '600' },
  forgotBtn: {
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  forgotText: { color: Colors.teal, fontSize: 14, fontWeight: '500' },
  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.sand },
  dividerText: { paddingHorizontal: 12, color: Colors.grey, fontSize: 12 },
  // Google button
  googleBtn: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 50,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.sand,
  },
  googleBtnText: { color: Colors.dark, fontSize: 15, fontWeight: '600' },
})
