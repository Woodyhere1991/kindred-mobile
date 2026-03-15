import { useState, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput, Image, Alert, Platform, Modal, ActivityIndicator, Linking } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as Notifications from 'expo-notifications'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useApp } from '../../lib/appContext'
import {
  sendMessage as sendMessageApi, getMessages, markRead,
  subscribeToMessages, blockUserInConversation, isScamMessage,
  uploadChatPhoto, Message, Conversation,
} from '../../lib/messages'
import { submitReport, REPORT_CATEGORIES } from '../../lib/reports'
import { getPublicProfile, getReliabilityStats, PublicProfile, ReliabilityStats } from '../../lib/profileViewer'
import { createNotification } from '../../lib/notifications'
import { supabase } from '../../lib/supabase'
import { KP_TIERS, getTierIcon } from '../../constants/theme'
import { getDistanceKm } from '../../lib/location'
import { DROP_POINTS, getMeetupStats, getHomePickupCounts } from '../../lib/utils'

export default function MessagesScreen() {
  const { userId, conversations, setConversations, userLat, userLng, profile } = useApp()
  const [activeConvo, setActiveConvo] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [msgInput, setMsgInput] = useState('')
  const [scamWarning, setScamWarning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendingPhoto, setSendingPhoto] = useState(false)
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null)
  const [convoSearch, setConvoSearch] = useState('')
  const [viewingProfile, setViewingProfile] = useState<PublicProfile | null>(null)
  const [viewingProfileStats, setViewingProfileStats] = useState<ReliabilityStats | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  // Meetup arrangement
  const [showMeetupModal, setShowMeetupModal] = useState(false)
  const [meetupStep, setMeetupStep] = useState<'location' | 'time'>('location')
  const [selectedMeetupPoint, setSelectedMeetupPoint] = useState<typeof DROP_POINTS[number] | null>(null)
  const [meetupDate, setMeetupDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [savingMeetup, setSavingMeetup] = useState(false)
  const [meetupStats, setMeetupStats] = useState<Record<string, number>>({})
  const [meetupHomeOf, setMeetupHomeOf] = useState<string | null>(null) // user ID whose home is the meetup
  const [homePickupCounts, setHomePickupCounts] = useState<Record<string, number>>({})

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  const openProfile = async (profileUserId: string) => {
    if (profileUserId === userId) return
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
  const scrollRef = useRef<ScrollView>(null)

  const activeConvoData = conversations.find(c => c.id === activeConvo)

  // Load messages when opening a conversation
  useEffect(() => {
    if (!activeConvo || !userId) return

    const loadMessages = async () => {
      setLoading(true)
      try {
        const msgs = await getMessages(activeConvo)
        setMessages(msgs)
        await markRead(activeConvo, userId)
        setConversations(prev => prev.map(c =>
          c.id === activeConvo ? { ...c, unread_count: 0 } : c
        ))
      } catch (err) {
        console.error('Failed to load messages:', err)
      } finally {
        setLoading(false)
      }
    }
    loadMessages()

    // Load home pickup counts for both users
    const convo = conversations.find(c => c.id === activeConvo)
    if (convo) {
      const otherId = convo.other_user_id === userId ? convo.user_id : convo.other_user_id
      getHomePickupCounts([userId, otherId]).then(setHomePickupCounts).catch(() => {})
    }

    // Subscribe to real-time messages
    const channel = subscribeToMessages(activeConvo, (newMsg) => {
      setMessages(prev => [...prev, newMsg])
      if (newMsg.sender_id !== userId) {
        markRead(activeConvo, userId).catch(console.error)
      }
    })

    return () => { channel.unsubscribe() }
  }, [activeConvo, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const doSendMessage = async () => {
    if (!activeConvo || !userId) return
    if (!pendingPhoto && !msgInput.trim()) return

    setSending(true)
    try {
      const content = msgInput.trim()
      const msg = await sendMessageApi(activeConvo, userId, content, pendingPhoto || undefined)
      setMessages(prev => [...prev, msg])
      setMsgInput('')
      setPendingPhoto(null)
      setScamWarning(false)
      const lastMsg = pendingPhoto ? (content || '📷 Photo') : content
      setConversations(prev => prev.map(c =>
        c.id === activeConvo
          ? { ...c, last_message: lastMsg, last_message_at: new Date().toISOString() }
          : c
      ))
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
    } catch (err: any) {
      setPendingPhoto(null)
      Platform.OS === 'web' ? alert(err.message || 'Failed to send message') : Alert.alert('Error', err.message || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handlePickPhoto = async () => {
    if (!activeConvo || !userId) return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    })
    if (result.canceled || !result.assets[0]) return
    setSendingPhoto(true)
    try {
      const url = await uploadChatPhoto(userId, activeConvo, result.assets[0].uri)
      setPendingPhoto(url)
    } catch (err: any) {
      Platform.OS === 'web' ? alert(err.message || 'Failed to upload photo') : Alert.alert('Error', err.message || 'Failed to upload photo')
    } finally {
      setSendingPhoto(false)
    }
  }

  const handleSendMessage = async () => {
    if (!activeConvo || !userId) return
    if (!msgInput.trim() && !pendingPhoto) return
    if (msgInput.trim() && isScamMessage(msgInput) && !scamWarning) {
      setScamWarning(true)
      return
    }
    doSendMessage()
  }

  const doBlockUser = async (conversationId: string) => {
    try {
      await blockUserInConversation(conversationId, userId!)
      setConversations(prev => prev.map(c =>
        c.id === conversationId ? { ...c, blocked_by: userId } : c
      ))
      setActiveConvo(null)
    } catch (err: any) {
      Platform.OS === 'web' ? alert(err.message || 'Failed to block user') : Alert.alert('Error', err.message || 'Failed to block user')
    }
  }

  const handleBlockUser = (conversationId: string) => {
    if (!userId) return
    if (Platform.OS === 'web') {
      if (confirm('Are you sure you want to block this user?')) doBlockUser(conversationId)
    } else {
      Alert.alert('Block User', 'Are you sure you want to block this user?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => doBlockUser(conversationId) },
      ])
    }
  }

  const handleReportUser = (conversationId: string) => {
    if (!userId) return
    const convo = conversations.find(c => c.id === conversationId)
    if (!convo) return
    const reportedId = convo.other_user_id === userId ? convo.user_id : convo.other_user_id

    if (Platform.OS === 'web') {
      const reason = prompt('Report User\nEnter a reason:\n' + REPORT_CATEGORIES.join(', '))
      if (reason) {
        submitReport({
          reporter_id: userId,
          reported_user_id: reportedId,
          category: reason,
          conversation_id: conversationId,
        }).then(() => alert('Report Submitted. Thank you. Our team will review this.'))
          .catch((err: any) => alert(err.message || 'Failed to submit report'))
      }
      return
    }

    Alert.alert('Report User', 'Select a reason:', [
      ...REPORT_CATEGORIES.map(cat => ({
        text: cat,
        onPress: async () => {
          try {
            await submitReport({
              reporter_id: userId,
              reported_user_id: reportedId,
              category: cat,
              conversation_id: conversationId,
            })
            Alert.alert('Report Submitted', 'Thank you. Our team will review this.')
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to submit report')
          }
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const handleArrangeMeetup = async () => {
    if (!selectedMeetupPoint || !activeConvoData?.match_id || !userId) return
    setSavingMeetup(true)
    try {
      // Save meetup to the match record
      const { error } = await supabase
        .from('matches')
        .update({
          meetup_location: selectedMeetupPoint.name,
          meetup_address: selectedMeetupPoint.address,
          meetup_time: meetupDate.toISOString(),
          meetup_set_by: userId,
          meetup_at_home_of: meetupHomeOf,
        })
        .eq('id', activeConvoData.match_id)
      if (error) throw error

      // Format time for display
      const timeStr = meetupDate.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

      // Send a system message in the chat
      const meetupMsg = `📍 Meetup arranged!\n${selectedMeetupPoint.name}\n${selectedMeetupPoint.address}\n🕐 ${timeStr}`
      await sendMessageApi(activeConvo!, userId, meetupMsg)
      setMessages(prev => [...prev])

      // Refresh messages to show the new one
      const msgs = await getMessages(activeConvo!)
      setMessages(msgs)

      // Update conversation last message
      setConversations(prev => prev.map(c =>
        c.id === activeConvo
          ? { ...c, last_message: '📍 Meetup arranged!', last_message_at: new Date().toISOString(), match: { meetup_location: selectedMeetupPoint.name, meetup_address: selectedMeetupPoint.address, meetup_time: meetupDate.toISOString(), meetup_set_by: userId } }
          : c
      ))

      // Notify the other user
      const otherId = activeConvoData.other_user_id === userId ? activeConvoData.user_id : activeConvoData.other_user_id
      const otherName = getOtherName(activeConvoData)
      const itemName = getItemName(activeConvoData)
      await createNotification({
        user_id: otherId,
        type: 'arranged',
        title: 'Meetup arranged!',
        body: `${otherName} set a meetup for "${itemName}" at ${selectedMeetupPoint.name} — ${timeStr}`,
        item_id: activeConvoData.item_id,
        match_id: activeConvoData.match_id,
      })

      // Schedule local notification reminders
      try {
        const { status } = await Notifications.requestPermissionsAsync()
        if (status === 'granted') {
          const meetupMs = meetupDate.getTime()
          const now = Date.now()
          // 30 min before reminder
          const reminderMs = meetupMs - 30 * 60 * 1000
          if (reminderMs > now) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'Meetup in 30 minutes',
                body: `Your exchange meetup at ${selectedMeetupPoint.name} is coming up soon!`,
              },
              trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(reminderMs) },
            })
          }
          // At meetup time
          if (meetupMs > now) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'Meetup time!',
                body: `Head to ${selectedMeetupPoint.name}, ${selectedMeetupPoint.address}`,
              },
              trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: meetupDate },
            })
          }
        }
      } catch (notifErr) {
        console.log('Could not schedule notifications:', notifErr)
      }

      setShowMeetupModal(false)
      setMeetupStep('location')
      setSelectedMeetupPoint(null)
      setMeetupHomeOf(null)
      setMeetupDate(new Date())
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200)
    } catch (err: any) {
      Platform.OS === 'web' ? alert(err.message || 'Failed to arrange meetup') : Alert.alert('Error', err.message || 'Failed to arrange meetup')
    } finally {
      setSavingMeetup(false)
    }
  }

  const openInMaps = (address: string) => {
    const encoded = encodeURIComponent(address)
    const url = Platform.OS === 'ios'
      ? `maps:?q=${encoded}`
      : `https://www.google.com/maps/search/?api=1&query=${encoded}`
    Linking.openURL(url)
  }

  const formatTime = (dateStr: string): string => {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return d.toLocaleDateString()
  }

  const getOtherName = (conv: Conversation): string => {
    const name = conv.other_user?.display_name || 'Unknown'
    return name.charAt(0).toUpperCase() + name.slice(1)
  }

  const getItemName = (conv: Conversation): string => {
    const t = conv.item?.title || 'Item'
    return t.charAt(0).toUpperCase() + t.slice(1)
  }

  /** Build a contextual description like "Woody is giving you a Jacket" */
  const getConvoContext = (conv: Conversation): string => {
    const otherName = getOtherName(conv)
    const itemName = getItemName(conv)
    const itemType = conv.item?.type
    const itemOwnerId = conv.item?.user_id

    if (!itemType || !itemOwnerId) return itemName

    const isOtherPersonOwner = itemOwnerId !== userId

    // "give" listing: owner is the giver. "need" listing: owner is the receiver.
    const otherIsGiver = itemType === 'give' ? isOtherPersonOwner : !isOtherPersonOwner

    return otherIsGiver
      ? `${otherName} is giving you ${itemName}`
      : `You are giving ${otherName} ${itemName}`
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kindred</Text>
        <Text style={styles.headerSub}>The community app powered by kindness</Text>
      </View>

      {!activeConvo ? (
        <ScrollView style={styles.convList}>
          {conversations.filter(c => !c.blocked_by).length > 0 && (
            <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 }}>
              <TextInput
                style={{ borderWidth: 2, borderColor: '#F2EDE7', borderRadius: 12, padding: 10, fontSize: 14, backgroundColor: '#fff', color: '#1B2A3D' }}
                placeholder="Search conversations..."
                placeholderTextColor="#C8D1DC"
                value={convoSearch}
                onChangeText={setConvoSearch}
              />
            </View>
          )}
          {conversations.filter(c => !c.blocked_by).length === 0 && (
            <View style={{ padding: 32, alignItems: 'center' }}>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>💬</Text>
              <Text style={{ fontSize: 14, color: '#8B9AAD', textAlign: 'center', lineHeight: 20 }}>
                No conversations yet. Browse items and request something to start chatting!
              </Text>
            </View>
          )}
          {conversations.filter(c => {
            if (c.blocked_by) return false
            if (!convoSearch.trim()) return true
            const q = convoSearch.toLowerCase()
            const name = (c.other_user?.display_name || '').toLowerCase()
            const item = (c.item?.title || '').toLowerCase()
            const msg = (c.last_message || '').toLowerCase()
            return name.includes(q) || item.includes(q) || msg.includes(q)
          }).map(c => (
            <TouchableOpacity
              key={c.id}
              style={[styles.convItem, (c.unread_count ?? 0) > 0 && styles.convItemUnread]}
              onPress={() => setActiveConvo(c.id)}
            >
              {c.item?.item_photos && c.item.item_photos.length > 0 ? (
                <Image source={{ uri: c.item.item_photos.sort((a, b) => a.position - b.position)[0].public_url }} style={styles.convAvatar} />
              ) : (
                <View style={styles.convAvatarFallback}>
                  <Text style={styles.convAvatarText}>{getOtherName(c).charAt(0)}</Text>
                </View>
              )}
              <View style={styles.convInfo}>
                <View style={styles.convNameRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Text style={{ fontSize: 10 }}>{getTierIcon(c.other_user?.points ?? 0)}</Text>
                    <Text style={styles.convName}>{getOtherName(c)}</Text>
                    {c.other_user?.is_premium && <Text style={{ fontSize: 10, color: '#D97706' }}>⭐Plus</Text>}
                  </View>
                  <Text style={styles.convTime}>{c.last_message_at ? formatTime(c.last_message_at) : ''}</Text>
                </View>
                <Text style={styles.convLabel}>{getConvoContext(c)}</Text>
                <Text style={styles.convLast} numberOfLines={1}>{c.last_message || 'No messages yet'}</Text>
              </View>
              {(c.unread_count ?? 0) > 0 && (
                <View style={styles.unreadBadge}><Text style={styles.unreadText}>{c.unread_count}</Text></View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.chatView}>
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={() => { setActiveConvo(null); setScamWarning(false); setMessages([]) }}>
              <Text style={styles.backBtn}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => {
              if (activeConvoData) {
                const otherId = activeConvoData.other_user_id === userId ? activeConvoData.user_id : activeConvoData.other_user_id
                openProfile(otherId)
              }
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Text style={{ fontSize: 11 }}>{getTierIcon(activeConvoData?.other_user?.points ?? 0)}</Text>
                <Text style={[styles.chatPerson, { color: '#1A9E8F' }]}>{activeConvoData ? getOtherName(activeConvoData) : ''}</Text>
                {activeConvoData?.other_user?.is_premium && <Text style={{ fontSize: 11, color: '#D97706' }}>⭐Plus</Text>}
              </View>
              <Text style={styles.chatLabel}>{activeConvoData ? getConvoContext(activeConvoData) : ''} · <Text style={{ color: '#1A9E8F' }}>View profile</Text></Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleReportUser(activeConvo)} style={styles.headerActionBtn}>
              <Text style={styles.headerActionText}>Report</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleBlockUser(activeConvo)} style={[styles.headerActionBtn, styles.headerBlockBtn]}>
              <Text style={[styles.headerActionText, styles.headerBlockText]}>Block</Text>
            </TouchableOpacity>
          </View>

          {/* Meetup card banner */}
          {activeConvoData?.match?.meetup_time && (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#E8F5F3', borderBottomWidth: 1, borderBottomColor: '#D0E8E4' }}
              onPress={() => openInMaps(activeConvoData.match!.meetup_address || activeConvoData.match!.meetup_location || '')}
            >
              <Text style={{ fontSize: 22 }}>📍</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1B2A3D' }}>{activeConvoData.match!.meetup_location}</Text>
                <Text style={{ fontSize: 11, color: '#8B9AAD' }}>{activeConvoData.match!.meetup_address}</Text>
                <Text style={{ fontSize: 11, color: '#1A9E8F', fontWeight: '600', marginTop: 2 }}>
                  {new Date(activeConvoData.match!.meetup_time!).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: '#1A9E8F', fontWeight: '600' }}>Open Maps ›</Text>
            </TouchableOpacity>
          )}

          {/* Home pickup stats for both users */}
          {activeConvoData && (() => {
            const otherId = activeConvoData.other_user_id === userId ? activeConvoData.user_id : activeConvoData.other_user_id
            const otherName = getOtherName(activeConvoData)
            const myCount = homePickupCounts[userId!] ?? 0
            const theirCount = homePickupCounts[otherId] ?? 0
            if (myCount === 0 && theirCount === 0) return null
            return (
              <View style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FBF9F6', borderBottomWidth: 1, borderBottomColor: '#F2EDE7' }}>
                {theirCount > 0 && (
                  <Text style={{ fontSize: 12, color: '#374151', lineHeight: 18 }}>
                    🏠 {otherName} has had {theirCount} successful {theirCount === 1 ? 'pickup/drop off' : 'pickups/drop offs'} at their home
                  </Text>
                )}
                {myCount > 0 && (
                  <Text style={{ fontSize: 12, color: '#374151', lineHeight: 18 }}>
                    🏠 You have had {myCount} successful {myCount === 1 ? 'pickup/drop off' : 'pickups/drop offs'} at your home
                  </Text>
                )}
              </View>
            )
          })()}

          <ScrollView ref={scrollRef} style={styles.msgThread} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
            {loading && (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: '#8B9AAD' }}>Loading messages...</Text>
              </View>
            )}
            {messages.map((m) => {
              const isMe = m.sender_id === userId
              return (
                <View key={m.id} style={[styles.msgBubbleWrap, isMe ? styles.msgMeWrap : styles.msgThemWrap]}>
                  <View style={[styles.msgBubble, isMe ? styles.msgMe : styles.msgThem]}>
                    {m.image_url ? (
                      <Image source={{ uri: m.image_url }} style={styles.msgImage} resizeMode="cover" />
                    ) : null}
                    {m.content ? (
                      <Text style={[styles.msgText, isMe && styles.msgTextMe, m.image_url ? { marginTop: 6 } : undefined]}>{m.content}</Text>
                    ) : null}
                  </View>
                  {m.scam_flagged && (
                    <Text style={{ fontSize: 10, color: '#C53030', marginTop: 2 }}>⚠️ Flagged: mentions money</Text>
                  )}
                  <Text style={styles.msgTime}>{formatTime(m.created_at)}</Text>
                </View>
              )
            })}
          </ScrollView>

          {scamWarning && (
            <View style={styles.scamWarn}>
              <Text style={styles.scamWarnText}>⚠️ This mentions money. Kindred is for free giving — no payments needed.</Text>
              <TouchableOpacity style={styles.sendAnywayBtn} onPress={() => doSendMessage()}>
                <Text style={styles.sendAnywayText}>Send Anyway</Text>
              </TouchableOpacity>
            </View>
          )}

          {pendingPhoto && (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#F8F6F2', borderTopWidth: 1, borderTopColor: '#E8E2DA' }}>
              <Image source={{ uri: pendingPhoto }} style={{ width: 60, height: 60, borderRadius: 8 }} />
              <Text style={{ flex: 1, fontSize: 12, color: '#8B9AAD', marginLeft: 10 }}>Photo ready to send</Text>
              <TouchableOpacity onPress={() => setPendingPhoto(null)}>
                <Text style={{ fontSize: 13, color: '#C53030', fontWeight: '600' }}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}
          {/* Arrange Meetup button */}
          {activeConvoData?.match_id && (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F2EDE7', backgroundColor: '#fff' }}
              onPress={() => {
                setShowMeetupModal(true); setMeetupStep('location'); setSelectedMeetupPoint(null); setMeetupHomeOf(null); setMeetupDate(new Date())
                getMeetupStats().then(setMeetupStats).catch(() => {})
                // Load home pickup counts for both users
                if (activeConvoData && userId) {
                  const otherId = activeConvoData.other_user_id === userId ? activeConvoData.user_id : activeConvoData.other_user_id
                  getHomePickupCounts([userId, otherId]).then(setHomePickupCounts).catch(() => {})
                }
              }}
            >
              <Text style={{ fontSize: 14 }}>📍</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A9E8F' }}>
                {activeConvoData?.match?.meetup_time ? 'Change Meetup' : 'Arrange Meetup'}
              </Text>
            </TouchableOpacity>
          )}
          <View style={styles.inputBar}>
            <TouchableOpacity
              style={styles.photoBtn}
              onPress={handlePickPhoto}
              disabled={sendingPhoto || !!pendingPhoto}
            >
              <Text style={styles.photoBtnText}>{sendingPhoto ? '...' : '📷'}</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.msgInput}
              placeholder={pendingPhoto ? 'Add a caption (optional)...' : 'Message...'}
              placeholderTextColor="#C8D1DC"
              value={msgInput}
              onChangeText={t => { setMsgInput(t); setScamWarning(isScamMessage(t)) }}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!msgInput.trim() && !pendingPhoto || sending) && styles.sendBtnDisabled]}
              onPress={handleSendMessage}
              disabled={(!msgInput.trim() && !pendingPhoto) || sending}
            >
              <Text style={styles.sendBtnText}>↑</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Profile viewer modal */}
      <Modal visible={!!viewingProfile || profileLoading} animationType="fade" transparent onRequestClose={() => setViewingProfile(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 340 }}>
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
                    {viewingProfile.suburb && <Text style={{ fontSize: 13, color: '#8B9AAD', marginTop: 2 }}>{cap(viewingProfile.suburb)}</Text>}
                    {distanceLabel && <Text style={{ fontSize: 11, color: '#1A9E8F', marginTop: 3 }}>{distanceLabel}</Text>}
                    {memberSince && <Text style={{ fontSize: 11, color: '#C8D1DC', marginTop: 2 }}>Member since {memberSince}</Text>}
                  </View>
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
                  {viewingProfileStats && viewingProfileStats.totalRatings > 0 && (
                    <View style={{ backgroundColor: '#FFF8E1', borderRadius: 10, padding: 10, marginBottom: 16, alignItems: 'center' }}>
                      <Text style={{ fontSize: 15, color: '#F59E0B' }}>
                        {'★'.repeat(Math.round(viewingProfileStats.avgRating || 0))}{'☆'.repeat(5 - Math.round(viewingProfileStats.avgRating || 0))}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#92400E', marginTop: 2 }}>
                        {viewingProfileStats.avgRating?.toFixed(1)} avg from {viewingProfileStats.totalRatings} {viewingProfileStats.totalRatings === 1 ? 'rating' : 'ratings'}
                      </Text>
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

                  <TouchableOpacity style={{ backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 12, alignItems: 'center' }} onPress={() => setViewingProfile(null)}>
                    <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 14 }}>Close</Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 12 }}>
                    <TouchableOpacity onPress={() => {
                      if (!userId) return
                      const doReport = (cat: string) => {
                        submitReport({ reporter_id: userId, reported_user_id: viewingProfile.id, category: cat })
                          .then(() => { Platform.OS === 'web' ? alert('Report submitted. Our team will review this.') : Alert.alert('Report Submitted', 'Thank you. Our team will review this.') })
                          .catch((err: any) => Platform.OS === 'web' ? alert(err.message || 'Failed') : Alert.alert('Error', err.message || 'Failed'))
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
                          await supabase.from('user_blocks').insert({ blocker_id: userId, blocked_id: viewingProfile.id }).then()
                          Platform.OS === 'web' ? alert('Blocked. This user can no longer request your items.') : Alert.alert('Blocked', 'This user can no longer request your items.')
                          setViewingProfile(null)
                        } catch (err: any) {
                          Platform.OS === 'web' ? alert(err.message || 'Failed') : Alert.alert('Error', err.message || 'Failed to block user')
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
      {/* Meetup arrangement modal */}
      <Modal visible={showMeetupModal} animationType="slide" transparent onRequestClose={() => setShowMeetupModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(27,42,61,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' }}>
            {meetupStep === 'location' ? (
              <>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#1B2A3D', marginBottom: 4 }}>Choose a Meetup Location</Text>
                <Text style={{ fontSize: 12, color: '#8B9AAD', marginBottom: 16 }}>Pick a home address or a safe public location</Text>
                <ScrollView style={{ maxHeight: 350 }}>
                  {/* Home options */}
                  {(() => {
                    const otherId = activeConvoData ? (activeConvoData.other_user_id === userId ? activeConvoData.user_id : activeConvoData.other_user_id) : ''
                    const otherName = activeConvoData ? getOtherName(activeConvoData) : 'Their'
                    const myAddress = profile?.home_address || null
                    const homeOptions = [
                      { id: userId!, label: 'My home', icon: '🏠', desc: myAddress || 'Set your home address in Profile first', address: myAddress, disabled: !myAddress },
                      { id: otherId, label: `${otherName}'s home`, icon: '🏠', desc: `You go to ${otherName}'s address`, address: null, disabled: false },
                    ]
                    return homeOptions.map((opt) => {
                      const isSelected = meetupHomeOf === opt.id && selectedMeetupPoint?.name === opt.label
                      const count = homePickupCounts[opt.id] ?? 0
                      return (
                        <TouchableOpacity
                          key={opt.id}
                          style={{ padding: 14, borderWidth: 2, borderColor: isSelected ? '#1A9E8F' : '#F2EDE7', borderRadius: 14, marginBottom: 8, backgroundColor: isSelected ? '#E8F5F3' : opt.disabled ? '#F5F5F5' : '#FBF9F6', opacity: opt.disabled ? 0.6 : 1 }}
                          disabled={opt.disabled}
                          onPress={() => { setSelectedMeetupPoint({ name: opt.label, address: opt.address || 'Address shared in chat', hours: '', distance: '', note: '' }); setMeetupHomeOf(opt.id) }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ fontSize: 18 }}>{opt.icon}</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1B2A3D' }}>{opt.label}</Text>
                              <Text style={{ fontSize: 12, color: opt.disabled ? '#C53030' : '#8B9AAD' }}>{opt.desc}</Text>
                              {count > 0 && (
                                <Text style={{ fontSize: 11, color: '#1A9E8F', fontWeight: '600', marginTop: 2 }}>
                                  ✓ {count} successful {count === 1 ? 'exchange' : 'exchanges'} from home
                                </Text>
                              )}
                            </View>
                          </View>
                        </TouchableOpacity>
                      )
                    })
                  })()}
                  {/* Divider */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: '#E8E2DA' }} />
                    <Text style={{ fontSize: 11, color: '#8B9AAD', marginHorizontal: 10 }}>or choose a public Meet Up Point</Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: '#E8E2DA' }} />
                  </View>
                  {DROP_POINTS.map((pt, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={{ padding: 14, borderWidth: 2, borderColor: selectedMeetupPoint?.name === pt.name && !meetupHomeOf ? '#1A9E8F' : '#F2EDE7', borderRadius: 14, marginBottom: 8, backgroundColor: selectedMeetupPoint?.name === pt.name && !meetupHomeOf ? '#E8F5F3' : '#FBF9F6' }}
                      onPress={() => { setSelectedMeetupPoint(pt); setMeetupHomeOf(null) }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 18 }}>📍</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: '#1B2A3D' }}>{pt.name}</Text>
                          <Text style={{ fontSize: 12, color: '#8B9AAD' }}>{pt.address}</Text>
                          <Text style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>{pt.hours}</Text>
                          <Text style={{ fontSize: 11, color: '#6BA368', marginTop: 1 }}>{pt.note}</Text>
                          {(meetupStats[pt.name] ?? 0) > 0 && (
                            <Text style={{ fontSize: 11, color: '#1A9E8F', fontWeight: '600', marginTop: 2 }}>
                              ✓ {meetupStats[pt.name]} successful {meetupStats[pt.name] === 1 ? 'exchange' : 'exchanges'}
                            </Text>
                          )}
                        </View>
                        <Text style={{ fontSize: 11, color: '#1A9E8F', fontWeight: '600' }}>{pt.distance}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity
                  style={{ backgroundColor: selectedMeetupPoint ? '#1A9E8F' : '#C8D1DC', borderRadius: 50, paddingVertical: 14, alignItems: 'center', marginTop: 12 }}
                  disabled={!selectedMeetupPoint}
                  onPress={() => setMeetupStep('time')}
                >
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Next — Pick a Time</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ padding: 12, alignItems: 'center', marginTop: 4 }} onPress={() => setShowMeetupModal(false)}>
                  <Text style={{ fontSize: 14, color: '#8B9AAD' }}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#1B2A3D', marginBottom: 4 }}>Pick a Date & Time</Text>
                <Text style={{ fontSize: 12, color: '#8B9AAD', marginBottom: 4 }}>Meeting at {selectedMeetupPoint?.name}</Text>
                {selectedMeetupPoint?.hours ? (
                  <Text style={{ fontSize: 11, color: '#6BA368', marginBottom: 16 }}>Hours: {selectedMeetupPoint?.hours}</Text>
                ) : (
                  <View style={{ marginBottom: 16 }} />
                )}

                {Platform.OS === 'web' ? (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1B2A3D', marginBottom: 6 }}>Date & Time</Text>
                    <TextInput
                      style={{ borderWidth: 2, borderColor: '#F2EDE7', borderRadius: 10, padding: 14, fontSize: 15, color: '#1B2A3D', backgroundColor: '#fff' }}
                      placeholder="e.g. Tomorrow 2pm"
                      placeholderTextColor="#C8D1DC"
                      value={meetupDate.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      onFocus={() => {}}
                      editable={false}
                    />
                    <Text style={{ fontSize: 11, color: '#8B9AAD', marginTop: 4 }}>Date picker not available on web — use the native app</Text>
                  </View>
                ) : (
                  <View style={{ marginBottom: 16 }}>
                    <TouchableOpacity
                      style={{ borderWidth: 2, borderColor: '#F2EDE7', borderRadius: 10, padding: 14, marginBottom: 8, backgroundColor: '#FBF9F6' }}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Text style={{ fontSize: 12, color: '#8B9AAD' }}>Date</Text>
                      <Text style={{ fontSize: 15, color: '#1B2A3D', fontWeight: '600' }}>
                        {meetupDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ borderWidth: 2, borderColor: '#F2EDE7', borderRadius: 10, padding: 14, backgroundColor: '#FBF9F6' }}
                      onPress={() => setShowTimePicker(true)}
                    >
                      <Text style={{ fontSize: 12, color: '#8B9AAD' }}>Time</Text>
                      <Text style={{ fontSize: 15, color: '#1B2A3D', fontWeight: '600' }}>
                        {meetupDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </Text>
                    </TouchableOpacity>

                    {showDatePicker && (
                      <DateTimePicker
                        value={meetupDate}
                        mode="date"
                        minimumDate={new Date()}
                        onChange={(_, date) => {
                          setShowDatePicker(false)
                          if (date) {
                            const updated = new Date(meetupDate)
                            updated.setFullYear(date.getFullYear(), date.getMonth(), date.getDate())
                            setMeetupDate(updated)
                          }
                        }}
                      />
                    )}
                    {showTimePicker && (
                      <DateTimePicker
                        value={meetupDate}
                        mode="time"
                        minuteInterval={5}
                        onChange={(_, date) => {
                          setShowTimePicker(false)
                          if (date) {
                            const updated = new Date(meetupDate)
                            updated.setHours(date.getHours(), date.getMinutes())
                            setMeetupDate(updated)
                          }
                        }}
                      />
                    )}
                  </View>
                )}

                <TouchableOpacity
                  style={{ backgroundColor: '#1A9E8F', borderRadius: 50, paddingVertical: 14, alignItems: 'center', opacity: savingMeetup ? 0.6 : 1 }}
                  disabled={savingMeetup}
                  onPress={handleArrangeMeetup}
                >
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>{savingMeetup ? 'Saving...' : 'Confirm Meetup'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ padding: 12, alignItems: 'center', marginTop: 4 }} onPress={() => setMeetupStep('location')}>
                  <Text style={{ fontSize: 14, color: '#8B9AAD' }}>Back</Text>
                </TouchableOpacity>
              </>
            )}
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
  convList: { flex: 1 },
  convItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: '#F2EDE7', backgroundColor: '#fff' },
  convItemUnread: { backgroundColor: '#E8F5F3' },
  convAvatar: { width: 44, height: 44, borderRadius: 10 },
  convAvatarFallback: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#1A9E8F', alignItems: 'center', justifyContent: 'center' },
  convAvatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  convInfo: { flex: 1 },
  convNameRow: { flexDirection: 'row', justifyContent: 'space-between' },
  convName: { fontSize: 14, fontWeight: '600', color: '#1B2A3D' },
  convTime: { fontSize: 10, color: '#C8D1DC' },
  convLabel: { fontSize: 11, color: '#1A9E8F', marginBottom: 2 },
  convLast: { fontSize: 12, color: '#8B9AAD' },
  unreadBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#C53030', alignItems: 'center', justifyContent: 'center' },
  unreadText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  chatView: { flex: 1 },
  chatHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: '#F2EDE7', backgroundColor: '#fff' },
  backBtn: { fontSize: 20 },
  chatPerson: { fontSize: 15, fontWeight: '600', color: '#1B2A3D' },
  chatLabel: { fontSize: 11, color: '#1A9E8F' },
  blockBtn: { fontSize: 16 },
  msgThread: { flex: 1, padding: 16 },
  msgBubbleWrap: { marginBottom: 8 },
  msgMeWrap: { alignItems: 'flex-end' },
  msgThemWrap: { alignItems: 'flex-start' },
  msgBubble: { maxWidth: '78%', padding: 10, borderRadius: 16 },
  msgMe: { backgroundColor: '#1A9E8F' },
  msgThem: { backgroundColor: '#fff', shadowColor: '#1B2A3D', shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  msgText: { fontSize: 14, color: '#1B2A3D', lineHeight: 20 },
  msgTextMe: { color: '#fff' },
  msgTime: { fontSize: 10, color: '#C8D1DC', marginTop: 2 },
  scamWarn: { marginHorizontal: 16, marginBottom: 8, padding: 10, backgroundColor: '#FDE8E8', borderRadius: 10, borderLeftWidth: 3, borderLeftColor: '#C53030' },
  scamWarnText: { fontSize: 12, color: '#C53030', flex: 1 },
  sendAnywayBtn: { marginTop: 6, alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#C53030', borderRadius: 12 },
  sendAnywayText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  inputBar: { flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: '#F2EDE7', backgroundColor: '#fff' },
  msgInput: { flex: 1, padding: 10, borderWidth: 2, borderColor: '#F2EDE7', borderRadius: 20, fontSize: 14, backgroundColor: '#fff', maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1A9E8F', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#C8D1DC' },
  sendBtnText: { color: '#fff', fontSize: 16 },
  headerActionBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#F2EDE7' },
  headerBlockBtn: { backgroundColor: '#FDE8E8' },
  headerActionText: { fontSize: 11, fontWeight: '600' as const, color: '#8B9AAD' },
  headerBlockText: { color: '#C53030' },
  msgImage: { width: 200, height: 200, borderRadius: 12 },
  photoBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E8F5F3', alignItems: 'center' as const, justifyContent: 'center' as const },
  photoBtnText: { fontSize: 18 },
})
