import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, Image, Modal, Alert, Platform,
  RefreshControl, ActivityIndicator,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { Colors, CATEGORY_ICONS, Category, KP_TIERS, getTierIcon } from '../../constants/theme'
import { useApp } from '../../lib/appContext'
import { createItem, updateItemStatus, updateItem, browseItems, uploadItemPhoto, findSmartMatches, BrowseItem, autoCategory, Item, getExchangeReceipts, ExchangeReceipt } from '../../lib/items'
import { createMatch, updateMatchStatus, getPendingMatchForUser, getPendingOffersForItem, acceptOffer, withdrawOffer, holdOffer, releaseHold, cancelMatchAndRelist, getPendingOfferCounts, getOutgoingOffers, uploadOfferPhoto, PendingOffer, OutgoingOffer } from '../../lib/matches'
import { createConversation, sendMessage } from '../../lib/messages'
import { markAllRead, markNotificationRead, createNotification } from '../../lib/notifications'
import { supabase } from '../../lib/supabase'
import { submitReport, REPORT_CATEGORIES } from '../../lib/reports'
import { relLevel, formatDate, STEPS_GIVE, STEPS_NEED, STEP_INDEX } from '../../lib/utils'
import { getCurrentLocation, formatDistance, getDistanceKm } from '../../lib/location'
import { cleanupAfterExchange } from '../../lib/exchangeCleanup'
import { confirmExchange, finalizeExchange, getMatchConfirmationStates, ConfirmationState } from '../../lib/exchangeCompletion'
import { getPublicProfile, getReliabilityStats, PublicProfile, ReliabilityStats } from '../../lib/profileViewer'

const showAlert = (title: string, msg: string) => {
  if (Platform.OS === 'web') {
    alert(`${title}\n${msg}`)
  } else {
    Alert.alert(title, msg)
  }
}

const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s

