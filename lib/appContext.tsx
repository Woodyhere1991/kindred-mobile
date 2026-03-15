import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { KP_TIERS } from '../constants/theme'
import { supabase } from './supabase'
import { getMyItems, Item } from './items'
import { getConversations, Conversation } from './messages'
import { getNotifications, Notification, subscribeToNotifications } from './notifications'
import { expireStaleMatches } from './matches'

interface Profile {
  id: string
  display_name: string | null
  suburb: string | null
  avatar_url: string | null
  points: number
  id_verified: boolean
  completed_exchanges: number
  total_exchanges: number
  streak: number
  phone: string | null
  phone_verified: boolean
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  notification_push: boolean
  notification_email: boolean
  notification_matches: boolean
  is_admin: boolean
  is_premium: boolean
  mover_count: number
  lat: number | null
  lng: number | null
  home_address: string | null
}

interface AppState {
  // Auth
  userId: string | null
  isAuthenticated: boolean
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>
  isLoading: boolean

  // Profile
  profile: Profile | null
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>
  userName: string
  suburb: string
  points: number
  setPoints: React.Dispatch<React.SetStateAction<number>>
  idVerified: boolean
  setIdVerified: React.Dispatch<React.SetStateAction<boolean>>
  isAdmin: boolean
  isPremium: boolean
  myReliability: { completed: number; total: number; streak: number }

  // Items
  myItems: Item[]
  setMyItems: React.Dispatch<React.SetStateAction<Item[]>>
  itemsLoading: boolean

  // Conversations
  conversations: Conversation[]
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>

  // Notifications
  notifications: Notification[]
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>

  // Location
  userLat: number | null
  userLng: number | null

  // Computed
  currentTier: typeof KP_TIERS[number]
  nextTier: typeof KP_TIERS[number] | undefined
  tierProgress: number
  unreadNotifs: number
  totalUnreadMsgs: number

  // Verification
  emailVerified: boolean

  // Onboarding
  onboardingInProgress: boolean
  setOnboardingInProgress: React.Dispatch<React.SetStateAction<boolean>>
  profileIncomplete: boolean

  // Actions
  refreshItems: () => Promise<void>
  refreshConversations: () => Promise<void>
  refreshNotifications: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Profile
  const [profile, setProfile] = useState<Profile | null>(null)
  const [points, setPoints] = useState(0)
  const [idVerified, setIdVerified] = useState(false)

  // Email verification
  const [emailVerified, setEmailVerified] = useState(false)

  // Onboarding
  const [onboardingInProgress, setOnboardingInProgress] = useState(false)

