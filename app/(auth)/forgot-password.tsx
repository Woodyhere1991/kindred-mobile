import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, KeyboardAvoidingView,
  Platform, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { Colors, Radius } from '../../constants/theme'
import { supabase } from '../../lib/supabase'

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleReset = async () => {
    if (!isValidEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) throw error
      Alert.alert(
        'Check Your Email',
        'If an account exists with that email, you will receive a password reset link.',
        [{ text: 'OK', onPress: () => router.back() }],
      )
    } catch (err: any) {
      Alert.alert('Error', err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter your email and we'll send you a link to reset your password.
          </Text>
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

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleReset}
            disabled={loading}
          >
            <Text style={styles.btnText}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  inner: { flex: 1, justifyContent: 'center', padding: 28 },
  header: { alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.teal },
  subtitle: { fontSize: 14, color: Colors.grey, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  form: { gap: 12 },
  input: {
    width: '100%', padding: 14, borderWidth: 2, borderColor: Colors.sand,
    borderRadius: Radius.sm, fontSize: 15, backgroundColor: '#fff', color: Colors.dark,
  },
  btn: {
    padding: 16, backgroundColor: Colors.teal, borderRadius: 50,
    alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { backgroundColor: Colors.greyLight },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  backBtn: { padding: 12, alignItems: 'center', marginTop: 8 },
  backText: { color: Colors.teal, fontSize: 14, fontWeight: '500' },
})
