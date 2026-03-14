import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { Colors, Radius } from '../constants/theme'
import { useApp } from '../lib/appContext'
import { supabase } from '../lib/supabase'
import { containsProfanity, capitalizeName } from '../lib/profanityFilter'

export default function CompleteProfileScreen() {
  const { userId, profile, refreshProfile } = useApp()

  const [name, setName] = useState(profile?.display_name || '')
  const [dob, setDob] = useState('')
  const [suburb, setSuburb] = useState(profile?.suburb || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Auto-format DOB: insert slashes as user types digits
  const handleDobChange = (text: string) => {
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

  // Validate DOB format DD/MM/YYYY and age >= 18
  const parseDob = (d: string) => {
    const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!m) return null
    const day = parseInt(m[1]), month = parseInt(m[2]), year = parseInt(m[3])
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    const date = new Date(year, month - 1, day)
    const age = (Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    if (age < 18) return null
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const handleSave = async () => {
    setError('')

    if (!name.trim()) {
      setError('Please enter your name')
      return
    }
    if (containsProfanity(name)) {
      setError('Please choose an appropriate name')
      return
    }
    if (!dob.trim()) {
      setError('Please enter your date of birth')
      return
    }
    const parsedDob = parseDob(dob)
    if (!parsedDob) {
      setError('Please enter a valid date (DD/MM/YYYY). You must be 18 or older.')
      return
    }
    if (!suburb.trim()) {
      setError('Please enter your suburb')
      return
    }

    setSaving(true)
    try {
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          display_name: capitalizeName(name),
          dob: parsedDob,
          suburb: suburb.trim(),
        })
        .eq('id', userId!)

      if (updateErr) throw updateErr

      await refreshProfile()
      router.replace('/(tabs)')
    } catch (err: any) {
      setError(err.message || 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Welcome to Kindred!</Text>
            <Text style={styles.subtitle}>Let's finish setting up your profile</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Your name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your name"
              placeholderTextColor={Colors.greyLight}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <Text style={styles.label}>Date of birth</Text>
            <TextInput
              style={styles.input}
              placeholder="DD/MM/YYYY"
              placeholderTextColor={Colors.greyLight}
              value={dob}
              onChangeText={handleDobChange}
              keyboardType="number-pad"
              maxLength={10}
            />
            <Text style={styles.hint}>You must be 18 or older to use Kindred</Text>

            <Text style={styles.label}>Suburb</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Mt Eden, Auckland"
              placeholderTextColor={Colors.greyLight}
              value={suburb}
              onChangeText={setSuburb}
              autoCapitalize="words"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.btn, saving && styles.btnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.btnText}>{saving ? 'Saving...' : 'Complete Setup'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  inner: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  header: { alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.teal },
  subtitle: { fontSize: 15, color: Colors.grey, marginTop: 6 },
  form: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.dark, marginTop: 12 },
  input: {
    width: '100%',
    padding: 14,
    borderWidth: 2,
    borderColor: Colors.sand,
    borderRadius: Radius.sm,
    fontSize: 15,
    backgroundColor: '#fff',
    color: Colors.dark,
    marginTop: 4,
  },
  hint: { fontSize: 12, color: Colors.grey, marginTop: 2 },
  error: { fontSize: 14, color: Colors.red, marginTop: 8, textAlign: 'center' },
  btn: {
    padding: 16,
    backgroundColor: Colors.teal,
    borderRadius: 50,
    alignItems: 'center',
    marginTop: 20,
  },
  btnDisabled: { backgroundColor: Colors.greyLight },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
