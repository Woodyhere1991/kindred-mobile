import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { AppProvider, useApp } from '../lib/appContext'
import React, { useEffect } from 'react'

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error('App error:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errStyles.container}>
          <Text style={errStyles.emoji}>😕</Text>
          <Text style={errStyles.title}>Something went wrong</Text>
          <Text style={errStyles.desc}>The app ran into an unexpected error.</Text>
          <TouchableOpacity
            style={errStyles.btn}
            onPress={() => this.setState({ hasError: false })}
          >
            <Text style={errStyles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return this.props.children
  }
}

const errStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#FBF9F6' },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#1B2A3D', marginBottom: 8 },
  desc: { fontSize: 14, color: '#8B9AAD', textAlign: 'center', marginBottom: 24 },
  btn: { paddingHorizontal: 32, paddingVertical: 14, backgroundColor: '#1A9E8F', borderRadius: 50 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})

function AuthGuard() {
  const { isAuthenticated, isLoading, onboardingInProgress, profileIncomplete, emailVerified } = useApp()
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    if (isLoading) return

    const inAuthGroup = segments[0] === '(auth)'
    const onCompleteProfile = segments[0] === 'complete-profile'
    const onVerifyEmail = segments[0] === 'verify-email'

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (isAuthenticated && !emailVerified && !onVerifyEmail && !onboardingInProgress) {
      // Email not confirmed — gate access
      router.replace('/verify-email')
    } else if (isAuthenticated && emailVerified && onVerifyEmail) {
      // Email now confirmed — move on
      router.replace('/(tabs)')
    } else if (isAuthenticated && emailVerified && profileIncomplete && !onCompleteProfile && !onboardingInProgress) {
      router.replace('/complete-profile')
    } else if (isAuthenticated && emailVerified && !profileIncomplete && onCompleteProfile) {
      router.replace('/(tabs)')
    } else if (isAuthenticated && emailVerified && !profileIncomplete && inAuthGroup && !onboardingInProgress) {
      router.replace('/(tabs)')
    }
  }, [isAuthenticated, isLoading, segments, onboardingInProgress, profileIncomplete, emailVerified])

  return null
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <StatusBar style="dark" />
        <AuthGuard />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="verify-email" />
          <Stack.Screen name="complete-profile" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AppProvider>
    </ErrorBoundary>
  )
}