export default function ActivityScreen() {
  const {
    userId, points, setPoints, myItems, setMyItems, refreshItems,
    notifications, setNotifications, refreshNotifications, refreshConversations,
    currentTier, unreadNotifs, suburb, userLat, userLng, profile, userName, isPremium, myReliability,
  } = useApp()

  const [subTab, setSubTab] = useState<'activity' | 'nearby'>('activity')
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState<'give' | 'need'>('give')
  const [formName, setFormName] = useState('')
  const [formNote, setFormNote] = useState('')
  const [formUrgency, setFormUrgency] = useState<'whenever' | 'soon' | 'urgent'>('whenever')
  const [formAvailable, setFormAvailable] = useState('This week')
  const [formCategory, setFormCategory] = useState<Category>('other')
  const [formFoodChecked, setFormFoodChecked] = useState(false)
  const [formHoldMode, setFormHoldMode] = useState<'first_come' | 'happy_to_hold'>('first_come')
  const [holdPickerOffer, setHoldPickerOffer] = useState<PendingOffer | null>(null)
  const [detailItem, setDetailItem] = useState<Item | BrowseItem | null>(null)
  const [browseFilter, setBrowseFilter] = useState('all')
  const [browseType, setBrowseType] = useState<'all' | 'give' | 'need'>('all')
  const [browseLocationMode, setBrowseLocationMode] = useState<'home' | 'current'>('home')
  const [showNotifs, setShowNotifs] = useState(false)
  const [celebrate, setCelebrate] = useState<Item | null>(null)
  const [browseItems_, setBrowseItems] = useState<BrowseItem[]>([])
  const [browseLoading, setBrowseLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formPhotos, setFormPhotos] = useState<string[]>([])
  const [requesting, setRequesting] = useState<string | null>(null)
  const [ratingItem, setRatingItem] = useState<Item | null>(null)
  const [ratingStars, setRatingStars] = useState(5)
  const [ratingTags, setRatingTags] = useState<string[]>([])
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [ratingProximity, setRatingProximity] = useState<{ verified: boolean; distanceM: number | null }>({ verified: false, distanceM: null })
  const [browseRadius, setBrowseRadius] = useState(5)
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null)
  const [browseSearch, setBrowseSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [offerCounts, setOfferCounts] = useState<Record<string, number>>({})
  const [viewingOffersItem, setViewingOffersItem] = useState<Item | null>(null)
  const [pendingOffers, setPendingOffers] = useState<PendingOffer[]>([])
  const [offersLoading, setOffersLoading] = useState(false)
  const [myPendingOfferIds, setMyPendingOfferIds] = useState<Record<string, string>>({})
  const [smartMatches, setSmartMatches] = useState<BrowseItem[]>([])
  const [showSmartMatches, setShowSmartMatches] = useState(false)
  const [itemMatchCounts, setItemMatchCounts] = useState<Record<string, BrowseItem[]>>({})
  const [matchCheckDone, setMatchCheckDone] = useState(false)
  const [offerMessage, setOfferMessage] = useState('')
  const [offerPhotos, setOfferPhotos] = useState<string[]>([])
  const [offerSubmitting, setOfferSubmitting] = useState(false)
  const [myOutgoingOffers, setMyOutgoingOffers] = useState<OutgoingOffer[]>([])
  const [outgoingLoading, setOutgoingLoading] = useState(false)
  const [editItem, setEditItem] = useState<Item | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editCategory, setEditCategory] = useState<Category>('other')
  const [editHoldMode, setEditHoldMode] = useState<'first_come' | 'happy_to_hold'>('first_come')
  const [editUrgency, setEditUrgency] = useState<'whenever' | 'soon' | 'urgent'>('whenever')
  const [editAvailable, setEditAvailable] = useState('This week')
  const [editSaving, setEditSaving] = useState(false)
  const [matchConfirmations, setMatchConfirmations] = useState<Record<string, ConfirmationState>>({})
  const [confirmingItem, setConfirmingItem] = useState<string | null>(null)
  const [exchangeHistory, setExchangeHistory] = useState<ExchangeReceipt[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)

  const [ratedItemIds, setRatedItemIds] = useState<Set<string>>(new Set())
  const [viewingProfile, setViewingProfile] = useState<PublicProfile | null>(null)
  const [viewingProfileStats, setViewingProfileStats] = useState<ReliabilityStats | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [dismissedOfferIds, setDismissedOfferIds] = useState<Set<string>>(new Set())

  const openProfile = async (profileUserId: string) => {
    if (profileUserId === userId) return // don't show own profile
    setProfileLoading(true)
    setViewingProfile(null)
    setViewingProfileStats(null)
    try {
      const [profile, stats] = await Promise.all([
        getPublicProfile(profileUserId),
        getReliabilityStats(profileUserId),
      ])
      setViewingProfile(profile)
      setViewingProfileStats(stats)
    } catch (err) {
      console.error('Failed to load profile:', err)
    } finally {
      setProfileLoading(false)
    }
  }

  useEffect(() => {
    if (formName.length > 2) {
      const cat = autoCategory(formName)
      setFormCategory(cat)
      if (cat !== 'food') setFormFoodChecked(false)
    }
  }, [formName])

  // Auto-check for matches on listed items (Plus only)
  const checkForMatches = useCallback(async () => {
    if (!isPremium || !userId) return
    const listedItems = myItems.filter(i => i.status === 'listed')
    if (listedItems.length === 0) return
    const results: Record<string, BrowseItem[]> = {}
    for (const item of listedItems) {
      try {
        const matches = await findSmartMatches(item)
        if (matches.length > 0) results[item.id] = matches
      } catch {}
    }
    setItemMatchCounts(results)
    setMatchCheckDone(true)
  }, [isPremium, userId, myItems])

  // Run match check on initial load and when items change
  useEffect(() => {
    if (isPremium && myItems.length > 0 && !matchCheckDone) {
      checkForMatches()
    }
  }, [isPremium, myItems.length, matchCheckDone, checkForMatches])

  // Periodic re-check every 60 seconds while app is open
  useEffect(() => {
    if (!isPremium) return
    const interval = setInterval(() => {
      checkForMatches()
    }, 60000)
    return () => clearInterval(interval)
  }, [isPremium, checkForMatches])

  const pickPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5 - formPhotos.length,
      quality: 0.7,
    })
    if (!result.canceled) {
      setFormPhotos(prev => [...prev, ...result.assets.map(a => a.uri)].slice(0, 5))
    }
  }

  const pickOfferPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 3 - offerPhotos.length,
      quality: 0.7,
    })
    if (!result.canceled) {
      setOfferPhotos(prev => [...prev, ...result.assets.map(a => a.uri)].slice(0, 3))
    }
  }

  // Load browse items when switching to browse tab
  const loadBrowseItems = useCallback(async () => {
    if (!suburb || !userId) return
    setBrowseLoading(true)
    try {
      let lat: number | null = null
      let lng: number | null = null
      if (browseLocationMode === 'current') {
        // Use live GPS, fall back to home coords
        const loc = await getCurrentLocation()
        if (loc) { lat = loc.lat; lng = loc.lng }
        else { lat = userLat; lng = userLng }
      } else {
        // Use home coords from profile
        lat = userLat; lng = userLng
      }

      const items = await browseItems({
        suburb,
        lat,
        lng,
        radiusKm: browseRadius,
        category: browseFilter !== 'all' ? browseFilter as Category : undefined,
        search: browseSearch.trim() || undefined,
        userId: userId || undefined,
      })
      setBrowseItems(items)
      // Load user's pending offers for these items
      if (items.length > 0 && userId) {
        try {
          const { data: myOffers } = await supabase
            .from('matches')
            .select('id, item_id')
            .or(`giver_id.eq.${userId},receiver_id.eq.${userId}`)
            .in('status', ['pending', 'accepted'])
            .in('item_id', items.map(i => i.id))
          const offerMap: Record<string, string> = {}
          for (const o of myOffers || []) offerMap[o.item_id] = o.id
          setMyPendingOfferIds(offerMap)
        } catch {}
      } else {
        setMyPendingOfferIds({})
      }
    } catch (err) {
      console.error('Failed to load browse items:', err)
    } finally {
      setBrowseLoading(false)
    }
  }, [suburb, browseFilter, userId, browseRadius, userLat, userLng, browseSearch, browseLocationMode])

  useEffect(() => {
    if (subTab === 'nearby') loadBrowseItems()
  }, [subTab, browseFilter, browseRadius, loadBrowseItems])

  // Debounce search
  useEffect(() => {
    if (subTab !== 'nearby') return
    const timer = setTimeout(() => loadBrowseItems(), 500)
    return () => clearTimeout(timer)
  }, [browseSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load offer counts for my listed items
  useEffect(() => {
    const listedIds = myItems.filter(i => i.status === 'listed').map(i => i.id)
    if (listedIds.length > 0) {
      getPendingOfferCounts(listedIds).then(setOfferCounts).catch(() => {})
    } else {
      setOfferCounts({})
    }
  }, [myItems])

  // Load outgoing offers when filter selected
  // Load outgoing offers on mount + when filter selected
  useEffect(() => {
    if (userId) {
      const doLoad = () => {
        setOutgoingLoading(true)
        getOutgoingOffers(userId).then(setMyOutgoingOffers).catch(err => console.error('Failed to load outgoing requests:', err)).finally(() => setOutgoingLoading(false))
      }
      doLoad()
    }
  }, [userId])

  const reloadOfferCounts = async () => {
    const listedIds = myItems.filter(i => i.status === 'listed').map(i => i.id)
    if (listedIds.length > 0) {
      const counts = await getPendingOfferCounts(listedIds)
      setOfferCounts(counts)
    } else {
      setOfferCounts({})
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      if (subTab === 'activity') {
        await refreshItems()
        await reloadOfferCounts()
        if (userId) getOutgoingOffers(userId).then(setMyOutgoingOffers).catch(err => console.error('Failed to load outgoing requests:', err))
        // Re-fetch confirmation states for matched items
        const matchedIds = myItems.filter(i => i.status === 'matched').map(i => i.id)
        if (matchedIds.length > 0) getMatchConfirmationStates(matchedIds).then(setMatchConfirmations).catch(console.error)
        // Re-check matches for Plus users on refresh
        if (isPremium) checkForMatches()
      }
      else if (subTab === 'nearby') await loadBrowseItems()
    } finally {
      setRefreshing(false)
    }
  }

  const todayListings = myItems.filter(i => {
    const created = new Date(i.created_at)
    const today = new Date()
    return created.toDateString() === today.toDateString()
  }).length

  const activeItems = myItems.filter(i => i.status !== 'completed')
  // Fetch confirmation states for matched items (initial + poll every 15s)
  // Auto-finalizes exchange when both sides have confirmed
  useEffect(() => {
    const fetchConfirmations = async () => {
      const matchedItems = myItems.filter(i => i.status === 'matched')
      const matchedIds = matchedItems.map(i => i.id)
      if (matchedIds.length === 0) return
      const states = await getMatchConfirmationStates(matchedIds).catch(() => ({} as Record<string, ConfirmationState>))
      setMatchConfirmations(states)

      // Auto-complete: if both sides confirmed, finalize the exchange automatically
      for (const item of matchedItems) {
        const s = states[item.id]
        if (!s) continue
        if (s.giverConfirmed && s.receiverConfirmed) {
          try {
            const { proximityVerified, distanceM } = await finalizeExchange(s.matchId, item.id)
            setMyItems(prev => prev.map(i => i.id !== item.id ? i : { ...i, status: 'completed' as Item['status'] }))
            setRatingProximity({ verified: proximityVerified, distanceM })
            setRatingItem({ ...item, status: 'completed' as Item['status'] })
            setRatingStars(5)
            setRatingTags([])

            // Notify partner
            const myRole = userId === s.giverId ? 'giver' : 'receiver'
            const partnerId = myRole === 'giver' ? s.receiverId : s.giverId
            if (partnerId) {
              createNotification({
                user_id: partnerId,
                type: 'match',
                title: 'Exchange complete!',
                body: `Both confirmed for "${cap(item.title)}" — Kindness Points awarded!`,
                item_id: item.id,
              }).catch(console.error)
            }
          } catch (err) {
            console.error('Auto-finalize failed:', err)
          }
        }
      }

      // Check if any matched items were completed by the other person (match no longer 'accepted')
      for (const itemId of matchedIds) {
        const prev = matchConfirmations[itemId]
        if (prev && !states[itemId]) {
          await refreshItems()
          break
        }
      }
    }
    fetchConfirmations()
    const interval = setInterval(fetchConfirmations, 15000)
    return () => clearInterval(interval)
  }, [myItems])

  // Poll outgoing offers confirmation state every 15s (for receiver-side UI)
  // Auto-finalizes exchange when both sides have confirmed
  useEffect(() => {
    const hasAccepted = myOutgoingOffers.some(o => o.status === 'accepted')
    if (!hasAccepted || !userId) return
    const interval = setInterval(async () => {
      try {
        const fresh = await getOutgoingOffers(userId)
        setMyOutgoingOffers(fresh)

        // Auto-complete any offers where both sides confirmed
        for (const offer of fresh) {
          if (offer.status !== 'accepted') continue
          const iConfirmed = userId === offer.giver_id ? !!offer.giver_confirmed_at : !!offer.receiver_confirmed_at
          const theyConfirmed = userId === offer.giver_id ? !!offer.receiver_confirmed_at : !!offer.giver_confirmed_at
          if (iConfirmed && theyConfirmed) {
            const { proximityVerified, distanceM } = await finalizeExchange(offer.id, offer.item_id)
            setRatingProximity({ verified: proximityVerified, distanceM })
            const myRole = userId === offer.giver_id ? 'giver' : 'receiver'
            setRatingItem({
              id: offer.item_id, title: offer.item_title, type: offer.item_type,
              category: offer.item_category as any, other_person_id: myRole === 'giver' ? offer.receiver_id : offer.giver_id,
              user_id: '', status: 'completed', note: null, urgency: null, available_until: null,
              food_expiry: null, is_large_item: false, needs_mover: false, offer_in_return: null,
              handover_type: null, drop_point: null, drop_time: null, match_expiry: null,
              suburb: '', lat: null, lng: null, created_at: offer.created_at, hold_mode: 'first_come', updated_at: offer.created_at,
            } as Item)
            setRatingStars(5)
            setRatingTags([])
            setMyOutgoingOffers(prev => prev.map(o => o.id !== offer.id ? o : { ...o, status: 'completed' as any }))

            const partnerId = myRole === 'giver' ? offer.receiver_id : offer.giver_id
            createNotification({
              user_id: partnerId,
              type: 'match',
              title: 'Exchange complete!',
              body: `Both confirmed for "${cap(offer.item_title)}" — Kindness Points awarded!`,
              item_id: offer.item_id,
            }).catch(console.error)
          }
        }
      } catch (err) {
        console.error('Offer poll error:', err)
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [myOutgoingOffers, userId])

  // Detect newly completed items (completed by partner) and show rating modal
  // Only triggers for items completed externally (not by auto-complete which handles its own rating modal)
  // Check DB for existing reliability record to avoid duplicate prompts across reloads
  useEffect(() => {
    if (!userId || ratingItem) return
    const completedUnrated = myItems.find(i => i.status === 'completed' && !ratedItemIds.has(i.id) && i.other_person_id)
    if (!completedUnrated) return

    // Check if user already rated this specific exchange
    supabase.from('reliability')
      .select('id')
      .eq('user_id', userId)
      .eq('partner_id', completedUnrated.other_person_id)
      .eq('item_id', completedUnrated.id)
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setRatedItemIds(prev => new Set(prev).add(completedUnrated.id))
          return
        }
        // Also check points_log for rating points
        supabase.from('points_log')
          .select('id')
          .eq('user_id', userId)
          .eq('item_id', completedUnrated.id)
          .like('action', 'for rating%')
          .limit(1)
          .then(({ data: pointsData }) => {
            if (pointsData && pointsData.length > 0) {
              setRatedItemIds(prev => new Set(prev).add(completedUnrated.id))
            } else if (!ratingItem) {
              setRatingItem({ ...completedUnrated, status: 'completed' as Item['status'] })
              setRatingStars(5)
              setRatingTags([])
            }
          })
      })
  }, [myItems, userId])



  // Load exchange history when toggled on, or refresh when an item completes
  const completedCount = myItems.filter(i => i.status === 'completed').length
  useEffect(() => {
    if (!showHistory || !userId) return
    getExchangeReceipts(userId).then(data => {
      setExchangeHistory(data)
      setHistoryLoaded(true)
    }).catch(console.error)
  }, [showHistory, userId, completedCount]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmitForm = async () => {
    if (!formName.trim() || !userId) return
    if (!userName || userName.trim() === '') {
      showAlert('Name Required', 'Please set your name in Profile before listing items.')
      return
    }
    setSubmitting(true)
    try {
      const newItem = await createItem({
        user_id: userId,
        type: formType,
        title: formName.charAt(0).toUpperCase() + formName.slice(1),
        category: formCategory,
        note: formNote || undefined,
        urgency: formType === 'need' ? formUrgency : undefined,
        available_until: formType === 'give' ? formAvailable : undefined,
        hold_mode: formType === 'give' ? formHoldMode : undefined,
        suburb: suburb,
        lat: userLat ?? undefined,
        lng: userLng ?? undefined,
      })
      // Upload photos if any
      if (formPhotos.length > 0 && userId) {
        try {
          for (let i = 0; i < formPhotos.length; i++) {
            await uploadItemPhoto(userId, newItem.id, formPhotos[i], i)
          }
          // Refresh to get photos
          await refreshItems()
        } catch (photoErr) {
          console.error('Failed to upload photos:', photoErr)
        }
      } else {
        setMyItems(prev => [newItem, ...prev])
      }
      // Award listing points (5 KP, or 10 KP for Plus members)
      const listingKP = isPremium ? 10 : 5
      try {
        await supabase.rpc('award_listing_points', { user_uuid: userId, points_to_add: listingKP })
        setPoints(p => p + listingKP)
        // Log to persistent points feed
        await supabase.from('points_log').insert({
          user_id: userId,
          item_id: newItem.id,
          item_title: newItem.title,
          item_type: newItem.type,
          action: `for listing ${newItem.title}${isPremium ? ' (2x Plus bonus)' : ''}`,
          points: listingKP,
        })
      } catch (err: any) {
        if (err?.message?.includes('DAILY_LIMIT_REACHED')) {
          const limit = currentTier.dailyLimit
          showAlert('Daily Limit', `You've reached your daily listing limit (${limit}/day). Upgrade to Kindred Plus for unlimited listings!`)
        } else {
          console.error('Failed to award points:', err)
        }
      }
      // Smart match: find complementary items nearby (Plus only)
      if (isPremium) try {
        const matches = await findSmartMatches(newItem)
        if (matches.length > 0) {
          setItemMatchCounts(prev => ({ ...prev, [newItem.id]: matches }))
          try {
            // Notify the listing creator
            await createNotification({
              user_id: userId,
              type: 'match',
              title: 'Potential matches found!',
              body: `We found ${matches.length} ${newItem.type === 'give' ? 'people who need' : 'items available'} near you that match "${cap(newItem.title)}"`,
              item_id: newItem.id,
            })
            // Also notify the other side — let them know someone nearby has what they need (or needs what they have)
            for (const match of matches) {
              try {
                await createNotification({
                  user_id: match.user_id,
                  type: 'match',
                  title: newItem.type === 'give' ? 'Someone nearby is giving away what you need!' : 'Someone nearby needs what you have!',
                  body: `"${cap(newItem.title)}" was just listed near you`,
                  item_id: match.id,
                })
              } catch {}
            }
            await refreshNotifications()
          } catch {}
        }
      } catch {}
      // Reset form
      setFormName(''); setFormNote('')
      setFormFoodChecked(false)
      setFormHoldMode('first_come')
      setFormPhotos([]); setShowForm(false)
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to create item')
    } finally {
      setSubmitting(false)
    }
  }

  const advanceItem = async (id: string) => {
    const item = myItems.find(i => i.id === id)
    if (!item) return

    // Listed → Matched: simple status change (no mutual confirmation needed)
    if (item.status === 'listed') {
      try {
        await updateItemStatus(id, 'matched')
        setMyItems(prev => prev.map(i => i.id !== id ? i : { ...i, status: 'matched' as Item['status'] }))
      } catch (err: any) {
        showAlert('Error', err.message || 'Failed to update item')
      }
      return
    }

    // Matched → mutual confirmation flow
    if (item.status !== 'matched') return
    const conf = matchConfirmations[id]
    if (!conf) { showAlert('Error', 'Could not find match data'); return }

    setConfirmingItem(id)
    try {
      // Grab GPS (best-effort)
      const location = await getCurrentLocation()

      // Determine role
      const role: 'giver' | 'receiver' = userId === conf.giverId ? 'giver' : 'receiver'

      // Record this side's confirmation
      const result = await confirmExchange(conf.matchId, userId!, role, location)

      if (result.bothConfirmed) {
        // Both confirmed — finalize
        const { proximityVerified, distanceM } = await finalizeExchange(conf.matchId, id)
        setMyItems(prev => prev.map(i => i.id !== id ? i : { ...i, status: 'completed' as Item['status'] }))

        // Store proximity data for rating handler
        setRatingProximity({ verified: proximityVerified, distanceM })

        // Open rating modal with completed status so points are awarded
        setRatingItem({ ...item, status: 'completed' as Item['status'] })
        setRatingStars(5)
        setRatingTags([])

        // Notify the first confirmer that exchange is complete
        const partnerId = role === 'giver' ? conf.receiverId : conf.giverId
        if (partnerId) {
          createNotification({
            user_id: partnerId,
            type: 'match',
            title: 'Exchange complete!',
            body: `Both confirmed for "${cap(item.title)}" — Kindness Points awarded!`,
            item_id: item.id,
          }).catch(console.error)
        }
      } else {
        // Only one side confirmed — update local state to show waiting UI
        setMatchConfirmations(prev => ({
          ...prev,
          [id]: {
            ...conf,
            ...(role === 'giver' ? { giverConfirmed: true } : { receiverConfirmed: true }),
          },
        }))

        // Notify partner to confirm
        const partnerId = role === 'giver' ? conf.receiverId : conf.giverId
        if (partnerId) {
          createNotification({
            user_id: partnerId,
            type: 'match',
            title: `${userName || 'Your exchange partner'} confirmed`,
            body: `Tap to confirm your side and complete "${cap(item.title)}"`,
            item_id: item.id,
          }).catch(console.error)
        }

        // No rating modal yet — wait until both sides confirm
        showAlert('Confirmed!', `Waiting for ${result.partnerName || 'the other person'} to confirm their side. You'll rate and earn Kindness Points once they confirm.`)
      }
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to confirm exchange')
    } finally {
      setConfirmingItem(null)
    }
  }

  const declineMatch = async (id: string) => {
    const item = myItems.find(i => i.id === id)
    const doDecline = async () => {
      try {
        // Find and cancel the accepted match
        const { data: matches } = await supabase
          .from('matches')
          .select('id, giver_id, receiver_id')
          .eq('item_id', id)
          .eq('status', 'accepted')
        if (matches && matches.length > 0) {
          await cancelMatchAndRelist(id, matches[0].id)
          // Notify the other person
          const otherUserId = matches[0].giver_id === userId ? matches[0].receiver_id : matches[0].giver_id
          try {
            await createNotification({
              user_id: otherUserId,
              type: 'match',
              title: 'Exchange cancelled',
              body: `The exchange for "${cap(item?.title || 'an item')}" was cancelled by the owner.`,
              item_id: id,
            })
          } catch {}
        } else {
          await updateItem(id, { status: 'listed', other_person_id: null, match_expiry: null })
        }
        setMyItems(prev => prev.map(i => i.id === id ? { ...i, status: 'listed', other_person_id: null, match_expiry: null } : i))
      } catch (err: any) {
        showAlert('Error', err.message || 'Failed to cancel match')
      }
    }
    if (Platform.OS === 'web') {
      if (confirm('Cancel & re-list? The item will go back to listed for new requests.')) doDecline()
    } else {
      Alert.alert('Cancel & Re-list', 'The other person will be notified. Your item will be available for new requests.', [
        { text: 'Keep Match', style: 'cancel' },
        { text: 'Cancel & Re-list', style: 'destructive', onPress: doDecline },
      ])
    }
  }

  const removeItem = async (id: string) => {
    const doRemove = async () => {
      try {
        await updateItemStatus(id, 'cancelled')
        setMyItems(prev => prev.filter(x => x.id !== id))
      } catch (err: any) {
        showAlert('Error', err.message || 'Failed to remove item')
      }
    }
    if (Platform.OS === 'web') {
      if (confirm('Remove this listing?')) doRemove()
    } else {
      Alert.alert('Remove Listing', 'Are you sure you want to remove this?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: doRemove },
      ])
    }
  }

  const openEditItem = (item: Item) => {
    setEditItem(item)
    setEditTitle(item.title)
    setEditNote(item.note || '')
    setEditCategory(item.category)
    setEditHoldMode(item.hold_mode || 'first_come')
    setEditUrgency(item.urgency || 'whenever')
    setEditAvailable(item.available_until || 'This week')
  }

  const handleSaveEdit = async () => {
    if (!editItem || !editTitle.trim()) return
    setEditSaving(true)
    try {
      const updates: Record<string, any> = {
        title: editTitle.trim().charAt(0).toUpperCase() + editTitle.trim().slice(1),
        note: editNote.trim() || null,
        category: editCategory,
      }
      if (editItem.type === 'give') {
        updates.hold_mode = editHoldMode
        updates.available_until = editAvailable
      }
      if (editItem.type === 'need') {
        updates.urgency = editUrgency
      }
      await updateItem(editItem.id, updates)
      setMyItems(prev => prev.map(i => i.id === editItem.id ? { ...i, ...updates } : i))
      setEditItem(null)
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to save changes')
    } finally {
      setEditSaving(false)
    }
  }

  const handleViewOffers = async (item: Item) => {
    setViewingOffersItem(item)
    setOffersLoading(true)
    try {
      const offers = await getPendingOffersForItem(item.id)
      setPendingOffers(offers)
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to load requests')
    } finally {
      setOffersLoading(false)
    }
  }

  const handleAcceptOffer = async (offer: PendingOffer) => {
    if (!viewingOffersItem || !userId) return
    try {
      const acceptedUserId = offer.receiver_id === userId ? offer.giver_id : offer.receiver_id
      await acceptOffer(viewingOffersItem.id, offer.id, acceptedUserId)
      // Create conversation now (for need items this is the first time)
      await createConversation(userId, acceptedUserId, viewingOffersItem.id, offer.id)
      // Notify accepted user
      try {
        await createNotification({
          user_id: acceptedUserId,
          type: 'match',
          title: 'Request accepted!',
          body: `Your request for "${cap(viewingOffersItem.title)}" was accepted! You can now message each other.`,
          item_id: viewingOffersItem.id,
          match_id: offer.id,
        })
      } catch {}
      // Notify declined users
      const declinedOffers = pendingOffers.filter(o => o.id !== offer.id)
      for (const declined of declinedOffers) {
        const declinedUserId = declined.receiver_id === userId ? declined.giver_id : declined.receiver_id
        try {
          await createNotification({
            user_id: declinedUserId,
            type: 'match',
            title: 'Request update',
            body: `Your request for "${cap(viewingOffersItem.title)}" wasn't selected this time. Keep browsing!`,
            item_id: viewingOffersItem.id,
            match_id: declined.id,
          })
        } catch {}
      }
      // Refresh data BEFORE clearing modal state
      await refreshItems()
      await refreshConversations()
      // Now clear modal and navigate
      setViewingOffersItem(null)
      setPendingOffers([])
      setSubTab('activity')
      showAlert('Request Accepted', 'Your item is now matched! Chat in Messages to arrange the exchange.')
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to accept request')
    }
  }

  const doDeclineOffer = async (offer: PendingOffer, alsoBlock?: boolean) => {
    if (!viewingOffersItem || !userId) return
    try {
      await updateMatchStatus(offer.id, 'declined')
      const declinedUserId = offer.receiver_id === userId ? offer.giver_id : offer.receiver_id
      try {
        await createNotification({
          user_id: declinedUserId,
          type: 'match',
          title: 'Request update',
          body: `Your request for "${cap(viewingOffersItem.title)}" wasn't selected this time. Keep browsing!`,
          item_id: viewingOffersItem.id,
          match_id: offer.id,
        })
      } catch {}
      if (alsoBlock) {
        await supabase.from('user_blocks').insert({ blocker_id: userId, blocked_id: declinedUserId })
      }
      setPendingOffers(prev => prev.filter(o => o.id !== offer.id))
      setOfferCounts(prev => ({ ...prev, [viewingOffersItem.id]: Math.max(0, (prev[viewingOffersItem.id] || 1) - 1) }))
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to decline request')
    }
  }

  const handleDeclineOffer = async (offer: PendingOffer) => {
    if (!viewingOffersItem || !userId) return
    if (Platform.OS === 'web') {
      if (confirm('Decline this request?')) doDeclineOffer(offer)
    } else {
      Alert.alert('Decline Request', 'This person will be notified their request wasn\'t selected.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Decline', style: 'destructive', onPress: () => doDeclineOffer(offer) },
        { text: 'Decline & Block', style: 'destructive', onPress: () => doDeclineOffer(offer, true) },
      ])
    }
  }

  const handleBlockFromOffer = (offer: PendingOffer) => {
    if (!userId) return
    const otherUserId = offer.receiver_id === userId ? offer.giver_id : offer.receiver_id
    const doBlock = async () => {
      try {
        await supabase.from('user_blocks').insert({ blocker_id: userId, blocked_id: otherUserId })
        showAlert('Blocked', 'This user can no longer request your items.')
      } catch (err: any) {
        showAlert('Error', err.message || 'Failed to block user')
      }
    }
    if (Platform.OS === 'web') {
      if (confirm('Block this user? They won\'t be able to request your items.')) doBlock()
    } else {
      Alert.alert('Block User', 'They won\'t be able to request your items.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: doBlock },
      ])
    }
  }

  const handleReportFromOffer = (offer: PendingOffer) => {
    if (!userId) return
    const otherUserId = offer.receiver_id === userId ? offer.giver_id : offer.receiver_id
    if (Platform.OS === 'web') {
      const reason = prompt('Report User\nEnter a reason:\n' + REPORT_CATEGORIES.join(', '))
      if (reason) {
        submitReport({ reporter_id: userId, reported_user_id: otherUserId, category: reason, item_id: viewingOffersItem?.id })
          .then(() => alert('Report submitted. Our team will review this.'))
          .catch((err: any) => alert(err.message || 'Failed to submit report'))
      }
      return
    }
    Alert.alert('Report User', 'Select a reason:', [
      ...REPORT_CATEGORIES.map(cat => ({
        text: cat,
        onPress: async () => {
          try {
            await submitReport({ reporter_id: userId, reported_user_id: otherUserId, category: cat, item_id: viewingOffersItem?.id })
            Alert.alert('Report Submitted', 'Thank you. Our team will review this.')
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to submit report')
          }
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const handleSubmitRating = async () => {
    if (!ratingItem || !userId) return
    setRatingSubmitting(true)
    try {
      // Check if user already rated this specific exchange (prevent duplicate ratings)
      const { data: existingRating } = await supabase.from('reliability')
        .select('id')
        .eq('user_id', userId)
        .eq('partner_id', ratingItem.other_person_id)
        .eq('item_id', ratingItem.id)
        .limit(1)
      if (existingRating && existingRating.length > 0) {
        // Already rated — just close modal
        setRatedItemIds(prev => new Set(prev).add(ratingItem.id))
        setRatingItem(null)
        setRatingProximity({ verified: false, distanceM: null })
        return
      }

      // Save the reliability record
      await supabase.from('reliability').insert({
        user_id: userId,
        partner_id: ratingItem.other_person_id,
        item_id: ratingItem.id,
        completed: true,
        rating: ratingStars,
        tags: ratingTags,
      })

      // Award rating points (+5 KP, or +10 for Plus)
      const ratingKP = isPremium ? 10 : 5
      try {
        await supabase.rpc('award_points', { user_uuid: userId, points_to_add: ratingKP })
        setPoints(p => p + ratingKP)
        await supabase.from('points_log').insert({
          user_id: userId,
          item_id: ratingItem.id,
          item_title: ratingItem.title,
          item_type: ratingItem.type,
          action: `for rating exchange${isPremium ? ' (2x Plus bonus)' : ''}`,
          points: ratingKP,
        })
      } catch (err) {
        console.error('Failed to award rating points:', err)
      }

      // Check if exchange is fully completed (both sides confirmed)
      const bothConfirmed = ratingItem.status === 'completed'

      if (bothConfirmed) {
        // Determine role: item owner is giver for 'give' items, receiver for 'need' items
        const iAmOwner = userId === ratingItem.user_id
        const iAmGiver = ratingItem.type === 'give' ? iAmOwner : !iAmOwner
        const myBasePoints = iAmGiver ? 25 : 5
        const partnerBasePoints = iAmGiver ? 5 : 25

        // Award completion points (+25 for giver, +5 for receiver, doubled for Plus)
        // Check for existing points_log to prevent duplicate awards
        const { data: myExistingPoints } = await supabase.from('points_log')
          .select('id')
          .eq('user_id', userId)
          .eq('item_id', ratingItem.id)
          .like('action', 'for %')
          .limit(1)
        if (!myExistingPoints || myExistingPoints.length === 0) {
          const completionPoints = isPremium ? myBasePoints * 2 : myBasePoints
          try {
            await supabase.rpc('award_completion_points', { user_uuid: userId, points_to_add: completionPoints })
            setPoints(p => p + completionPoints)
            await supabase.from('points_log').insert({
              user_id: userId,
              item_id: ratingItem.id,
              item_title: ratingItem.title,
              item_type: ratingItem.type,
              action: (iAmGiver ? `for giving ${cap(ratingItem.title)}` : `for receiving ${cap(ratingItem.title)}`) + (isPremium ? ' (2x Plus bonus)' : ''),
              points: completionPoints,
            })
          } catch (err) {
            console.error('Failed to award points:', err)
          }
        }

        // Also award points to the partner who confirmed first (their points were deferred)
        if (ratingItem.other_person_id) {
          try {
            // Check if partner is a Plus member for 2x multiplier
            const { data: partnerProfile } = await supabase.from('profiles').select('is_premium').eq('id', ratingItem.other_person_id).single()
            const partnerIsPremium = partnerProfile?.is_premium || false
            const partnerPoints = partnerIsPremium ? partnerBasePoints * 2 : partnerBasePoints
            // Check if partner already got points by looking at points_log
            const { data: existingLog } = await supabase
              .from('points_log')
              .select('id')
              .eq('user_id', ratingItem.other_person_id)
              .eq('item_id', ratingItem.id)
              .like('action', 'for %')
              .limit(1)
            if (!existingLog || existingLog.length === 0) {
              await supabase.rpc('award_completion_points', { user_uuid: ratingItem.other_person_id, points_to_add: partnerPoints })
              await supabase.from('points_log').insert({
                user_id: ratingItem.other_person_id,
                item_id: ratingItem.id,
                item_title: ratingItem.title,
                item_type: ratingItem.type,
                action: iAmGiver ? `for receiving ${cap(ratingItem.title)}` : `for giving ${cap(ratingItem.title)}`,
                points: partnerPoints,
              })
            }
          } catch (err) {
            console.error('Failed to award partner points:', err)
          }
        }

        // First Exchange Bonus (+50 KP one-time) — check points_log to prevent duplicates
        if (myReliability.completed === 0) {
          const { data: existingFirstBonus } = await supabase.from('points_log')
            .select('id').eq('user_id', userId).like('action', 'First exchange bonus%').limit(1)
          if (!existingFirstBonus || existingFirstBonus.length === 0) {
            try {
              const firstBonus = isPremium ? 100 : 50
              await supabase.rpc('award_points', { user_uuid: userId, points_to_add: firstBonus })
              setPoints(p => p + firstBonus)
              await supabase.from('points_log').insert({
                user_id: userId,
                item_id: ratingItem.id,
                item_title: ratingItem.title,
                item_type: ratingItem.type,
                action: `First exchange bonus! Welcome to the community${isPremium ? ' (2x Plus bonus)' : ''}`,
                points: firstBonus,
              })
            } catch (err) {
              console.error('Failed to award first exchange bonus:', err)
            }
          }
        }

        // Notify partner they were rated (for non-5-star — 5-star gets its own notification below)
        if (ratingStars < 5 && ratingItem.other_person_id) {
          createNotification({
            user_id: ratingItem.other_person_id,
            type: 'match',
            title: 'Exchange rated',
            body: `${userName || 'Your exchange partner'} rated your exchange for "${cap(ratingItem.title)}"`,
            item_id: ratingItem.id,
          }).catch(console.error)
        }

        // Thank You Bonus — 5-star rating awards partner +10 KP (check for duplicates)
        if (ratingStars === 5 && ratingItem.other_person_id) {
          const { data: existingThankYou } = await supabase.from('points_log')
            .select('id').eq('user_id', ratingItem.other_person_id).eq('item_id', ratingItem.id)
            .like('action', '5-star review%').limit(1)
          if (!existingThankYou || existingThankYou.length === 0) {
            try {
              await supabase.rpc('award_points', { user_uuid: ratingItem.other_person_id, points_to_add: 10 })
              await supabase.from('points_log').insert({
                user_id: ratingItem.other_person_id,
                item_id: ratingItem.id,
                item_title: ratingItem.title,
                item_type: ratingItem.type,
                action: `5-star review from ${userName || 'a neighbour'}`,
                points: 10,
              })
              await createNotification({
                user_id: ratingItem.other_person_id,
                type: 'match',
                title: 'You got a 5-star review!',
                body: `${userName || 'Someone'} gave you 5 stars — you earned +10 Kindness Points!`,
                item_id: ratingItem.id,
              })
            } catch (err) {
              console.error('Failed to award thank you bonus:', err)
            }
          }
        }

        // Clean up heavy data and save receipt
        const receiptBasePoints = ratingItem.type === 'give' ? 25 : 5
        const totalEarned = isPremium ? receiptBasePoints * 2 : receiptBasePoints
        let otherName = ''
        if (ratingItem.other_person_id) {
          const { data: otherProfile } = await supabase.from('profiles').select('display_name').eq('id', ratingItem.other_person_id).single()
          otherName = otherProfile?.display_name || ''
        }
        cleanupAfterExchange({
          itemId: ratingItem.id,
          itemTitle: ratingItem.title,
          itemType: ratingItem.type,
          category: ratingItem.category,
          userId,
          userName: userName || undefined,
          otherUserId: ratingItem.other_person_id,
          otherUserName: otherName,
          rating: ratingStars,
          pointsEarned: totalEarned,
          proximityVerified: ratingProximity.verified,
          proximityDistanceM: ratingProximity.distanceM,
        }).catch(err => console.error('Cleanup error:', err))
      }

      setRatedItemIds(prev => new Set(prev).add(ratingItem.id))
      setRatingItem(null)
      setRatingProximity({ verified: false, distanceM: null })
      setCelebrate(ratingItem)
          } catch (err: any) {
      showAlert('Error', err.message || 'Failed to submit rating')
    } finally {
      setRatingSubmitting(false)
    }
  }

  const handleRequestItem = async (item: BrowseItem, offerMessage?: string, photos?: string[]) => {
    if (!userId) return
    if (item.user_id === userId) {
      showAlert('Oops', "You can't request your own item.")
      return
    }
    if (!userName || userName.trim() === '') {
      showAlert('Name Required', 'Please set your name in Profile before requesting items.')
      return
    }
    // Check if item owner has blocked this user
    const { data: blockCheck } = await supabase.from('user_blocks')
      .select('id').eq('blocker_id', item.user_id).eq('blocked_id', userId).limit(1)
    if (blockCheck && blockCheck.length > 0) {
      showAlert('Unable to Request', 'This item is no longer available to you.')
      return
    }
    // Check for duplicate offer
    const existing = await getPendingMatchForUser(item.id, userId)
    if (existing) {
      showAlert('Already Requested', "You've already requested this item.")
      return
    }
    const isNeed = item.type === 'need'
    setRequesting(item.id)
    if (isNeed) setOfferSubmitting(true)
    try {
      // Swap roles for need items: viewer is the giver
      const giverId = isNeed ? userId : item.user_id
      const receiverId = isNeed ? item.user_id : userId
      const match = await createMatch(item.id, giverId, receiverId, offerMessage)

      // Upload offer photos for need items
      if (isNeed && photos && photos.length > 0) {
        for (let i = 0; i < photos.length; i++) {
          await uploadOfferPhoto(userId, match.id, photos[i], i)
        }
      }

      // Conversation created when giver accepts the offer (not at request time)

      // Notify the item owner
      try {
        await createNotification({
          user_id: item.user_id,
          type: 'match',
          title: 'New offer!',
          body: isNeed
            ? `${userName} has something for your "${cap(item.title)}" — check it out!`
            : `${userName} is interested in your "${cap(item.title)}"`,
          item_id: item.id,
          match_id: match.id,
        })
      } catch {}
      await refreshConversations()
      await refreshNotifications()
      const ownerName = item.profiles?.display_name || 'the owner'
      if (isNeed) {
        showAlert('Offer Sent!', `${ownerName} will review what you're offering. If they're keen, you'll be connected in Messages.`)
      } else {
        showAlert('Request Sent!', `${ownerName} will review your request for "${cap(item.title)}". You'll be notified when they respond.`)
      }
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to send offer')
    } finally {
      setRequesting(null)
      setOfferSubmitting(false)
      setOfferPhotos([])
      // Refresh outgoing requests list
      if (userId) getOutgoingOffers(userId).then(setMyOutgoingOffers).catch(() => {})
    }
  }

  const handleMarkAllNotifsRead = async () => {
    if (!userId) return
    try {
      await markAllRead(userId)
      setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })))
    } catch (err) {
      console.error('Failed to mark all read:', err)
    }
    setShowNotifs(false)
  }

  const handleNotifTap = async (notif: typeof notifications[0]) => {
    try {
      await markNotificationRead(notif.id)
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n))
    } catch (err) {
      console.error('Failed to mark notification read:', err)
    }
    setShowNotifs(false)

    switch (notif.type) {
      case 'message':
        router.push('/(tabs)/messages')
        break
      case 'points':
        router.push('/(tabs)/points')
        break
      case 'match':
      case 'claimed':
      case 'arranged':
      case 'reminder':
        if (notif.item_id) {
          try {
            const { data } = await supabase
              .from('items')
              .select('*, item_photos(id, public_url, position)')
              .eq('id', notif.item_id)
              .single()
            if (data) setDetailItem(data as Item)
          } catch (err) {
            console.error('Failed to load item for notification:', err)
          }
        }
        break
      default:
        break
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Kindred</Text>
          <Text style={styles.headerSub}>The community app powered by kindness</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setShowNotifs(true)} style={styles.bellBtn}>
            <Text style={styles.bellIcon}>🔔</Text>
            {unreadNotifs > 0 && (
              <View style={styles.bellBadge}><Text style={styles.bellBadgeText}>{unreadNotifs}</Text></View>
            )}
          </TouchableOpacity>
          <View style={styles.kpBadge}>
            <Text style={styles.kpText}>{currentTier.icon} {points}</Text>
          </View>
        </View>
      </View>

      {/* Sub tabs */}
      <View style={styles.subTabs}>
        {(['activity', 'nearby'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.subTab, subTab === t && styles.subTabActive]} onPress={() => setSubTab(t)}>
            <Text style={[styles.subTabText, subTab === t && styles.subTabTextActive]}>
              {t === 'activity' ? 'My Activity' : 'Nearby'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 80 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1A9E8F" />}>
        {/* ── MY ACTIVITY ── */}
        {subTab === 'activity' && (
          <>
            {!showForm && (
              <View style={styles.actionGrid}>
                <TouchableOpacity style={styles.actionCard} onPress={() => { setShowForm(true); setFormType('give') }}>
                  <Text style={styles.actionIcon}>📦</Text>
                  <Text style={styles.actionLabel}>I Have Something</Text>
                  <Text style={styles.actionDesc}>Give it away</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionCard} onPress={() => { setShowForm(true); setFormType('need') }}>
                  <Text style={styles.actionIcon}>🙏</Text>
                  <Text style={styles.actionLabel}>I Need Something</Text>
                  <Text style={styles.actionDesc}>Ask the community</Text>
                </TouchableOpacity>
              </View>
            )}

            {showForm && (
              <View style={styles.addForm}>
                <View style={styles.formToggle}>
                  <TouchableOpacity style={[styles.formToggleBtn, formType === 'give' && styles.formToggleBtnActive]} onPress={() => setFormType('give')}>
                    <Text style={[styles.formToggleBtnText, formType === 'give' && styles.formToggleBtnTextActive]}>Giving</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.formToggleBtn, formType === 'need' && styles.formToggleBtnActive]} onPress={() => setFormType('need')}>
                    <Text style={[styles.formToggleBtnText, formType === 'need' && styles.formToggleBtnTextActive]}>Need</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.formLabel}>{formType === 'give' ? 'What are you giving?' : 'What do you need?'}</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder={formType === 'give' ? 'e.g. Winter jacket, tins of beans' : 'e.g. Nappies, help with moving'}
                  placeholderTextColor="#C8D1DC"
                  value={formName}
                  onChangeText={setFormName}
                  autoFocus
                  maxLength={80}
                />
                {formName.length > 60 && <Text style={{ fontSize: 11, color: formName.length >= 80 ? '#C53030' : '#8B9AAD', textAlign: 'right' }}>{formName.length}/80</Text>}
                {formName.length > 2 && (
                  <View style={styles.autoCat}>
                    <Text style={styles.autoCatText}>{CATEGORY_ICONS[formCategory as Category] || '📦'} Auto-detected: {formCategory}</Text>
                  </View>
                )}

                {/* Photo picker */}
                <Text style={styles.formLabel}>Photos (optional)</Text>
                <View style={styles.photoRow}>
                  {formPhotos.map((uri, i) => (
                    <View key={i} style={styles.photoThumb}>
                      <Image source={{ uri }} style={styles.photoThumbImg} />
                      <TouchableOpacity style={styles.photoRemove} onPress={() => setFormPhotos(prev => prev.filter((_, j) => j !== i))}>
                        <Text style={styles.photoRemoveText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  {formPhotos.length < 5 && (
                    <TouchableOpacity style={styles.photoAddBtn} onPress={pickPhotos}>
                      <Text style={styles.photoAddIcon}>📷</Text>
                      <Text style={styles.photoAddText}>{formPhotos.length === 0 ? 'Add' : '+'}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {formCategory === 'food' && formType === 'give' && (
                  <TouchableOpacity
                    style={[styles.foodCheckRow]}
                    onPress={() => setFormFoodChecked(!formFoodChecked)}
                  >
                    <View style={[styles.checkBox, formFoodChecked && styles.checkBoxOn]}>
                      {formFoodChecked && <Text style={styles.checkMark}>✓</Text>}
                    </View>
                    <Text style={styles.foodCheckText}>I confirm this food is safe and not expired</Text>
                  </TouchableOpacity>
                )}

                {formType === 'need' && (
                  <>
                    <Text style={styles.formLabel}>How Urgent?</Text>
                    <View style={styles.urgencyRow}>
                      {[{ id: 'whenever', i: '😊', l: 'Whenever' }, { id: 'soon', i: '⏰', l: 'Soon' }, { id: 'urgent', i: '⚡', l: 'Urgent' }].map(u => (
                        <TouchableOpacity key={u.id} style={[styles.urgBtn, formUrgency === u.id && styles.urgBtnActive]} onPress={() => setFormUrgency(u.id as any)}>
                          <Text style={styles.urgIcon}>{u.i}</Text>
                          <Text style={[styles.urgLabel, formUrgency === u.id && styles.urgLabelActive]}>{u.l}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                {formType === 'give' && (
                  <View style={styles.availRow}>
                    {['Today only', 'This week', '2 weeks', 'Ongoing'].map(t => (
                      <TouchableOpacity key={t} style={[styles.filterBtn, formAvailable === t && styles.filterBtnActive]} onPress={() => setFormAvailable(t)}>
                        <Text style={[styles.filterBtnText, formAvailable === t && styles.filterBtnTextActive]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {formType === 'give' && (
                  <>
                    <Text style={styles.formLabel}>If multiple people want it...</Text>
                    <View style={styles.urgencyRow}>
                      <TouchableOpacity
                        style={[styles.urgBtn, formHoldMode === 'first_come' && styles.urgBtnActive]}
                        onPress={() => setFormHoldMode('first_come')}
                      >
                        <Text style={[styles.urgLabel, formHoldMode === 'first_come' && styles.urgLabelActive]}>First in, first served</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.urgBtn, formHoldMode === 'happy_to_hold' && styles.urgBtnActive]}
                        onPress={() => setFormHoldMode('happy_to_hold')}
                      >
                        <Text style={[styles.urgLabel, formHoldMode === 'happy_to_hold' && styles.urgLabelActive]}>Happy to hold</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                <Text style={styles.formLabel}>Notes (optional)</Text>
                <TextInput style={styles.formInput} placeholder="Any extra details" placeholderTextColor="#C8D1DC" value={formNote} onChangeText={setFormNote} maxLength={200} multiline />
                {formNote.length > 150 && <Text style={{ fontSize: 11, color: formNote.length >= 200 ? '#C53030' : '#8B9AAD', textAlign: 'right' }}>{formNote.length}/200</Text>}

                {!isPremium && todayListings >= currentTier.dailyLimit - 1 && (
                  <Text style={{ fontSize: 12, color: todayListings >= currentTier.dailyLimit ? '#C53030' : '#8B9AAD', textAlign: 'center', marginBottom: 6 }}>
                    {todayListings >= currentTier.dailyLimit
                      ? `Daily limit reached (${currentTier.dailyLimit}/day) — upgrade to Plus for unlimited!`
                      : `${todayListings} of ${currentTier.dailyLimit} listings used today`}
                  </Text>
                )}

                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={[styles.itemBtn, styles.itemBtnPrimary]}
                    onPress={handleSubmitForm}
                    disabled={!formName.trim() || submitting || (formCategory === 'food' && formType === 'give' && !formFoodChecked)}
                  >
                    <Text style={styles.itemBtnPrimaryText}>
                      {submitting ? 'Posting...' : `List (+5 Kindness Points)`}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.itemBtn, styles.itemBtnSecondary]} onPress={() => setShowForm(false)}>
                    <Text style={styles.itemBtnSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── MY LISTINGS ── */}
            <Text style={styles.sectionTitle}>My Listings</Text>

            {activeItems.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyText}>No active items. Tap above to give something away or post what you need.</Text>
              </View>
            )}

            <Text style={{ fontSize: 13, fontWeight: '600', color: '#6BA368', marginBottom: 8, marginTop: 4 }}>🎁 Giving Away ({activeItems.filter(i => i.type === 'give').length})</Text>
            {activeItems.filter(i => i.type === 'give').length === 0 && (
              <Text style={{ fontSize: 12, color: '#8B9AAD', marginBottom: 8 }}>Nothing listed yet</Text>
            )}
            {[...activeItems.filter(i => i.type === 'give'), '__NEED_HEADER__' as any, ...activeItems.filter(i => i.type === 'need')].map((item, idx) => {
              if (item === '__NEED_HEADER__') {
                return (
                  <React.Fragment key="__need_header__">
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#7B9ACC', marginBottom: 8, marginTop: 12 }}>🙏 Things I Need ({activeItems.filter(i => i.type === 'need').length})</Text>
                    {activeItems.filter(i => i.type === 'need').length === 0 && (
                      <Text style={{ fontSize: 12, color: '#8B9AAD', marginBottom: 8 }}>Nothing listed yet</Text>
                    )}
                  </React.Fragment>
                )
              }
              const steps = item.type === 'give' ? STEPS_GIVE : STEPS_NEED
              const si = STEP_INDEX[item.status] || 0
              const photos = item.item_photos || []

              const matchesForItem = itemMatchCounts[item.id] || []

              return (
                <View key={item.id} style={[styles.itemCard, item.type === 'give' ? styles.itemCardGive : styles.itemCardNeed, item.status === 'completed' && styles.itemCardDone]}>
                  <View style={styles.itemBody}>
                    {/* Match banner */}
                    {matchesForItem.length > 0 && item.status === 'listed' && (
                      <TouchableOpacity
                        style={styles.matchBanner}
                        onPress={() => { setSmartMatches(matchesForItem); setShowSmartMatches(true) }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.matchBannerText}>{matchesForItem.length} {matchesForItem.length === 1 ? 'match' : 'matches'} found nearby</Text>
                        <Text style={styles.matchBannerArrow}>View ›</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity activeOpacity={0.7} onPress={() => openEditItem(item)}>
                    <View style={styles.itemTopRow}>
                      {photos.length > 0 ? (
                        <TouchableOpacity onPress={() => setEnlargedPhoto(photos[0].public_url)}>
                          <Image source={{ uri: photos[0].public_url }} style={styles.itemPhoto} />
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.itemPhotoPlaceholder}>
                          <Text style={styles.itemPhotoIcon}>{CATEGORY_ICONS[item.category as Category] || '📦'}</Text>
                        </View>
                      )}
                      <View style={styles.itemTopInfo}>
                        <View style={styles.itemHeader}>
                          <Text style={styles.itemName}>{cap(item.title)}</Text>
                          <View style={[styles.itemTypeBadge, item.type === 'give' ? styles.itemTypeBadgeGive : styles.itemTypeBadgeNeed]}>
                            <Text style={[styles.itemTypeBadgeText, item.type === 'give' ? styles.itemTypeBadgeTextGive : styles.itemTypeBadgeTextNeed]}>{item.type === 'give' ? 'Give' : 'Need'}</Text>
                          </View>
                          {(() => {
                            const sc: Record<string, { bg: string; text: string; label: string }> = {
                              listed: { bg: '#F3F4F6', text: '#6B7280', label: 'Listed' },
                              matched: { bg: '#E6F7F5', text: Colors.teal, label: 'Matched' },
                              completed: { bg: '#DCFCE7', text: '#16A34A', label: 'Done' },
                            }
                            const s = sc[item.status]
                            return s ? <View style={{ backgroundColor: s.bg, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 10, fontWeight: '700', color: s.text }}>{s.label}</Text></View> : null
                          })()}
                        </View>
                        <Text style={styles.itemMeta}>{formatDate(item.created_at)}{item.urgency === 'urgent' ? ' · ⚡ Urgent' : item.urgency === 'soon' ? ' · ⏰ Soon' : ''}</Text>
                        {item.status !== 'completed' && (
                          <Text style={{ fontSize: 12, color: '#8B9AAD', marginTop: 3, fontStyle: 'italic' }}>
                            {item.status === 'listed' ? (item.type === 'give' ? 'Waiting for someone who needs this' : (isPremium ? 'Looking for nearby matches...' : 'Browse nearby to find what you need')) :
                             item.status === 'matched' ? 'Chat in Messages to arrange the exchange' : ''}
                          </Text>
                        )}
                        <Text style={{ fontSize: 11, color: Colors.teal, marginTop: 4 }}>Tap to edit</Text>
                      </View>
                    </View>
                    </TouchableOpacity>

                    {item.status !== 'completed' && item.status !== 'listed' && (
                      <>
                        <View style={styles.stepper}>
                          {steps.map((s, i) => (
                            <View key={i} style={styles.stepItem}>
                              <View style={[styles.stepDot, i < si && styles.stepDotDone, i === si && styles.stepDotActive]}>
                                <Text style={styles.stepDotText}>{i < si ? '✓' : ''}</Text>
                              </View>
                              {i < steps.length - 1 && <View style={[styles.stepLine, i < si && styles.stepLineDone]} />}
                            </View>
                          ))}
                        </View>
                        <View style={styles.stepLabels}>
                          {steps.map((s, i) => (
                            <Text key={i} style={[styles.stepLabel, i === si && styles.stepLabelActive, i < si && styles.stepLabelDone]}>{s}</Text>
                          ))}
                        </View>
                      </>
                    )}

                    {item.note && <View style={styles.itemNote}><Text style={styles.itemNoteText}>{item.note}</Text></View>}
                    {item.offer_in_return && <View style={styles.itemOffer}><Text style={styles.itemOfferText}>Offering: {item.offer_in_return}</Text></View>}

                  </View>

                  {/* Item actions */}
                  <View style={styles.itemActions}>
                    {item.status === 'listed' && (
                      <>
                        {(offerCounts[item.id] || 0) > 0 ? (
                          <TouchableOpacity style={[styles.itemBtn, styles.itemBtnPrimary, { flex: 1 }]} onPress={() => handleViewOffers(item)}>
                            <Text style={styles.itemBtnPrimaryText}>{offerCounts[item.id]} {offerCounts[item.id] === 1 ? 'person interested — View Request' : 'people interested — View Requests'}</Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={[styles.itemBtn, styles.itemBtnSecondary, { flex: 1 }]}>
                            <Text style={styles.itemBtnSecondaryText}>{item.type === 'give' ? 'No takers yet — someone will need this soon!' : (isPremium ? 'No offers yet — we\'re looking for nearby matches' : 'No offers yet — browse nearby to find what you need')}</Text>
                          </View>
                        )}
                        <TouchableOpacity style={[styles.itemBtn, styles.itemBtnDanger]} onPress={() => removeItem(item.id)}>
                          <Text style={styles.itemBtnDangerText}>Remove</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {item.status === 'matched' && (() => {
                      const conf = matchConfirmations[item.id]
                      const myRole: 'giver' | 'receiver' = userId === conf?.giverId ? 'giver' : 'receiver'
                      const iConfirmed = conf ? (myRole === 'giver' ? conf.giverConfirmed : conf.receiverConfirmed) : false
                      const theyConfirmed = conf ? (myRole === 'giver' ? conf.receiverConfirmed : conf.giverConfirmed) : false
                      const isConfirming = confirmingItem === item.id

                      const doSafeCheckAndComplete = () => {
                        const doComplete = () => advanceItem(item.id)
                        if (Platform.OS === 'web') {
                          if (confirm('Safe Check-in\nDid the exchange go well and you felt safe?\n\nClick OK to confirm, or Cancel if something wasn\'t right.')) {
                            doComplete()
                          } else {
                            alert('Support\nCrisis: 1737\nEmergency: 111\n\nYou can also report this person from Messages.')
                          }
                        } else {
                          Alert.alert(
                            'Safe Check-in',
                            'Did the exchange go well and you felt safe?',
                            [
                              { text: 'All Good — Confirm', onPress: doComplete },
                              { text: 'Something Wasn\'t Right', style: 'destructive', onPress: () => {
                                Alert.alert('Get Help', 'Crisis helpline: 1737\nEmergency: 111\n\nYou can also report this person from Messages.', [
                                  { text: 'Confirm Anyway', onPress: doComplete },
                                  { text: 'Cancel', style: 'cancel' },
                                ])
                              }},
                              { text: 'Not Yet', style: 'cancel' },
                            ]
                          )
                        }
                      }

                      return (
                        <>
                          <TouchableOpacity style={[styles.itemBtn, styles.itemBtnPrimary, { flex: 1 }]} onPress={() => router.navigate('/(tabs)/messages')}>
                            <Text style={styles.itemBtnPrimaryText}>Message Them</Text>
                          </TouchableOpacity>

                          {iConfirmed ? (
                            <View style={[styles.itemBtn, { backgroundColor: '#F3F4F6', flex: 1 }]}>
                              <Text style={{ textAlign: 'center', color: '#8B9AAD', fontWeight: '600', fontSize: 13 }}>
                                {theyConfirmed ? 'Completing...' : 'Waiting for them to confirm...'}
                              </Text>
                            </View>
                          ) : theyConfirmed ? (
                            <TouchableOpacity
                              style={[styles.itemBtn, { backgroundColor: '#DCFCE7', flex: 1, borderWidth: 2, borderColor: '#16A34A' }]}
                              onPress={doSafeCheckAndComplete}
                              disabled={isConfirming}
                            >
                              <Text style={{ textAlign: 'center', color: '#16A34A', fontWeight: '700', fontSize: 13 }}>
                                {isConfirming ? 'Confirming...' : 'They confirmed — Mark Complete'}
                              </Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              style={[styles.itemBtn, { backgroundColor: '#DCFCE7', flex: 1 }]}
                              onPress={doSafeCheckAndComplete}
                              disabled={isConfirming}
                            >
                              <Text style={{ textAlign: 'center', color: '#16A34A', fontWeight: '700', fontSize: 13 }}>
                                {isConfirming ? 'Confirming...' : 'Mark Complete'}
                              </Text>
                            </TouchableOpacity>
                          )}

                          <TouchableOpacity style={[styles.itemBtn, styles.itemBtnDanger]} onPress={() => {
                            if (iConfirmed) {
                              const msg = 'You already confirmed. Cancel anyway and re-list the item? The other person will be notified.'
                              if (Platform.OS === 'web') {
                                if (confirm(msg)) declineMatch(item.id)
                              } else {
                                Alert.alert('Cancel Exchange?', msg, [
                                  { text: 'Keep Waiting', style: 'cancel' },
                                  { text: 'Cancel & Re-list', style: 'destructive', onPress: () => declineMatch(item.id) },
                                ])
                              }
                            } else {
                              declineMatch(item.id)
                            }
                          }}>
                            <Text style={styles.itemBtnDangerText}>Cancel & Re-list</Text>
                          </TouchableOpacity>
                        </>
                      )
                    })()}
                    {item.status === 'completed' && (
                      <View style={[styles.itemBtn, styles.itemBtnSecondary, { flex: 1 }]}>
                        <Text style={styles.itemBtnSecondaryText}>✅ Completed — +{item.type === 'give' ? 30 : 10} Kindness Points earned</Text>
                      </View>
                    )}
                  </View>
                </View>
              )
            })}


            {/* ── SENT OFFERS ── */}
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>My Requests</Text>

            {outgoingLoading && <View style={styles.emptyState}><ActivityIndicator color="#1A9E8F" size="large" /></View>}
            {!outgoingLoading && myOutgoingOffers.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📨</Text>
                <Text style={styles.emptyText}>No requests yet. Browse items nearby and request something!</Text>
              </View>
            )}
            {/* Active requests (pending, held, accepted) */}
            {!outgoingLoading && (() => {
              const active = myOutgoingOffers.filter(o => ['pending', 'held', 'accepted'].includes(o.status))
              const past = myOutgoingOffers.filter(o => ['completed', 'declined'].includes(o.status))
              return (
                <>
                  {active.map(offer => {
                    const statusColors: Record<string, { bg: string; text: string; label: string }> = {
                      pending: { bg: '#FFF8E1', text: '#F59E0B', label: 'Pending' },
                      held: { bg: '#FFF3CD', text: '#D97706', label: 'On hold' },
                      accepted: { bg: '#E6F7EF', text: '#059669', label: 'Accepted' },
                    }
                    const sc = statusColors[offer.status] || statusColors.pending
                    const ownerName = cap(offer.owner_profile?.display_name || offer.owner_name || 'Someone nearby')
                    const ownerId = offer.giver_id === userId ? offer.receiver_id : offer.giver_id
                    const ownerAvatar = offer.owner_profile?.avatar_url
                    const ownerInitial = ownerName.charAt(0).toUpperCase()
                    const requestDate = new Date(offer.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
                    return (
                      <View key={offer.id} style={[styles.itemCard, offer.item_type === 'give' ? styles.itemCardGive : styles.itemCardNeed]}>
                        <View style={styles.itemBody}>
                          {/* Person row */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <TouchableOpacity onPress={() => openProfile(ownerId)}>
                              {ownerAvatar ? (
                                <Image source={{ uri: ownerAvatar }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                              ) : (
                                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.teal, alignItems: 'center', justifyContent: 'center' }}>
                                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{ownerInitial}</Text>
                                </View>
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity style={{ flex: 1 }} onPress={() => openProfile(ownerId)}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                <Text style={{ fontSize: 11 }}>{getTierIcon(offer.owner_profile?.points ?? 0)}</Text>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1A9E8F' }}>{ownerName}</Text>
                                {offer.owner_profile?.is_premium && <Text style={{ fontSize: 11, color: '#D97706' }}>⭐Plus</Text>}
                              </View>
                              <Text style={{ fontSize: 10, color: '#B0BEC5' }}>View profile</Text>
                            </TouchableOpacity>
                            <View style={{ backgroundColor: sc.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: sc.text }}>{sc.label}</Text>
                            </View>
                          </View>
                          {/* Item row */}
                          <View style={styles.itemTopRow}>
                            {offer.photo_url ? (
                              <Image source={{ uri: offer.photo_url }} style={styles.itemPhoto} />
                            ) : (
                              <View style={styles.itemPhotoPlaceholder}>
                                <Text style={styles.itemPhotoIcon}>{CATEGORY_ICONS[offer.item_category as Category] || '📦'}</Text>
                              </View>
                            )}
                            <View style={styles.itemTopInfo}>
                              <Text style={styles.itemName}>{cap(offer.item_title)}</Text>
                              <Text style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>
                                {offer.item_type === 'give' ? `Requesting from ${ownerName}` : `Offering to ${ownerName}`}
                              </Text>
                              <Text style={{ fontSize: 11, color: '#8B9AAD', marginTop: 1 }}>Requested {requestDate}</Text>
                              {offer.message && <Text style={{ fontSize: 12, color: '#8B9AAD', marginTop: 4, fontStyle: 'italic' }}>"{offer.message}"</Text>}
                            </View>
                          </View>
                        </View>
                        {offer.status === 'held' && offer.hold_until && (
                          <View style={{ backgroundColor: '#FFF8E1', padding: 8, borderRadius: 8, marginTop: 4 }}>
                            <Text style={{ fontSize: 12, color: '#D97706', textAlign: 'center' }}>
                              On hold until {new Date(offer.hold_until).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </Text>
                          </View>
                        )}
                        {(offer.status === 'pending' || offer.status === 'held') && (
                          <View style={styles.itemActions}>
                            <TouchableOpacity
                              style={[styles.itemBtn, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#C53030' }]}
                              onPress={async () => {
                                try {
                                  await withdrawOffer(offer.id)
                                  setMyOutgoingOffers(prev => prev.filter(o => o.id !== offer.id))
                                  showAlert('Withdrawn', 'Your request has been withdrawn.')
                                } catch (err: any) {
                                  showAlert('Error', err.message || 'Failed to withdraw offer')
                                }
                              }}
                            >
                              <Text style={{ textAlign: 'center', color: '#C53030', fontWeight: '600', fontSize: 13 }}>
                                {offer.status === 'held' ? 'Let others take it' : 'Withdraw Request'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                        {offer.status === 'accepted' && (() => {
                          const myRole: 'giver' | 'receiver' = userId === offer.giver_id ? 'giver' : 'receiver'
                          const iConfirmed = myRole === 'giver' ? !!offer.giver_confirmed_at : !!offer.receiver_confirmed_at
                          const theyConfirmed = myRole === 'giver' ? !!offer.receiver_confirmed_at : !!offer.giver_confirmed_at
                          const isConfirming = confirmingItem === offer.item_id

                          const doReceiverConfirm = async () => {
                            setConfirmingItem(offer.item_id)
                            try {
                              const location = await getCurrentLocation()
                              const result = await confirmExchange(offer.id, userId!, myRole, location)

                              if (result.bothConfirmed) {
                                const { proximityVerified, distanceM } = await finalizeExchange(offer.id, offer.item_id)
                                setRatingProximity({ verified: proximityVerified, distanceM })
                                // Create a pseudo item for rating
                                setRatingItem({
                                  id: offer.item_id, title: offer.item_title, type: offer.item_type,
                                  category: offer.item_category as any, other_person_id: myRole === 'giver' ? offer.receiver_id : offer.giver_id,
                                  user_id: '', status: 'completed', note: null, urgency: null, available_until: null,
                                  food_expiry: null, is_large_item: false, needs_mover: false, offer_in_return: null,
                                  handover_type: null, drop_point: null, drop_time: null, match_expiry: null,
                                  suburb: '', lat: null, lng: null, created_at: offer.created_at, hold_mode: 'first_come', updated_at: offer.created_at,
                                } as Item)
                                setRatingStars(5)
                                setRatingTags([])
                                setMyOutgoingOffers(prev => prev.map(o => o.id !== offer.id ? o : { ...o, status: 'completed' as any }))

                                const partnerId = myRole === 'giver' ? offer.receiver_id : offer.giver_id
                                createNotification({
                                  user_id: partnerId,
                                  type: 'match',
                                  title: 'Exchange complete!',
                                  body: `Both confirmed for "${cap(offer.item_title)}" — Kindness Points awarded!`,
                                  item_id: offer.item_id,
                                }).catch(console.error)
                              } else {
                                // Only one side confirmed — no rating/points yet
                                setMyOutgoingOffers(prev => prev.map(o => o.id !== offer.id ? o : {
                                  ...o,
                                  ...(myRole === 'giver' ? { giver_confirmed_at: new Date().toISOString() } : { receiver_confirmed_at: new Date().toISOString() }),
                                }))

                                const partnerId = myRole === 'giver' ? offer.receiver_id : offer.giver_id
                                createNotification({
                                  user_id: partnerId,
                                  type: 'match',
                                  title: `${userName || 'Your exchange partner'} confirmed`,
                                  body: `Tap to confirm your side and complete "${cap(offer.item_title)}"`,
                                  item_id: offer.item_id,
                                }).catch(console.error)

                                showAlert('Confirmed!', `Waiting for ${result.partnerName || 'the other person'} to confirm their side. You'll rate and earn Kindness Points once they confirm.`)
                              }
                            } catch (err: any) {
                              showAlert('Error', err.message || 'Failed to confirm')
                            } finally {
                              setConfirmingItem(null)
                            }
                          }

                          const doSafeCheck = () => {
                            if (Platform.OS === 'web') {
                              if (confirm('Safe Check-in\nDid the exchange go well and you felt safe?\n\nClick OK to confirm.')) {
                                doReceiverConfirm()
                              }
                            } else {
                              Alert.alert('Safe Check-in', 'Did the exchange go well and you felt safe?', [
                                { text: 'All Good — Confirm', onPress: doReceiverConfirm },
                                { text: 'Something Wasn\'t Right', style: 'destructive', onPress: () => {
                                  Alert.alert('Get Help', 'Crisis helpline: 1737\nEmergency: 111', [
                                    { text: 'Confirm Anyway', onPress: doReceiverConfirm },
                                    { text: 'Cancel', style: 'cancel' },
                                  ])
                                }},
                                { text: 'Not Yet', style: 'cancel' },
                              ])
                            }
                          }

                          return (
                            <View style={styles.itemActions}>
                              <TouchableOpacity style={[styles.itemBtn, styles.itemBtnPrimary, { flex: 1 }]} onPress={() => router.navigate('/(tabs)/messages')}>
                                <Text style={styles.itemBtnPrimaryText}>Message Them</Text>
                              </TouchableOpacity>
                              {iConfirmed ? (
                                <View style={[styles.itemBtn, { backgroundColor: '#F3F4F6', flex: 1 }]}>
                                  <Text style={{ textAlign: 'center', color: '#8B9AAD', fontWeight: '600', fontSize: 13 }}>Waiting for them to confirm...</Text>
                                </View>
                              ) : theyConfirmed ? (
                                <TouchableOpacity
                                  style={[styles.itemBtn, { backgroundColor: '#DCFCE7', flex: 1, borderWidth: 2, borderColor: '#16A34A' }]}
                                  onPress={doSafeCheck}
                                  disabled={isConfirming}
                                >
                                  <Text style={{ textAlign: 'center', color: '#16A34A', fontWeight: '700', fontSize: 13 }}>
                                    {isConfirming ? 'Confirming...' : 'They confirmed — Mark Complete'}
                                  </Text>
                                </TouchableOpacity>
                              ) : (
                                <TouchableOpacity
                                  style={[styles.itemBtn, { backgroundColor: '#DCFCE7', flex: 1 }]}
                                  onPress={doSafeCheck}
                                  disabled={isConfirming}
                                >
                                  <Text style={{ textAlign: 'center', color: '#16A34A', fontWeight: '700', fontSize: 13 }}>
                                    {isConfirming ? 'Confirming...' : 'Mark Complete'}
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          )
                        })()}
                      </View>
                    )
                  })}

                  {/* Declined requests — user can dismiss them */}
                  {past.filter(o => o.status === 'declined' && !dismissedOfferIds.has(o.id)).length > 0 && (
                    <>
                      {past.filter(o => o.status === 'declined' && !dismissedOfferIds.has(o.id)).map(offer => {
                        const ownerName = cap(offer.owner_profile?.display_name || offer.owner_name || 'Someone')
                        const declinedOwnerId = offer.giver_id === userId ? offer.receiver_id : offer.giver_id
                        return (
                          <View key={offer.id} style={[styles.itemCard, { opacity: 0.7 }]}>
                            <View style={styles.itemBody}>
                              <View style={styles.itemTopRow}>
                                <View style={styles.itemPhotoPlaceholder}>
                                  <Text style={styles.itemPhotoIcon}>{CATEGORY_ICONS[offer.item_category as Category] || '📦'}</Text>
                                </View>
                                <View style={styles.itemTopInfo}>
                                  <Text style={styles.itemName}>{cap(offer.item_title)}</Text>
                                  <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}><Text style={{ color: '#1A9E8F' }} onPress={() => openProfile(declinedOwnerId)}>{ownerName}</Text> went with someone else</Text>
                                  <Text style={{ fontSize: 11, color: '#8B9AAD', marginTop: 1 }}>{new Date(offer.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                                  <View style={{ backgroundColor: '#FEF2F2', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#DC2626' }}>Not selected</Text>
                                  </View>
                                  <TouchableOpacity
                                    onPress={() => {
                                      setDismissedOfferIds(prev => new Set(prev).add(offer.id))
                                      setMyOutgoingOffers(prev => prev.filter(o => o.id !== offer.id))
                                      // Delete the declined match from DB
                                      supabase.from('matches').delete().eq('id', offer.id)
                                    }}
                                    style={{ paddingHorizontal: 8, paddingVertical: 3 }}
                                  >
                                    <Text style={{ fontSize: 11, color: '#8B9AAD', fontWeight: '600' }}>Dismiss</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            </View>
                          </View>
                        )
                      })}
                    </>
                  )}
                </>
              )
            })()}

            {/* ── EXCHANGE HISTORY ── */}
            <View style={{ height: 1, backgroundColor: '#E5E7EB', marginTop: 24, marginBottom: 4 }} />
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }} onPress={() => setShowHistory(!showHistory)}>
              <Text style={styles.sectionTitle}>Exchange History</Text>
              <Text style={{ fontSize: 13, color: Colors.teal, fontWeight: '600' }}>{showHistory ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showHistory && (
              exchangeHistory.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>📋</Text>
                  <Text style={styles.emptyText}>No completed exchanges yet. Your exchange history will appear here.</Text>
                </View>
              ) : (
                exchangeHistory.map(receipt => {
                  const isGiver = receipt.giver_id === userId
                  const partnerName = cap(isGiver ? receipt.receiver_name : receipt.giver_name)
                  const partnerInitial = partnerName.charAt(0).toUpperCase()
                  const completedDate = new Date(receipt.completed_at)
                  const dateStr = completedDate.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                  const timeStr = completedDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                  return (
                    <View key={receipt.id} style={[styles.itemCard, styles.itemCardDone]}>
                      <View style={styles.itemBody}>
                        {/* Person row */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{partnerInitial}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937' }}>
                              {isGiver ? 'Given to ' : 'Received from '}<Text style={{ color: '#1A9E8F' }} onPress={() => openProfile(isGiver ? receipt.receiver_id : receipt.giver_id)}>{partnerName}</Text>
                            </Text>
                            <Text style={{ fontSize: 11, color: '#8B9AAD' }}>{dateStr} at {timeStr}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <View style={{ backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: '#16A34A' }}>Done</Text>
                            </View>
                            {receipt.proximity_verified && (
                              <Text style={{ fontSize: 9, color: '#059669', marginTop: 2 }}>Met in person</Text>
                            )}
                          </View>
                        </View>
                        {/* Item details */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 44 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '500', color: '#374151' }}>{cap(receipt.item_title)}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <Text style={{ fontSize: 11, color: '#6B7280' }}>
                                {CATEGORY_ICONS[receipt.category as Category] || '📦'} +{receipt.points_earned} Kindness Points
                              </Text>
                              {receipt.rating ? (
                                <Text style={{ fontSize: 11, color: '#F59E0B' }}>
                                  {'★'.repeat(receipt.rating)}{'☆'.repeat(5 - receipt.rating)}
                                </Text>
                              ) : (
                                <TouchableOpacity
                                  onPress={() => {
                                    const partnerId = isGiver ? receipt.receiver_id : receipt.giver_id
                                    setRatingItem({
                                      id: receipt.item_id || receipt.id, title: receipt.item_title, type: receipt.item_type,
                                      category: receipt.category as any, other_person_id: partnerId,
                                      user_id: isGiver ? receipt.giver_id : receipt.receiver_id,
                                      status: 'completed', note: null, urgency: null, available_until: null,
                                      food_expiry: null, is_large_item: false, needs_mover: false, offer_in_return: null,
                                      handover_type: null, drop_point: null, drop_time: null, match_expiry: null,
                                      suburb: '', lat: null, lng: null, created_at: receipt.completed_at, hold_mode: 'first_come', updated_at: receipt.completed_at,
                                    } as Item)
                                    setRatingStars(5)
                                    setRatingTags([])
                                  }}
                                >
                                  <Text style={{ fontSize: 11, color: Colors.teal, fontWeight: '600' }}>Rate now</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>
                  )
                })
              )
            )}
          </>
        )}

        {/* ── NEARBY ── */}
        {subTab === 'nearby' && !userLat && (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🏠</Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#1B2A3D', marginBottom: 6, textAlign: 'center' }}>Set your home address to browse</Text>
            <Text style={{ fontSize: 13, color: '#8B9AAD', textAlign: 'center', lineHeight: 19, marginBottom: 16 }}>
              Browse shows items listed near you. Set your home address in your Profile to get started.
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: '#1A9E8F', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 }}
              onPress={() => router.push('/(tabs)/profile')}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Go to Profile</Text>
            </TouchableOpacity>
          </View>
        )}

        {subTab === 'nearby' && userLat && (
          <>
            {/* Search bar + radius */}
            <View style={styles.searchRow}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search items..."
                placeholderTextColor="#8B9AAD"
                value={browseSearch}
                onChangeText={setBrowseSearch}
              />
              {browseSearch.length > 0 && (
                <TouchableOpacity onPress={() => setBrowseSearch('')}>
                  <Text style={styles.searchClear}>✕</Text>
                </TouchableOpacity>
              )}
              <View style={{ flexDirection: 'row', gap: 4, marginLeft: 6 }}>
                {[5, 10, 20].map(r => (
                  <TouchableOpacity key={r} style={[styles.radiusBtn, browseRadius === r && styles.radiusBtnActive]} onPress={() => setBrowseRadius(r)}>
                    <Text style={[styles.radiusBtnText, browseRadius === r && styles.radiusBtnTextActive]}>{r}km</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 }}>
              {([['home', '🏠 Home'], ['current', '📍 Current']] as const).map(([id, label]) => (
                <TouchableOpacity key={id} style={[styles.filterBtn, browseLocationMode === id ? styles.filterBtnActive : undefined]} onPress={() => setBrowseLocationMode(id)}>
                  <Text style={[styles.filterBtnText, browseLocationMode === id ? styles.filterBtnTextActive : undefined]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 }}>
              {([['all', 'All'], ['give', 'Giving'], ['need', 'Needs']] as const).map(([id, label]) => (
                <TouchableOpacity key={id} style={[styles.filterBtn, browseType === id ? styles.filterBtnActive : undefined]} onPress={() => setBrowseType(id)}>
                  <Text style={[styles.filterBtnText, browseType === id ? styles.filterBtnTextActive : undefined]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersRow}>
              {[{ id: 'all', l: 'All' }, { id: 'food', l: '🥦 Food' }, { id: 'clothing', l: '🧥 Clothes' }, { id: 'baby', l: '👶 Baby' }, { id: 'household', l: '🏠 House' }, { id: 'service', l: '🛠️ Skills' }].map(f => (
                <TouchableOpacity key={f.id} style={[styles.filterBtn, browseFilter === f.id ? styles.filterBtnActive : undefined]} onPress={() => setBrowseFilter(f.id)}>
                  <Text style={[styles.filterBtnText, browseFilter === f.id ? styles.filterBtnTextActive : undefined]}>{f.l}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {browseLoading && (
              <View style={styles.emptyState}><ActivityIndicator color="#1A9E8F" size="large" /></View>
            )}

            {!browseLoading && browseItems_.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyText}>{browseSearch ? `No results for "${browseSearch}" — try a different search term` : browseRadius < 20 ? `No items within ${browseRadius}km — try expanding your radius` : `No items nearby right now. Check back later!`}</Text>
                {!browseSearch && browseRadius < 20 && (
                  <TouchableOpacity
                    style={{ marginTop: 10, backgroundColor: '#1A9E8F', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 }}
                    onPress={() => setBrowseRadius(browseRadius === 5 ? 10 : 20)}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Search {browseRadius === 5 ? '10' : '20'}km instead</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {browseItems_.filter(b => (browseType === 'all' || b.type === browseType) && !myPendingOfferIds[b.id]).map(b => {
              const photos = b.item_photos || []
              const browseProfile = b.profiles
              const reliability = browseProfile && browseProfile.total_exchanges > 0
                ? Math.round((browseProfile.completed_exchanges / browseProfile.total_exchanges) * 100)
                : null

              return (
                <TouchableOpacity key={b.id} style={[styles.itemCard, b.type === 'give' ? styles.itemCardGive : styles.itemCardNeed, myPendingOfferIds[b.id] ? { borderLeftWidth: 4, borderLeftColor: Colors.teal, backgroundColor: '#F0FAFA' } : undefined]} onPress={() => { setDetailItem(b); setOfferMessage('') }}>
                  {myPendingOfferIds[b.id] && (
                    <View style={{ backgroundColor: Colors.teal, paddingVertical: 4, paddingHorizontal: 10, borderTopLeftRadius: 12, borderTopRightRadius: 12, marginTop: -12, marginHorizontal: -12, marginBottom: 8 }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>You've requested this item</Text>
                    </View>
                  )}
                  <View style={styles.itemBody}>
                    <View style={styles.itemTopRow}>
                      {photos.length > 0 ? (
                        <TouchableOpacity onPress={() => setEnlargedPhoto(photos[0].public_url)}>
                          <Image source={{ uri: photos[0].public_url }} style={styles.itemPhoto} />
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.itemPhotoPlaceholder}>
                          <Text style={styles.itemPhotoIcon}>{CATEGORY_ICONS[b.category as Category] || '📦'}</Text>
                        </View>
                      )}
                      <View style={styles.itemTopInfo}>
                        <View style={styles.itemHeader}>
                          <Text style={styles.itemName}>{cap(b.title)}</Text>
                          <View style={[styles.itemTypeBadge, b.type === 'give' ? styles.itemTypeBadgeGive : styles.itemTypeBadgeNeed]}>
                            <Text style={[styles.itemTypeBadgeText, b.type === 'give' ? styles.itemTypeBadgeTextGive : styles.itemTypeBadgeTextNeed]}>{b.type === 'give' ? 'Give' : 'Need'}</Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                              <Text style={{ fontSize: 11 }}>{getTierIcon(browseProfile?.points ?? 0)}</Text>
                              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1B2A3D' }}>{browseProfile?.display_name ? cap(browseProfile.display_name) : 'Someone nearby'}</Text>
                              {browseProfile?.is_premium && <Text style={{ fontSize: 11, color: '#D97706' }}>⭐Plus</Text>}
                            </View>
                            <TouchableOpacity onPress={() => openProfile(b.user_id)}><Text style={{ fontSize: 10, color: '#1A9E8F' }}>View profile</Text></TouchableOpacity>
                          </View>
                          {b.distance != null && <Text style={styles.distanceText}>{formatDistance(b.distance)}</Text>}
                          {b.category === 'food' && <View style={styles.tagBadge}><Text style={styles.tagBadgeText}>🥦 Food</Text></View>}
                        </View>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              )
            })}
          </>
        )}

      </ScrollView>

      {/* Notifications modal */}
      <Modal visible={showNotifs} animationType="fade" transparent onRequestClose={() => setShowNotifs(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowNotifs(false)}>
          <View style={styles.notifsPanel}>
            <View style={styles.notifsHeader}>
              <Text style={styles.notifsTitle}>Notifications</Text>
              <TouchableOpacity onPress={handleMarkAllNotifsRead}>
                <Text style={styles.notifsClear}>Mark All Read</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {notifications.length === 0 && (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={styles.emptyText}>No notifications yet</Text>
                </View>
              )}
              {notifications.map(n => (
                <TouchableOpacity key={n.id} style={[styles.notifItem, !n.read_at && styles.notifItemUnread]} onPress={() => handleNotifTap(n)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 14 }}>
                      {n.type === 'message' ? '💬' : n.type === 'points' ? '✨' : n.type === 'match' || n.type === 'claimed' ? '🤝' : n.type === 'arranged' ? '📦' : '🔔'}
                    </Text>
                    <Text style={[styles.notifText, { flex: 1 }]}>{n.title}</Text>
                  </View>
                  {n.body && <Text style={[styles.notifText, { color: '#8B9AAD', fontSize: 12, marginTop: 2 }]}>{n.body}</Text>}
                  <Text style={styles.notifTime}>{formatDate(n.created_at)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Detail modal */}
      <Modal visible={!!detailItem} animationType="slide" onRequestClose={() => setDetailItem(null)}>
        {detailItem && (() => {
          const dPhotos = detailItem.item_photos || []
          const dProfile = 'profiles' in detailItem ? (detailItem as BrowseItem).profiles : null
          const dDistance = 'distance' in detailItem ? (detailItem as BrowseItem).distance : undefined
          const dReliability = dProfile && dProfile.total_exchanges > 0
            ? Math.round((dProfile.completed_exchanges / dProfile.total_exchanges) * 100)
            : null
          const dTier = dProfile ? [...KP_TIERS].reverse().find(t => (dProfile.points || 0) >= t.min) : null
          return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
              <View style={styles.detailHeader}>
                <TouchableOpacity onPress={() => setDetailItem(null)}>
                  <Text style={styles.detailBack}>← Back</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ flex: 1, padding: 16 }}>
                <Text style={styles.detailTitleBelow}>{cap(detailItem.title)}</Text>
                {/* Photos */}
                {dPhotos.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    {dPhotos.map(p => (
                      <TouchableOpacity key={p.id} onPress={() => setEnlargedPhoto(p.public_url)}>
                        <Image source={{ uri: p.public_url }} style={styles.detailPhoto} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                {/* Category + urgency badges */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  <View style={[styles.itemTypeBadge, detailItem.type === 'give' ? styles.itemTypeBadgeGive : styles.itemTypeBadgeNeed]}>
                    <Text style={[styles.itemTypeBadgeText, detailItem.type === 'give' ? styles.itemTypeBadgeTextGive : styles.itemTypeBadgeTextNeed]}>{detailItem.type === 'give' ? 'Give' : 'Need'}</Text>
                  </View>
                  <View style={[styles.itemTypeBadge, { backgroundColor: '#F2EDE7' }]}>
                    <Text style={[styles.itemTypeBadgeText, { color: '#6B5C4D' }]}>{CATEGORY_ICONS[detailItem.category as Category] || '📦'} {detailItem.category}</Text>
                  </View>
                  {detailItem.urgency && detailItem.urgency !== 'whenever' && (
                    <View style={[styles.itemTypeBadge, { backgroundColor: detailItem.urgency === 'urgent' ? '#FFF0E0' : '#E8F0FF' }]}>
                      <Text style={[styles.itemTypeBadgeText, { color: detailItem.urgency === 'urgent' ? '#B35900' : '#3366AA' }]}>{detailItem.urgency === 'urgent' ? '⚡ Urgent' : '⏰ Soon'}</Text>
                    </View>
                  )}
                  {dDistance != null && (
                    <View style={[styles.itemTypeBadge, { backgroundColor: '#E8F0FF' }]}>
                      <Text style={[styles.itemTypeBadgeText, { color: '#3366AA' }]}>{formatDistance(dDistance)} away</Text>
                    </View>
                  )}
                  {detailItem.type === 'give' && (detailItem as Item).hold_mode === 'happy_to_hold' && (
                    <View style={[styles.itemTypeBadge, { backgroundColor: '#FFF8E1' }]}>
                      <Text style={[styles.itemTypeBadgeText, { color: '#D97706' }]}>Happy to hold</Text>
                    </View>
                  )}
                </View>

                {/* Giver info */}
                {dProfile && (
                  <TouchableOpacity style={{ backgroundColor: '#F8F6F3', borderRadius: 12, padding: 12, marginBottom: 12 }} onPress={() => openProfile(detailItem.user_id)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      {dProfile.avatar_url ? (
                        <Image source={{ uri: dProfile.avatar_url }} style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }} />
                      ) : (
                        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E0D8CE', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 20 }}>👤</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A9E8F' }}>{cap(dProfile.display_name || 'Someone nearby')}</Text>
                        <Text style={{ fontSize: 12, color: '#8B9AAD' }}>Tap to view profile ›</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}


                {detailItem.note && <View style={styles.itemNote}><Text style={styles.itemNoteText}>{detailItem.note}</Text></View>}
                {detailItem.category === 'food' && <Text style={[styles.foodWarning, { marginBottom: 12 }]}>⚠️ Food item — check freshness and allergens with the owner</Text>}
                {detailItem.user_id !== userId && myPendingOfferIds[detailItem.id] && (
                  <>
                    <View style={[styles.itemBtn, { marginTop: 8, backgroundColor: '#E6F7FF', borderWidth: 1, borderColor: Colors.teal }]}>
                      <Text style={{ textAlign: 'center', color: Colors.teal, fontWeight: '600', fontSize: 13 }}>Requested ✓</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.itemBtn, { marginTop: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: '#C53030' }]}
                      onPress={async () => {
                        try {
                          await withdrawOffer(myPendingOfferIds[detailItem.id])
                          setMyPendingOfferIds(prev => { const n = { ...prev }; delete n[detailItem.id]; return n })
                          setDetailItem(null)
                          showAlert('Withdrawn', 'Your request has been withdrawn.')
                        } catch (err: any) {
                          showAlert('Error', err.message || 'Failed to withdraw offer')
                        }
                      }}
                    >
                      <Text style={{ textAlign: 'center', color: '#C53030', fontWeight: '600', fontSize: 13 }}>Withdraw Request</Text>
                    </TouchableOpacity>
                  </>
                )}
                {detailItem.user_id !== userId && !myPendingOfferIds[detailItem.id] && detailItem.type === 'need' && (
                  <View style={{ marginTop: 14, backgroundColor: '#F0FAF8', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#D0EDE8' }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.dark, marginBottom: 4 }}>Show them what you have</Text>
                    <Text style={{ fontSize: 12, color: '#8B9AAD', marginBottom: 10 }}>Add photos so they can see what you're offering</Text>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                      {offerPhotos.map((uri, i) => (
                        <View key={i} style={{ marginRight: 8, position: 'relative' }}>
                          <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                          <TouchableOpacity
                            style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#C53030', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}
                            onPress={() => setOfferPhotos(prev => prev.filter((_, idx) => idx !== i))}
                          >
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                      {offerPhotos.length < 3 && (
                        <TouchableOpacity
                          style={{ width: 80, height: 80, borderRadius: 8, borderWidth: 2, borderColor: Colors.teal, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}
                          onPress={pickOfferPhotos}
                        >
                          <Text style={{ fontSize: 24, color: Colors.teal }}>+</Text>
                          <Text style={{ fontSize: 10, color: Colors.teal }}>Photo</Text>
                        </TouchableOpacity>
                      )}
                    </ScrollView>

                    <TextInput
                      style={{ backgroundColor: '#fff', borderRadius: 8, padding: 10, fontSize: 13, color: Colors.dark, borderWidth: 1, borderColor: '#E8E2DA', minHeight: 60 }}
                      placeholder="Describe what you're offering..."
                      placeholderTextColor="#8B9AAD"
                      value={offerMessage}
                      onChangeText={setOfferMessage}
                      multiline
                      maxLength={300}
                    />
                    <TouchableOpacity
                      style={[styles.itemBtn, styles.itemBtnPrimary, { marginTop: 10 }, (offerSubmitting || requesting === detailItem.id) && { opacity: 0.6 }]}
                      onPress={() => {
                        handleRequestItem(detailItem as BrowseItem, offerMessage.trim() || undefined, offerPhotos.length > 0 ? offerPhotos : undefined)
                        setOfferMessage('')
                        setDetailItem(null)
                      }}
                      disabled={offerSubmitting || requesting === detailItem.id}
                    >
                      <Text style={styles.itemBtnPrimaryText}>{offerSubmitting ? 'Sending offer...' : 'Send Offer'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {detailItem.user_id !== userId && !myPendingOfferIds[detailItem.id] && detailItem.type === 'give' && (
                  <>
                    {(detailItem as Item).hold_mode === 'happy_to_hold' && (
                      <View style={{ backgroundColor: '#FFF8E1', padding: 10, borderRadius: 8, marginTop: 10 }}>
                        <Text style={{ fontSize: 12, color: '#D97706', textAlign: 'center' }}>This owner is happy to hold — queue up even if someone else is first!</Text>
                      </View>
                    )}
                    <TextInput
                      style={{ backgroundColor: '#F8F6F2', borderRadius: 8, padding: 10, marginTop: 10, fontSize: 13, color: Colors.dark, borderWidth: 1, borderColor: '#E8E2DA' }}
                      placeholder="Add a note (optional) e.g. &quot;I can pick up Saturday!&quot;"
                      placeholderTextColor="#8B9AAD"
                      value={offerMessage}
                      onChangeText={setOfferMessage}
                      multiline
                      maxLength={200}
                    />
                    <TouchableOpacity
                      style={[styles.itemBtn, styles.itemBtnPrimary, { marginTop: 8 }, requesting === detailItem.id && { opacity: 0.6 }]}
                      onPress={() => { handleRequestItem(detailItem as BrowseItem, offerMessage.trim() || undefined); setOfferMessage(''); setDetailItem(null) }}
                      disabled={requesting === detailItem.id}
                    >
                      <Text style={styles.itemBtnPrimaryText}>{requesting === detailItem.id ? 'Requesting...' : 'Request This Item'}</Text>
                    </TouchableOpacity>
                  </>
                )}

                {detailItem.user_id !== userId && (
                  <TouchableOpacity
                    style={{ marginTop: 12, alignItems: 'center', padding: 8 }}
                    onPress={() => {
                      setDetailItem(null)
                      if (Platform.OS === 'web') {
                        const reason = prompt('Report this item?\nSelect a reason:\n' + REPORT_CATEGORIES.join(', '))
                        if (reason && userId) {
                          submitReport({ reporter_id: userId, reported_user_id: detailItem.user_id, category: reason })
                            .then(() => alert('Report submitted. Thank you.'))
                            .catch((e: any) => alert(e.message || 'Failed to submit report'))
                        }
                      } else {
                        Alert.alert('Report Item', 'Select a reason:', [
                          ...REPORT_CATEGORIES.map(cat => ({
                            text: cat,
                            onPress: async () => {
                              if (!userId) return
                              try {
                                await submitReport({ reporter_id: userId, reported_user_id: detailItem.user_id, category: cat })
                                Alert.alert('Report Submitted', 'Thank you. Our team will review this.')
                              } catch (e: any) {
                                Alert.alert('Error', e.message || 'Failed to submit report')
                              }
                            },
                          })),
                          { text: 'Cancel', style: 'cancel' },
                        ])
                      }
                    }}
                  >
                    <Text style={{ fontSize: 13, color: '#C53030' }}>Report this item</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </SafeAreaView>
          )
        })()}
      </Modal>

      {/* Smart matches modal */}
      <Modal visible={showSmartMatches} animationType="slide" transparent={false}>
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.cream }}>
          <View style={styles.header}>
            <View style={{ width: 40 }} />
            <Text style={{ fontSize: 17, fontWeight: '700', color: Colors.dark }}>Potential Matches</Text>
            <TouchableOpacity onPress={() => { setShowSmartMatches(false); setSmartMatches([]) }}>
              <Text style={{ color: Colors.teal, fontSize: 15, fontWeight: '600' }}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: 16 }}>
            <Text style={{ fontSize: 15, color: Colors.dark, marginBottom: 16, lineHeight: 22 }}>
              We found {smartMatches.length} potential {smartMatches.length === 1 ? 'match' : 'matches'} nearby!{'\n'}
              {smartMatches.length > 0 && smartMatches[0].type === 'need'
                ? 'These people nearby need what you\'re giving!'
                : 'These people nearby have what you need!'}
            </Text>
            {smartMatches.map(match => {
              const matchProfile = match.profiles
              return (
                <TouchableOpacity key={match.id} style={[styles.itemCard, match.type === 'give' ? styles.itemCardGive : styles.itemCardNeed]} onPress={() => {
                  setShowSmartMatches(false)
                  setSmartMatches([])
                  setDetailItem(match)
                }}>
                  <View style={styles.itemBody}>
                    <View style={styles.itemTopRow}>
                      {match.item_photos && match.item_photos.length > 0 ? (
                        <Image source={{ uri: match.item_photos[0].public_url }} style={styles.itemPhoto} />
                      ) : (
                        <View style={styles.itemPhotoPlaceholder}>
                          <Text style={styles.itemPhotoIcon}>{CATEGORY_ICONS[match.category as Category] || '📦'}</Text>
                        </View>
                      )}
                      <View style={styles.itemTopInfo}>
                        <Text style={styles.itemName}>{cap(match.title)}</Text>
                        <TouchableOpacity style={{ marginTop: 2 }} onPress={() => openProfile(match.user_id)}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                            <Text style={{ fontSize: 11 }}>{getTierIcon(matchProfile?.points ?? 0)}</Text>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#1A9E8F' }}>{cap(matchProfile?.display_name || 'Someone nearby')}</Text>
                            {matchProfile?.is_premium && <Text style={{ fontSize: 11, color: '#D97706' }}>⭐Plus</Text>}
                            {match.distance != null && <Text style={styles.distanceText}>{formatDistance(match.distance)}</Text>}
                          </View>
                          <Text style={{ fontSize: 10, color: '#B0BEC5' }}>View profile</Text>
                        </TouchableOpacity>
                        <View style={[styles.itemTypeBadge, match.type === 'give' ? styles.itemTypeBadgeGive : styles.itemTypeBadgeNeed, { marginTop: 4, alignSelf: 'flex-start' }]}>
                          <Text style={[styles.itemTypeBadgeText, match.type === 'give' ? styles.itemTypeBadgeTextGive : styles.itemTypeBadgeTextNeed]}>{match.type === 'give' ? 'Giving' : 'Needs'}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              )
            })}
            <TouchableOpacity style={{ alignItems: 'center', padding: 16, marginTop: 8 }} onPress={() => { setShowSmartMatches(false); setSmartMatches([]) }}>
              <Text style={{ color: '#8B9AAD', fontSize: 14 }}>Maybe Later</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Offers review modal */}
      <Modal visible={viewingOffersItem !== null} animationType="slide" transparent={false}>
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.cream }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => { setViewingOffersItem(null); setPendingOffers([]) }}>
              <Text style={{ color: Colors.teal, fontSize: 15, fontWeight: '600' }}>Close</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '700', color: Colors.dark }}>Requests</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView style={{ flex: 1, padding: 16 }}>
            {viewingOffersItem && (
              <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.dark, marginBottom: 16 }}>
                Requests for "{cap(viewingOffersItem.title)}"
              </Text>
            )}
            {offersLoading && <ActivityIndicator color={Colors.teal} size="large" style={{ marginTop: 40 }} />}
            {!offersLoading && pendingOffers.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyText}>No pending requests right now.</Text>
              </View>
            )}
            {pendingOffers.map(offer => {
              // Show the OTHER person's profile (not the owner's)
              const offerUserId = offer.giver_id === userId ? offer.receiver_id : offer.giver_id
              const offerProfile = offer.giver_id === userId ? offer.receiver_profile : offer.giver_profile
              const offerReliability = offerProfile && offerProfile.total_exchanges > 0
                ? Math.round((offerProfile.completed_exchanges / offerProfile.total_exchanges) * 100)
                : null
              const timeSince = formatDate(offer.created_at)
              const firstName = offerProfile?.display_name?.split(' ')[0] || 'them'
              const isGiveItem = viewingOffersItem?.type === 'give'
              const acceptLabel = isGiveItem ? `Give to ${firstName}` : `Accept ${firstName}`
              const profileTier = offerProfile ? [...KP_TIERS].reverse().find(t => (offerProfile.points || 0) >= t.min) : null
              return (
                <View key={offer.id} style={styles.offerCard}>
                  {/* Profile card */}
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8F6F3', borderRadius: 12, padding: 12, marginBottom: 10 }} onPress={() => openProfile(offerUserId)}>
                    {offerProfile?.avatar_url ? (
                      <Image source={{ uri: offerProfile.avatar_url }} style={styles.offerAvatar} />
                    ) : (
                      <View style={[styles.offerAvatar, { backgroundColor: '#E8E2DA', justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ fontSize: 18 }}>👤</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A9E8F' }}>{cap(offerProfile?.display_name || 'Someone')}</Text>
                      <Text style={{ fontSize: 12, color: '#8B9AAD' }}>Tap to view profile ›</Text>
                    </View>
                    <Text style={{ fontSize: 11, color: '#8B9AAD' }}>{timeSince}</Text>
                  </TouchableOpacity>

                  {/* Offer photos */}
                  {offer.offer_photos && offer.offer_photos.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                      {offer.offer_photos.sort((a, b) => a.position - b.position).map(p => (
                        <Image key={p.id} source={{ uri: p.public_url }} style={{ width: 100, height: 100, borderRadius: 8, marginRight: 8 }} />
                      ))}
                    </ScrollView>
                  )}
                  {offer.message && (
                    <View style={{ backgroundColor: '#F8F6F2', padding: 10, borderRadius: 8, marginBottom: 10 }}>
                      <Text style={{ fontSize: 13, color: Colors.dark, lineHeight: 18 }}>"{offer.message}"</Text>
                    </View>
                  )}
                  {offer.status === 'held' ? (
                    <View>
                      <View style={{ backgroundColor: '#FFF8E1', padding: 10, borderRadius: 8, marginBottom: 8, alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#F59E0B' }}>On hold until {offer.hold_until ? new Date(offer.hold_until).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity style={[styles.itemBtn, styles.itemBtnPrimary, { flex: 1 }]} onPress={() => handleAcceptOffer(offer)}>
                          <Text style={styles.itemBtnPrimaryText}>{acceptLabel}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.itemBtn, styles.itemBtnSecondary, { flex: 1 }]} onPress={async () => {
                          try {
                            await releaseHold(offer.id)
                            setPendingOffers(prev => prev.map(o => o.id === offer.id ? { ...o, status: 'pending', hold_until: null } : o))
                          } catch (err: any) { showAlert('Error', err.message || 'Failed to release hold') }
                        }}>
                          <Text style={styles.itemBtnSecondaryText}>Release</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity style={[styles.itemBtn, styles.itemBtnPrimary, { flex: 1 }]} onPress={() => handleAcceptOffer(offer)}>
                          <Text style={styles.itemBtnPrimaryText}>{acceptLabel}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.itemBtn, styles.itemBtnDanger]} onPress={() => handleDeclineOffer(offer)}>
                          <Text style={styles.itemBtnDangerText}>Decline</Text>
                        </TouchableOpacity>
                        {viewingOffersItem?.hold_mode === 'happy_to_hold' && (
                          <TouchableOpacity style={[styles.itemBtn, { backgroundColor: '#FFF8E1', borderWidth: 1, borderColor: '#F59E0B' }]} onPress={() => setHoldPickerOffer(offer)}>
                            <Text style={{ textAlign: 'center', color: '#F59E0B', fontWeight: '600', fontSize: 13 }}>Hold</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 12, marginTop: 6, justifyContent: 'flex-end' }}>
                        <TouchableOpacity onPress={() => handleReportFromOffer(offer)}>
                          <Text style={{ fontSize: 11, color: '#8B9AAD' }}>Report</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleBlockFromOffer(offer)}>
                          <Text style={{ fontSize: 11, color: '#DC2626' }}>Block</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              )
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Edit listing modal */}
      <Modal visible={!!editItem} animationType="slide" transparent={false}>
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.cream }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setEditItem(null)}>
              <Text style={{ color: Colors.teal, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '700', color: Colors.dark }}>Edit Listing</Text>
            <TouchableOpacity onPress={handleSaveEdit} disabled={editSaving || !editTitle.trim()}>
              <Text style={{ color: editSaving || !editTitle.trim() ? '#C8D1DC' : Colors.teal, fontSize: 15, fontWeight: '600' }}>{editSaving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: 16 }}>
            {editItem && (
              <>
                <Text style={styles.formLabel}>Title</Text>
                <TextInput style={styles.formInput} value={editTitle} onChangeText={setEditTitle} placeholder="Item name" placeholderTextColor="#C8D1DC" />

                <Text style={styles.formLabel}>Category</Text>
                <View style={styles.availRow}>
                  {(['food', 'clothing', 'furniture', 'electronics', 'toys', 'books', 'household', 'garden', 'baby', 'sports', 'tools', 'other'] as Category[]).map(c => (
                    <TouchableOpacity key={c} style={[styles.filterBtn, editCategory === c && styles.filterBtnActive]} onPress={() => setEditCategory(c)}>
                      <Text style={[styles.filterBtnText, editCategory === c && styles.filterBtnTextActive]}>{CATEGORY_ICONS[c]} {c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {editItem.type === 'need' && (
                  <>
                    <Text style={styles.formLabel}>How Urgent?</Text>
                    <View style={styles.urgencyRow}>
                      {[{ id: 'whenever', l: 'Whenever' }, { id: 'soon', l: 'Soon' }, { id: 'urgent', l: 'Urgent' }].map(u => (
                        <TouchableOpacity key={u.id} style={[styles.urgBtn, editUrgency === u.id && styles.urgBtnActive]} onPress={() => setEditUrgency(u.id as any)}>
                          <Text style={[styles.urgLabel, editUrgency === u.id && styles.urgLabelActive]}>{u.l}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                {editItem.type === 'give' && (
                  <>
                    <Text style={styles.formLabel}>Available</Text>
                    <View style={styles.availRow}>
                      {['Today only', 'This week', '2 weeks', 'Ongoing'].map(t => (
                        <TouchableOpacity key={t} style={[styles.filterBtn, editAvailable === t && styles.filterBtnActive]} onPress={() => setEditAvailable(t)}>
                          <Text style={[styles.filterBtnText, editAvailable === t && styles.filterBtnTextActive]}>{t}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.formLabel}>If multiple people want it...</Text>
                    <View style={styles.urgencyRow}>
                      <TouchableOpacity style={[styles.urgBtn, editHoldMode === 'first_come' && styles.urgBtnActive]} onPress={() => setEditHoldMode('first_come')}>
                        <Text style={[styles.urgLabel, editHoldMode === 'first_come' && styles.urgLabelActive]}>First in, first served</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.urgBtn, editHoldMode === 'happy_to_hold' && styles.urgBtnActive]} onPress={() => setEditHoldMode('happy_to_hold')}>
                        <Text style={[styles.urgLabel, editHoldMode === 'happy_to_hold' && styles.urgLabelActive]}>Happy to hold</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                <Text style={styles.formLabel}>Notes (optional)</Text>
                <TextInput style={styles.formInput} value={editNote} onChangeText={setEditNote} placeholder="Any extra details" placeholderTextColor="#C8D1DC" multiline />

                {/* Show offers inline */}
                {(offerCounts[editItem.id] || 0) > 0 && (
                  <TouchableOpacity
                    style={[styles.itemBtn, styles.itemBtnPrimary, { marginTop: 16 }]}
                    onPress={() => { setEditItem(null); handleViewOffers(editItem) }}
                  >
                    <Text style={styles.itemBtnPrimaryText}>{offerCounts[editItem.id]} {offerCounts[editItem.id] === 1 ? 'request' : 'requests'} — View & Respond</Text>
                  </TouchableOpacity>
                )}

                {editItem.status === 'listed' && (
                  <TouchableOpacity
                    style={[styles.itemBtn, { marginTop: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#C53030' }]}
                    onPress={() => { setEditItem(null); removeItem(editItem.id) }}
                  >
                    <Text style={{ textAlign: 'center', color: '#C53030', fontWeight: '600', fontSize: 13 }}>Remove Listing</Text>
                  </TouchableOpacity>
                )}

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <View style={[styles.itemTypeBadge, editItem.type === 'give' ? styles.itemTypeBadgeGive : styles.itemTypeBadgeNeed]}>
                    <Text style={[styles.itemTypeBadgeText, editItem.type === 'give' ? styles.itemTypeBadgeTextGive : styles.itemTypeBadgeTextNeed]}>{editItem.type === 'give' ? 'Give' : 'Need'}</Text>
                  </View>
                  <View style={[styles.itemTypeBadge, { backgroundColor: '#F3F4F6' }]}>
                    <Text style={[styles.itemTypeBadgeText, { color: '#6B7280' }]}>Status: {editItem.status}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: '#8B9AAD', alignSelf: 'center' }}>Created {formatDate(editItem.created_at)}</Text>
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Hold duration picker */}
      <Modal visible={!!holdPickerOffer} animationType="fade" transparent onRequestClose={() => setHoldPickerOffer(null)}>
        <View style={[styles.modalOverlay, { justifyContent: 'center' }]}>
          <View style={styles.ratingPanel}>
            <Text style={styles.ratingTitle}>Hold for how long?</Text>
            <Text style={styles.ratingSubtitle}>You'll have time to decide before others can take it.</Text>
            <View style={{ gap: 8, marginTop: 12, width: '100%' }}>
              {[{ hours: 1, label: '1 hour' }, { hours: 6, label: '6 hours' }, { hours: 12, label: '12 hours' }, { hours: 24, label: '24 hours' }].map(opt => (
                <TouchableOpacity
                  key={opt.hours}
                  style={[styles.itemBtn, styles.itemBtnPrimary, { width: '100%', paddingVertical: 14 }]}
                  onPress={async () => {
                    if (!holdPickerOffer || !viewingOffersItem || !userId) return
                    try {
                      await holdOffer(holdPickerOffer.id, opt.hours)
                      const holdUntil = new Date(Date.now() + opt.hours * 60 * 60 * 1000).toISOString()
                      setPendingOffers(prev => prev.map(o => o.id === holdPickerOffer.id ? { ...o, status: 'held', hold_until: holdUntil } : o))
                      // Notify the offerer
                      const offererId = holdPickerOffer.receiver_id === userId ? holdPickerOffer.giver_id : holdPickerOffer.receiver_id
                      try {
                        await createNotification({
                          user_id: offererId,
                          type: 'match',
                          title: 'Your offer is being considered',
                          body: `The owner of "${cap(viewingOffersItem.title)}" needs more time to decide. They've put your request on hold for ${opt.label}.`,
                          item_id: viewingOffersItem.id,
                          match_id: holdPickerOffer.id,
                        })
                      } catch {}
                      setHoldPickerOffer(null)
                    } catch (err: any) {
                      showAlert('Error', err.message || 'Failed to hold offer')
                    }
                  }}
                >
                  <Text style={styles.itemBtnPrimaryText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={{ marginTop: 12 }} onPress={() => setHoldPickerOffer(null)}>
              <Text style={{ fontSize: 13, color: '#8B9AAD', textAlign: 'center' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Rating modal */}
      <Modal visible={!!ratingItem} animationType="slide" transparent onRequestClose={() => { if (ratingItem) setRatedItemIds(prev => new Set(prev).add(ratingItem.id)); setRatingItem(null) }}>
        <View style={[styles.modalOverlay, { justifyContent: 'center' }]}>
          <View style={styles.ratingPanel}>
            <Text style={styles.ratingTitle}>Rate This Exchange</Text>
            <Text style={styles.ratingSubtitle}>How was your experience with {ratingItem?.other_person_id ? 'them' : 'this exchange'}?</Text>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(s => (
                <TouchableOpacity key={s} onPress={() => setRatingStars(s)}>
                  <Text style={[styles.star, s <= ratingStars && styles.starActive]}>{s <= ratingStars ? '★' : '☆'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.ratingLabel}>Tags (optional)</Text>
            <View style={styles.ratingTagsRow}>
              {['Friendly', 'On Time', 'As Described', 'Great Comms'].map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.ratingTag, ratingTags.includes(tag) && styles.ratingTagActive]}
                  onPress={() => setRatingTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                >
                  <Text style={[styles.ratingTagText, ratingTags.includes(tag) && styles.ratingTagTextActive]}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.itemBtn, styles.itemBtnPrimary, { width: '100%', paddingVertical: 14, marginTop: 16 }, ratingSubmitting && { opacity: 0.6 }]}
              onPress={handleSubmitRating}
              disabled={ratingSubmitting}
            >
              <Text style={styles.itemBtnPrimaryText}>{ratingSubmitting ? 'Submitting...' : 'Submit Rating'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={{ marginTop: 12 }} onPress={() => { setRatingItem(null); setCelebrate(ratingItem); setTimeout(() => setCelebrate(null), 4000) }}>
              <Text style={{ fontSize: 13, color: '#8B9AAD', textAlign: 'center' }}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Photo enlargement modal */}
      <Modal visible={!!enlargedPhoto} transparent animationType="fade" onRequestClose={() => setEnlargedPhoto(null)}>
        <TouchableOpacity style={styles.photoModalOverlay} activeOpacity={1} onPress={() => setEnlargedPhoto(null)}>
          {enlargedPhoto && (
            <Image source={{ uri: enlargedPhoto }} style={styles.photoModalImage} resizeMode="contain" />
          )}
          <TouchableOpacity style={styles.photoModalClose} onPress={() => setEnlargedPhoto(null)}>
            <Text style={styles.photoModalCloseText}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Celebration */}
      {/* Profile viewer modal */}
      <Modal visible={!!viewingProfile || profileLoading} animationType="fade" transparent onRequestClose={() => setViewingProfile(null)}>
        <View style={[styles.modalOverlay, { justifyContent: 'center' }]}>
          <View style={[styles.ratingPanel, { maxWidth: 340 }]}>
            {profileLoading ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator color="#1A9E8F" size="large" />
                <Text style={{ marginTop: 12, color: '#8B9AAD' }}>Loading profile...</Text>
              </View>
            ) : viewingProfile ? (() => {
              const tier = [...KP_TIERS].reverse().find(t => viewingProfile.points >= t.min)
              const reliabilityPct = viewingProfile.total_exchanges > 0
                ? Math.round((viewingProfile.completed_exchanges / viewingProfile.total_exchanges) * 100)
                : null
              const memberSince = viewingProfile.created_at
                ? new Date(viewingProfile.created_at).toLocaleDateString([], { month: 'long', year: 'numeric' })
                : null
              // Calculate distance radius bucket (don't reveal exact location)
              let distanceLabel: string | null = null
              if (userLat && userLng && viewingProfile.lat && viewingProfile.lng) {
                const km = getDistanceKm(userLat, userLng, viewingProfile.lat, viewingProfile.lng)
                if (km <= 5) distanceLabel = 'Within 5 km'
                else if (km <= 10) distanceLabel = 'Within 10 km'
                else if (km <= 20) distanceLabel = 'Within 20 km'
                else distanceLabel = '20+ km away'
              }
              return (
                <>
                  {/* Avatar + Name */}
                  <View style={{ alignItems: 'center', marginBottom: 16 }}>
                    {viewingProfile.avatar_url ? (
                      <Image source={{ uri: viewingProfile.avatar_url }} style={{ width: 72, height: 72, borderRadius: 36, marginBottom: 10 }} />
                    ) : (
                      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#1A9E8F', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 28 }}>{(viewingProfile.display_name || 'U').charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <Text style={{ fontSize: 14 }}>{getTierIcon(viewingProfile.points)}</Text>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: '#1F2937' }}>{cap(viewingProfile.display_name || 'Unknown')}</Text>
                      {viewingProfile.is_premium && <Text style={{ fontSize: 13, color: '#D97706' }}>⭐Plus</Text>}
                    </View>
                    {viewingProfile.suburb && (
                      <Text style={{ fontSize: 13, color: '#8B9AAD', marginTop: 2 }}>{cap(viewingProfile.suburb)}</Text>
                    )}
                    {distanceLabel && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                        <Text style={{ fontSize: 11, color: '#1A9E8F' }}>{distanceLabel}</Text>
                      </View>
                    )}
                    {memberSince && (
                      <Text style={{ fontSize: 11, color: '#C8D1DC', marginTop: 2 }}>Member since {memberSince}</Text>
                    )}
                  </View>

                  {/* Stats grid */}
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                    <View style={{ flex: 1, backgroundColor: '#F8F6F2', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A9E8F' }}>{viewingProfile.points}</Text>
                      <Text style={{ fontSize: 10, color: '#8B9AAD' }}>Kindred Points</Text>
                      {tier && <Text style={{ fontSize: 10, marginTop: 2 }}>{tier.icon} {tier.name}</Text>}
                    </View>
                    <View style={{ flex: 1, backgroundColor: '#F8F6F2', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A9E8F' }}>{viewingProfile.completed_exchanges}</Text>
                      <Text style={{ fontSize: 10, color: '#8B9AAD' }}>Exchanges</Text>
                      {reliabilityPct !== null && <Text style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{reliabilityPct}% completion</Text>}
                    </View>
                  </View>

                  {/* Rating */}
                  {viewingProfileStats && viewingProfileStats.totalRatings > 0 && (
                    <View style={{ backgroundColor: '#FFF8E1', borderRadius: 10, padding: 10, marginBottom: 16, alignItems: 'center' }}>
                      <Text style={{ fontSize: 15, color: '#F59E0B' }}>
                        {'★'.repeat(Math.round(viewingProfileStats.avgRating || 0))}{'☆'.repeat(5 - Math.round(viewingProfileStats.avgRating || 0))}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#92400E', marginTop: 2 }}>
                        {viewingProfileStats.avgRating?.toFixed(1)} avg from {viewingProfileStats.totalRatings} {viewingProfileStats.totalRatings === 1 ? 'rating' : 'ratings'}
                      </Text>
                      {viewingProfileStats.fiveStarCount > 0 && (
                        <Text style={{ fontSize: 10, color: '#B45309', marginTop: 1 }}>{viewingProfileStats.fiveStarCount} five-star {viewingProfileStats.fiveStarCount === 1 ? 'review' : 'reviews'}</Text>
                      )}
                    </View>
                  )}

                  {/* Verification status */}
                  <View style={{ backgroundColor: '#F8F6F2', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Verification</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <Text style={{ fontSize: 13 }}>{viewingProfile.email_confirmed ? '✅' : '❌'}</Text>
                      <Text style={{ fontSize: 13, color: viewingProfile.email_confirmed ? '#374151' : '#8B9AAD' }}>
                        {viewingProfile.email_confirmed ? 'Email verified' : 'Email not yet verified'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <Text style={{ fontSize: 13 }}>{viewingProfile.phone_verified ? '✅' : '❌'}</Text>
                      <Text style={{ fontSize: 13, color: viewingProfile.phone_verified ? '#374151' : '#8B9AAD' }}>
                        {viewingProfile.phone_verified ? 'Phone verified' : 'Phone not yet verified'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 13 }}>{viewingProfile.id_verified ? '✅' : '❌'}</Text>
                      <Text style={{ fontSize: 13, color: viewingProfile.id_verified ? '#374151' : '#8B9AAD' }}>
                        {viewingProfile.id_verified ? 'Identity verified' : 'Identity not yet verified'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={{ backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}
                    onPress={() => setViewingProfile(null)}
                  >
                    <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 14 }}>Close</Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 12 }}>
                    <TouchableOpacity onPress={() => {
                      if (!userId) return
                      const doReport = (cat: string) => {
                        submitReport({ reporter_id: userId, reported_user_id: viewingProfile.id, category: cat })
                          .then(() => { showAlert('Report Submitted', 'Thank you. Our team will review this.') })
                          .catch((err: any) => showAlert('Error', err.message || 'Failed to submit report'))
                      }
                      if (Platform.OS === 'web') {
                        const reason = prompt('Report User\nEnter a reason:\n' + REPORT_CATEGORIES.join(', '))
                        if (reason) doReport(reason)
                      } else {
                        Alert.alert('Report User', 'Select a reason:', [
                          ...REPORT_CATEGORIES.map(cat => ({ text: cat, onPress: () => doReport(cat) })),
                          { text: 'Cancel', style: 'cancel' as const },
                        ])
                      }
                    }}>
                      <Text style={{ fontSize: 12, color: '#8B9AAD' }}>Report</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => {
                      if (!userId) return
                      const doBlock = async () => {
                        try {
                          await supabase.from('user_blocks').insert({ blocker_id: userId, blocked_id: viewingProfile.id })
                          showAlert('Blocked', 'This user can no longer request your items.')
                          setViewingProfile(null)
                        } catch (err: any) {
                          showAlert('Error', err.message || 'Failed to block user')
                        }
                      }
                      if (Platform.OS === 'web') {
                        if (confirm('Block this user? They won\'t be able to request your items.')) doBlock()
                      } else {
                        Alert.alert('Block User', 'They won\'t be able to request your items.', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Block', style: 'destructive', onPress: doBlock },
                        ])
                      }
                    }}>
                      <Text style={{ fontSize: 12, color: '#DC2626' }}>Block</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )
            })() : null}
          </View>
        </View>
      </Modal>

      {celebrate && (() => {
        const isGiver = celebrate.type === 'give'
        const baseExchange = isGiver ? 25 : 5
        const baseRating = 5
        const exchangeKP = isPremium ? baseExchange * 2 : baseExchange
        const ratingKP = isPremium ? baseRating * 2 : baseRating
        const totalKP = exchangeKP + ratingKP
        return (
          <View style={styles.celebrateOverlay}>
            <TouchableOpacity style={{ position: 'absolute', top: 16, right: 16, padding: 8 }} onPress={() => setCelebrate(null)}>
              <Text style={{ fontSize: 22, color: '#8B9AAD', fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.celebrateEmoji}>🎉</Text>
            <Text style={styles.celebrateTitle}>Exchange Complete!</Text>
            <Text style={styles.celebrateSub}>You've made a difference in {suburb ? suburb.split(',')[0] : 'your community'}!</Text>

            <View style={{ backgroundColor: '#F0FDF4', borderRadius: 12, padding: 16, marginTop: 16, width: '100%' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 10 }}>Points Earned</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 13, color: '#4B5563' }}>{isGiver ? 'Giving away item' : 'Receiving item'}</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#16A34A' }}>+{exchangeKP}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 13, color: '#4B5563' }}>Rating the exchange</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#16A34A' }}>+{ratingKP}</Text>
              </View>
              {isPremium && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 12, color: '#D4A843' }}>2x Plus bonus applied</Text>
                  <Text style={{ fontSize: 12, color: '#D4A843' }}>⭐</Text>
                </View>
              )}
              <View style={{ height: 1, backgroundColor: '#D1FAE5', marginVertical: 8 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#374151' }}>Total</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#16A34A' }}>+{totalKP} Kindness Points</Text>
              </View>
            </View>

            {!isPremium && (
              <View style={styles.celebratePlus}>
                <Text style={styles.celebratePlusText}>⭐ With Kindred Plus you'd earn {(isGiver ? 25 : 5) * 2 + 10} Kindness Points (2x bonus!)</Text>
              </View>
            )}
          </View>
        )
      })()}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF9F6' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 10,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F2EDE7',
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#1A9E8F' },
  headerSub: { fontSize: 11, color: '#8B9AAD' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bellBtn: { position: 'relative', padding: 4 },
  bellIcon: { fontSize: 20 },
  bellBadge: { position: 'absolute', top: -2, right: -4, backgroundColor: '#C53030', borderRadius: 8, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  bellBadgeText: { color: '#fff', fontSize: 8, fontWeight: '700' },
  kpBadge: { backgroundColor: '#FFF3E6', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 50 },
  kpText: { color: '#D4842A', fontWeight: '600', fontSize: 13 },

  // Sub tabs
  subTabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F2EDE7' },
  subTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  subTabActive: { borderBottomColor: '#1A9E8F' },
  subTabText: { fontSize: 13, fontWeight: '500', color: '#8B9AAD' },
  subTabTextActive: { color: '#1A9E8F', fontWeight: '600' },

  content: { flex: 1, padding: 12 },

  // Action cards
  actionGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  actionCard: { flex: 1, padding: 14, borderRadius: 16, backgroundColor: '#fff', borderWidth: 2, borderColor: '#F2EDE7', alignItems: 'center' },
  actionIcon: { fontSize: 28, marginBottom: 4 },
  actionLabel: { fontSize: 14, fontWeight: '600', color: '#1B2A3D', textAlign: 'center' },
  actionDesc: { fontSize: 11, color: '#8B9AAD', marginTop: 2 },

  // Add form
  addForm: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 2, borderColor: '#1A9E8F' },
  formToggle: { flexDirection: 'row', backgroundColor: '#F2EDE7', borderRadius: 50, padding: 3, marginBottom: 14 },
  formToggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 50, alignItems: 'center', backgroundColor: 'transparent' },
  formToggleBtnActive: { backgroundColor: '#fff' },
  formToggleBtnText: { color: '#8B9AAD', fontWeight: '600', fontSize: 13 },
  formToggleBtnTextActive: { color: '#1B2A3D' },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#1B2A3D', marginBottom: 6 },
  formInput: {
    borderWidth: 2, borderColor: '#F2EDE7', borderRadius: 10,
    padding: 14, fontSize: 15, backgroundColor: '#fff', color: '#1B2A3D', marginBottom: 12,
  },
  autoCat: { backgroundColor: '#E8F5F3', borderRadius: 50, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 12 },
  autoCatText: { fontSize: 11, color: '#147A6E', fontWeight: '600' },
  urgencyRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  urgBtn: { flex: 1, padding: 8, borderWidth: 2, borderColor: '#F2EDE7', borderRadius: 10, alignItems: 'center', backgroundColor: '#fff' },
  urgBtnActive: { borderColor: '#1A9E8F', backgroundColor: '#E8F5F3' },
  urgIcon: { fontSize: 16 },
  urgLabel: { fontSize: 10, fontWeight: '600', color: '#8B9AAD' },
  urgLabelActive: { color: '#1A9E8F' },
  availRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  formActions: { flexDirection: 'row', gap: 8 },
  foodCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, marginBottom: 12 },
  checkBox: { width: 22, height: 22, borderWidth: 2, borderColor: Colors.sand, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  checkBoxOn: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  checkMark: { color: '#fff', fontSize: 12 },
  foodCheckText: { flex: 1, fontSize: 12, color: Colors.grey },

  // Filters
  modeRow: { flexDirection: 'row', backgroundColor: '#F2EDE7', borderRadius: 50, padding: 3 },
  modeBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 50, alignItems: 'center' },
  modeBtnActive: { backgroundColor: '#1A9E8F' },
  modeBtnText: { fontSize: 13, fontWeight: '600', color: '#8B9AAD' },
  modeBtnTextActive: { color: '#fff' },
  radiusRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  radiusBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 50, borderWidth: 1.5, borderColor: '#F2EDE7', backgroundColor: '#fff' },
  radiusBtnActive: { backgroundColor: '#1A9E8F', borderColor: '#1A9E8F' },
  radiusBtnText: { fontSize: 12, fontWeight: '600', color: '#8B9AAD' },
  radiusBtnTextActive: { color: '#fff' },
  distanceText: { fontSize: 11, fontWeight: '600', color: '#1A9E8F', marginLeft: 6 },
  filtersRow: { marginBottom: 14, flexDirection: 'row' },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 50,
    borderWidth: 1.5, borderColor: '#F2EDE7', backgroundColor: '#fff', marginRight: 6,
  },
  filterBtnActive: { backgroundColor: '#1A9E8F', borderColor: '#1A9E8F' },
  filterBtnText: { fontSize: 12, fontWeight: '600', color: '#8B9AAD' },
  filterBtnTextActive: { color: '#fff' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#8B9AAD', textAlign: 'center', lineHeight: 20 },

  // Item card
  itemCard: {
    backgroundColor: '#fff', borderRadius: 16, marginBottom: 12,
    borderLeftWidth: 3, borderLeftColor: '#C8D1DC',
    shadowColor: '#1B2A3D', shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  itemCardGive: { borderLeftColor: '#6BA368', borderLeftWidth: 4, backgroundColor: '#F6FBF6' },
  itemCardNeed: { borderLeftColor: '#7B9ACC', borderLeftWidth: 4, backgroundColor: '#F5F8FD' },
  itemCardDone: { opacity: 0.55 },
  matchBanner: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, backgroundColor: '#E6F7F5', paddingHorizontal: 12, paddingVertical: 8, borderTopLeftRadius: 13, borderTopRightRadius: 13 },
  matchBannerText: { color: '#1A9E8F', fontSize: 13, fontWeight: '600' as const },
  matchBannerArrow: { color: '#1A9E8F', fontSize: 12, fontWeight: '700' as const },
  itemTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  itemTopInfo: { flex: 1 },
  itemPhoto: { width: 64, height: 64, borderRadius: 10 },
  itemPhotoPlaceholder: {
    width: 64, height: 64, borderRadius: 10,
    backgroundColor: '#F2EDE7', alignItems: 'center', justifyContent: 'center',
  },
  itemPhotoIcon: { fontSize: 28, opacity: 0.5 },
  itemBody: { padding: 14 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  itemName: { fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8, color: '#1B2A3D' },
  itemTypeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 50 },
  itemTypeBadgeGive: { backgroundColor: '#E6F9E6' },
  itemTypeBadgeNeed: { backgroundColor: '#E8F0FF' },
  itemTypeBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  itemTypeBadgeTextGive: { color: '#2D7A2D' },
  itemTypeBadgeTextNeed: { color: '#7B9ACC' },
  itemMeta: { fontSize: 11, color: '#C8D1DC', marginBottom: 8 },
  itemDetail: { fontSize: 12, color: '#8B9AAD', marginBottom: 4 },
  itemNote: { backgroundColor: '#FBF9F6', borderRadius: 8, padding: 8, borderLeftWidth: 3, borderLeftColor: '#F4A261', marginTop: 6 },
  itemNoteText: { fontSize: 12, color: '#1B2A3D' },
  itemOffer: { backgroundColor: '#FFF3E6', borderRadius: 8, padding: 8, borderLeftWidth: 3, borderLeftColor: '#F4A261', marginTop: 6 },
  itemOfferText: { fontSize: 12, color: '#B8762A', fontWeight: '500' },

  // Stepper
  stepper: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  stepItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#F2EDE7', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  stepDotDone: { backgroundColor: '#1A9E8F', borderColor: '#1A9E8F' },
  stepDotActive: { borderColor: '#1A9E8F', backgroundColor: '#E8F5F3' },
  stepDotText: { fontSize: 9, color: '#fff' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#F2EDE7' },
  stepLineDone: { backgroundColor: '#1A9E8F' },
  stepLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  stepLabel: { fontSize: 10, color: '#C8D1DC', textAlign: 'center', flex: 1 },
  stepLabelActive: { color: '#1A9E8F', fontWeight: '700' },
  stepLabelDone: { color: '#147A6E' },

  // Person row
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  personAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E8F5F3', alignItems: 'center', justifyContent: 'center' },
  personAvatarText: { fontSize: 12, fontWeight: '700', color: '#147A6E' },
  personInfo: { flex: 1 },
  personName: { fontSize: 13, fontWeight: '600', color: '#1B2A3D' },
  personStats: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  relBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 50 },
  relHigh: { backgroundColor: '#E6F9E6' },
  relMid: { backgroundColor: '#FFF3E6' },
  relLow: { backgroundColor: '#FDE8E8' },
  relBadgeText: { fontSize: 10, fontWeight: '700', color: '#2D7A2D' },
  idBadge: { fontSize: 10, color: '#D4A843' },
  plusBadge: { backgroundColor: '#FFF8E1', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 50, borderWidth: 1, borderColor: '#D4A843' },
  plusBadgeText: { fontSize: 9, fontWeight: '700', color: '#D4A843' },
  moverBadge: { backgroundColor: '#FFF3E6', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 50, borderWidth: 1, borderColor: '#E8A040' },
  moverBadgeText: { fontSize: 9, fontWeight: '700', color: '#E8A040' },
  tagBadge: { backgroundColor: '#E6F7FF', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 50, borderWidth: 1, borderColor: '#1A9E8F' },
  tagBadgeText: { fontSize: 9, fontWeight: '700', color: '#1A9E8F' },

  // Offer review
  offerCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E8E2DA' },
  offerAvatar: { width: 40, height: 40, borderRadius: 20 },

  // Actions
  itemActions: { flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: '#F2EDE7', backgroundColor: '#FBF9F6' },
  itemBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  itemBtnPrimary: { backgroundColor: '#1A9E8F' },
  itemBtnPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  itemBtnSecondary: { backgroundColor: '#F2EDE7' },
  itemBtnSecondaryText: { color: '#1B2A3D', fontWeight: '600', fontSize: 12 },
  itemBtnDanger: { backgroundColor: '#FDE8E8' },
  itemBtnDangerText: { color: '#C53030', fontWeight: '600', fontSize: 12 },

  // Handover
  handoverGrid: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  handoverOpt: { flex: 1, padding: 10, borderWidth: 2, borderColor: '#F2EDE7', borderRadius: 10, alignItems: 'center', backgroundColor: '#fff' },
  handoverOptSel: { borderColor: '#1A9E8F', backgroundColor: '#E8F5F3' },
  handoverIcon: { fontSize: 20, marginBottom: 2 },
  handoverLabel: { fontSize: 11, fontWeight: '600', color: '#1B2A3D' },
  handoverDesc: { fontSize: 9, color: '#8B9AAD', marginTop: 2 },
  dpOption: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderWidth: 2, borderColor: '#F2EDE7', borderRadius: 10, marginBottom: 8, backgroundColor: '#fff' },
  dpOptionSel: { borderColor: '#1A9E8F', backgroundColor: '#E8F5F3' },
  dpRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#C8D1DC' },
  dpRadioSel: { borderColor: '#1A9E8F', backgroundColor: '#1A9E8F' },
  dpName: { fontSize: 13, fontWeight: '600', color: '#1B2A3D' },
  dpMeta: { fontSize: 11, color: '#8B9AAD' },
  timeOpt: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 2, borderColor: '#F2EDE7', borderRadius: 10, marginRight: 6, backgroundColor: '#fff' },
  timeOptSel: { borderColor: '#1A9E8F', backgroundColor: '#E8F5F3' },
  timeOptText: { fontSize: 11, fontWeight: '600', color: '#8B9AAD' },
  timeOptTextSel: { color: '#147A6E' },

  // Browse
  browseCard: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, overflow: 'hidden', shadowColor: '#1B2A3D', shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  browsePhotoWrap: { position: 'relative' },
  browsePhoto: { width: '100%', height: 140 },
  browseDistBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 50 },
  browseDistText: { fontSize: 10, fontWeight: '700', color: '#1B2A3D' },
  browseAvailBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#1A9E8F', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 50 },
  browseAvailText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  browseBody: { padding: 12 },
  browseName: { fontSize: 14, fontWeight: '600', color: '#1B2A3D', marginBottom: 4 },
  browseMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  browseGiver: { fontSize: 11, color: '#8B9AAD' },
  browseNote: { fontSize: 12, color: '#8B9AAD', lineHeight: 18 },
  foodWarning: { fontSize: 10, color: '#8B6914', marginTop: 4 },
  browseActions: { padding: 8, borderTopWidth: 1, borderTopColor: '#F2EDE7' },

  // Search
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10, borderWidth: 1, borderColor: '#E8E2DA' },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#1B2A3D', padding: 0 },
  searchClear: { fontSize: 14, color: '#8B9AAD', padding: 4 },


  // Compact browse cards (Trade Me style)
  compactCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 8, marginBottom: 6, gap: 10, shadowColor: '#1B2A3D', shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  compactPhoto: { width: 48, height: 48, borderRadius: 8 },
  compactPhotoPlaceholder: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#F2EDE7', alignItems: 'center', justifyContent: 'center' },
  compactInfo: { flex: 1, gap: 2 },
  compactTitle: { fontSize: 13, fontWeight: '600', color: '#1B2A3D', flex: 1, marginRight: 6 },
  compactDist: { fontSize: 11, color: '#1A9E8F', fontWeight: '600' },
  compactGiver: { fontSize: 11, color: '#8B9AAD' },
  compactTypeBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 50 },
  compactTypeBadgeText: { fontSize: 9, fontWeight: '700' },

  // Section headings
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1B2A3D', marginBottom: 8 },

  // Notifications modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(27,42,61,0.4)', justifyContent: 'flex-start' },
  notifsPanel: { backgroundColor: '#fff', borderRadius: 16, margin: 12, marginTop: 60, maxHeight: 400 },
  notifsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#F2EDE7' },
  notifsTitle: { fontSize: 16, fontWeight: '600', color: '#1B2A3D' },
  notifsClear: { fontSize: 11, color: '#1A9E8F', fontWeight: '600' },
  notifItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F2EDE7' },
  notifItemUnread: { backgroundColor: '#E8F5F3' },
  notifText: { fontSize: 13, color: '#1B2A3D' },
  notifTime: { fontSize: 10, color: '#C8D1DC', marginTop: 2 },

  // Detail modal
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F2EDE7' },
  detailBack: { fontSize: 20, color: '#1B2A3D' },
  detailTitleBelow: { fontSize: 20, fontWeight: '700', color: '#1B2A3D', marginBottom: 12 },

  // Celebrate
  celebrateOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center', zIndex: 50,
  },
  celebrateEmoji: { fontSize: 64 },
  celebrateTitle: { fontSize: 24, fontWeight: '700', color: '#1A9E8F', marginTop: 16 },
  celebrateKP: { fontSize: 28, fontWeight: '700', color: '#6BA368', marginTop: 8 },
  celebrateSub: { fontSize: 14, color: '#8B9AAD', marginTop: 8 },
  celebratePlus: { marginTop: 20, backgroundColor: '#FFF8E1', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#D4A843' },
  celebratePlusText: { fontSize: 13, color: '#D4A843', fontWeight: '600', textAlign: 'center' },

  // Large item warning

  // Rating modal
  ratingPanel: { backgroundColor: '#fff', borderRadius: 24, padding: 24, margin: 20, alignItems: 'center' },
  ratingTitle: { fontSize: 20, fontWeight: '700', color: '#1B2A3D', marginBottom: 4 },
  ratingSubtitle: { fontSize: 13, color: '#8B9AAD', marginBottom: 16, textAlign: 'center' },
  starsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  star: { fontSize: 36, color: '#C8D1DC' },
  starActive: { color: '#E8C84B' },
  ratingLabel: { fontSize: 13, fontWeight: '600', color: '#1B2A3D', marginBottom: 8, alignSelf: 'flex-start' },
  ratingTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ratingTag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 50, borderWidth: 1.5, borderColor: '#F2EDE7', backgroundColor: '#fff' },
  ratingTagActive: { borderColor: '#1A9E8F', backgroundColor: '#E8F5F3' },
  ratingTagText: { fontSize: 12, fontWeight: '600', color: '#8B9AAD' },
  ratingTagTextActive: { color: '#147A6E' },

  // Photo enlargement modal
  photoModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  photoModalImage: { width: '90%', height: '80%' } as any,
  photoModalClose: { position: 'absolute', top: 50, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  photoModalCloseText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  // Detail modal photos
  detailPhoto: { width: 120, height: 120, borderRadius: 12, marginRight: 10 },

  // Feed
  feedLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  feedIcon: { fontSize: 16 },
  feedLabel: { fontSize: 12, fontWeight: '700', color: '#1B2A3D' },
  feedTime: { fontSize: 11, color: '#8B9AAD', marginLeft: 'auto' },
  feedKP: { fontSize: 11, fontWeight: '700', color: '#6BA368', backgroundColor: '#E6F9E6', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },

  // Photo picker
  photoRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  photoThumb: { position: 'relative', width: 64, height: 64, borderRadius: 10, overflow: 'hidden' },
  photoThumbImg: { width: 64, height: 64, borderRadius: 10 },
  photoRemove: { position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  photoRemoveText: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 16 },
  photoAddBtn: { width: 64, height: 64, borderRadius: 10, borderWidth: 2, borderStyle: 'dashed', borderColor: '#C8D1DC', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBF9F6' },
  photoAddIcon: { fontSize: 20 },
  photoAddText: { fontSize: 10, color: '#8B9AAD', marginTop: 2 },
})