  // Data
  const [myItems, setMyItems] = useState<Item[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])

  // Fetch profile from Supabase, creating it from auth metadata if missing
  const fetchProfile = useCallback(async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single()

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist yet — create from auth user metadata
        const { data: { user } } = await supabase.auth.getUser()
        const meta = user?.user_metadata
        if (meta) {
          const { error: insertErr } = await supabase.from('profiles').insert({
            id: uid,
            display_name: meta.display_name || meta.full_name || meta.name || null,
            dob: meta.dob || null,
            suburb: meta.suburb || null,
            home_address: meta.home_address || null,
            lat: meta.lat || null,
            lng: meta.lng || null,
            avatar_url: meta.avatar_url || null,
          })
          if (!insertErr) {
            // Re-fetch after creation
            const { data: newProfile } = await supabase
              .from('profiles').select('*').eq('id', uid).single()
            if (newProfile) {
              const p = newProfile as Profile
              setProfile(p)
              setPoints(p.points ?? 0)
              setIdVerified(p.id_verified ?? false)
            }
          } else {
            console.error('Failed to create profile:', insertErr)
          }
        }
        return
      }

      if (error) throw error
      if (data) {
        const p = data as Profile
        setProfile(p)
        setPoints(p.points ?? 0)
        setIdVerified(p.id_verified ?? false)
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err)
    }
  }, [])

  // Fetch items
  const refreshItems = useCallback(async () => {
    if (!userId) return
    setItemsLoading(true)
    try {
      const items = await getMyItems(userId)
      setMyItems(items)
    } catch (err) {
      console.error('Failed to fetch items:', err)
    } finally {
      setItemsLoading(false)
    }
  }, [userId])

  // Fetch conversations
  const refreshConversations = useCallback(async () => {
    if (!userId) return
    try {
      const convs = await getConversations(userId)
      setConversations(convs)
    } catch (err) {
      console.error('Failed to fetch conversations:', err)
    }
  }, [userId])

  // Fetch notifications
  const refreshNotifications = useCallback(async () => {
    if (!userId) return
    try {
      const notifs = await getNotifications(userId)
      setNotifications(notifs)
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    }
  }, [userId])

  // Refresh profile
  const refreshProfile = useCallback(async () => {
    if (!userId) return
    await fetchProfile(userId)
  }, [userId, fetchProfile])

  // Check auth state on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUserId(session.user.id)
        setIsAuthenticated(true)
        setEmailVerified(!!session.user.email_confirmed_at)
      }
      setIsLoading(false)
    }
    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUserId = session?.user?.id ?? null
      setUserId(newUserId)
      setIsAuthenticated(!!session)
      setEmailVerified(!!session?.user?.email_confirmed_at)
      if (!session) {
        // Clear data on logout
        setProfile(null)
        setMyItems([])
        setConversations([])
        setNotifications([])
        setPoints(0)
        setIdVerified(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Fetch all data when userId becomes available
  useEffect(() => {
    if (!userId) return

    fetchProfile(userId)
    refreshItems()
    refreshConversations()
    refreshNotifications()
    expireStaleMatches(userId)

    // Set up real-time notification subscription
    const notifChannel = subscribeToNotifications(userId, (notification) => {
      setNotifications(prev => [notification, ...prev])
    })

    // Subscribe to profile changes (e.g. admin toggling Plus)
    const profileChannel = supabase
      .channel(`profile-${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${userId}`,
      }, (payload) => {
        const updated = payload.new as Profile
        setProfile(updated)
        setPoints(updated.points ?? 0)
        setIdVerified(updated.id_verified ?? false)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(notifChannel)
      supabase.removeChannel(profileChannel)
    }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Profile completeness check (must have name)
  const profileIncomplete = !!profile && !profile.display_name

  // Computed values
  const rawName = profile?.display_name ?? ''
  const userName = rawName ? rawName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : ''
  const rawSuburb = profile?.suburb ?? ''
  const suburb = rawSuburb ? rawSuburb.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : ''
  const userLat = profile?.lat ?? null
  const userLng = profile?.lng ?? null
  const myReliability = {
    completed: profile?.completed_exchanges ?? 0,
    total: profile?.total_exchanges ?? 0,
    streak: profile?.streak ?? 0,
  }

  const currentTier = [...KP_TIERS].reverse().find(t => points >= t.min) || KP_TIERS[0]
  const nextTier = KP_TIERS.find(t => t.min > points)
  const tierProgress = nextTier
    ? ((points - currentTier.min) / (nextTier.min - currentTier.min)) * 100
    : 100

  const unreadNotifs = notifications.filter(n => !n.read_at).length
  const totalUnreadMsgs = conversations
    .filter(c => !c.blocked_by)
    .reduce((sum, c) => sum + (c.unread_count ?? 0), 0)

  return (
    <AppContext.Provider value={{
      userId,
      isAuthenticated, setIsAuthenticated,
      isLoading,
      profile, setProfile,
      userName, suburb, userLat, userLng,
      points, setPoints,
      idVerified, setIdVerified,
      isAdmin: profile?.is_admin ?? false,
      isPremium: profile?.is_premium ?? false,
      myReliability,
      myItems, setMyItems, itemsLoading,
      conversations, setConversations,
      notifications, setNotifications,
      emailVerified,
      onboardingInProgress, setOnboardingInProgress, profileIncomplete,
      currentTier, nextTier, tierProgress,
      unreadNotifs, totalUnreadMsgs,
      refreshItems, refreshConversations, refreshNotifications, refreshProfile,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
