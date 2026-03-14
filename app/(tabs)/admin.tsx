import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, RefreshControl, Alert, Platform, Image,
} from 'react-native'
import { Colors, Radius } from '../../constants/theme'
import { useApp } from '../../lib/appContext'
import { supabase } from '../../lib/supabase'
import {
  getPendingVerifications, getSignedUrl, approveVerification, rejectVerification,
  IdVerification,
} from '../../lib/verification'
type Tab = 'overview' | 'users' | 'items' | 'reports' | 'verify'

interface UserRow {
  id: string
  display_name: string | null
  suburb: string | null
  points: number
  is_admin: boolean
  is_premium: boolean
  id_verified: boolean
  created_at: string
}

interface ItemRow {
  id: number
  title: string
  type: string
  category: string
  status: string
  user_id: string
  created_at: string
  user?: { display_name: string | null }
}

interface ReportRow {
  id: number
  category: string
  details: string | null
  created_at: string
  reporter?: { display_name: string | null }
  reported_user?: { display_name: string | null }
}

interface Stats {
  totalUsers: number
  totalItems: number
  activeItems: number
  totalMatches: number
  totalConversations: number
  totalReports: number
}

export default function AdminScreen() {
  const { isAdmin, userId, refreshProfile } = useApp()
  const [tab, setTab] = useState<Tab>('overview')
  const [refreshing, setRefreshing] = useState(false)

  // Data
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalItems: 0, activeItems: 0, totalMatches: 0, totalConversations: 0, totalReports: 0 })
  const [users, setUsers] = useState<UserRow[]>([])
  const [items, setItems] = useState<ItemRow[]>([])
  const [reports, setReports] = useState<ReportRow[]>([])
  const [verifications, setVerifications] = useState<IdVerification[]>([])
  const [verifyPhotos, setVerifyPhotos] = useState<Record<string, { idUrl: string; selfieUrl: string }>>({})

  const fetchVerifications = useCallback(async () => {
    try {
      const data = await getPendingVerifications()
      setVerifications(data)
      // Load signed URLs for each
      const photos: Record<string, { idUrl: string; selfieUrl: string }> = {}
      for (const v of data) {
        try {
          const [idUrl, selfieUrl] = await Promise.all([
            getSignedUrl(v.id_photo_path),
            getSignedUrl(v.selfie_path),
          ])
          photos[v.id] = { idUrl, selfieUrl }
        } catch {
          // Skip if can't load photos
        }
      }
      setVerifyPhotos(photos)
    } catch (err) {
      console.error('Failed to fetch verifications:', err)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    const [usersRes, itemsRes, activeRes, matchesRes, convsRes, reportsRes] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('items').select('*', { count: 'exact', head: true }),
      supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'listed'),
      supabase.from('matches').select('*', { count: 'exact', head: true }),
      supabase.from('conversations').select('*', { count: 'exact', head: true }),
      supabase.from('reports').select('*', { count: 'exact', head: true }),
    ])
    setStats({
      totalUsers: usersRes.count ?? 0,
      totalItems: itemsRes.count ?? 0,
      activeItems: activeRes.count ?? 0,
      totalMatches: matchesRes.count ?? 0,
      totalConversations: convsRes.count ?? 0,
      totalReports: reportsRes.count ?? 0,
    })
  }, [])

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, suburb, points, is_admin, is_premium, id_verified, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    setUsers((data as UserRow[]) || [])
  }, [])

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from('items')
      .select('id, title, type, category, status, user_id, created_at, user:profiles!items_user_id_fkey(display_name)')
      .order('created_at', { ascending: false })
      .limit(100)
    setItems((data as unknown as ItemRow[]) || [])
  }, [])

  const fetchReports = useCallback(async () => {
    const { data } = await supabase
      .from('reports')
      .select('id, category, details, created_at, reporter:profiles!reports_reporter_id_fkey(display_name), reported_user:profiles!reports_reported_user_id_fkey(display_name)')
      .order('created_at', { ascending: false })
      .limit(100)
    setReports((data as unknown as ReportRow[]) || [])
  }, [])

  const loadData = useCallback(async () => {
    setRefreshing(true)
    await fetchStats()
    if (tab === 'users') await fetchUsers()
    if (tab === 'items') await fetchItems()
    if (tab === 'reports') await fetchReports()
    if (tab === 'verify') await fetchVerifications()
    setRefreshing(false)
  }, [tab, fetchStats, fetchUsers, fetchItems, fetchReports, fetchVerifications])

  useEffect(() => { loadData() }, [loadData])

  const confirmAction = (title: string, msg: string, action: () => void) => {
    if (Platform.OS === 'web') {
      if (confirm(`${title}\n${msg}`)) action()
    } else {
      Alert.alert(title, msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', style: 'destructive', onPress: action },
      ])
    }
  }

  const handleDeleteItem = (itemId: number) => {
    confirmAction('Delete Item', 'Are you sure you want to delete this item?', async () => {
      await supabase.from('items').delete().eq('id', itemId)
      setItems(prev => prev.filter(i => i.id !== itemId))
      setStats(prev => ({ ...prev, totalItems: prev.totalItems - 1 }))
    })
  }

  const handleToggleVerified = async (targetId: string, current: boolean) => {
    await supabase.from('profiles').update({ id_verified: !current }).eq('id', targetId)
    setUsers(prev => prev.map(u => u.id === targetId ? { ...u, id_verified: !current } : u))
  }

  const handleTogglePremium = async (targetId: string, current: boolean) => {
    await supabase.from('profiles').update({ is_premium: !current }).eq('id', targetId)
    setUsers(prev => prev.map(u => u.id === targetId ? { ...u, is_premium: !current } : u))
    if (targetId === userId) await refreshProfile()
  }

  const handleToggleAdmin = (targetId: string, current: boolean) => {
    confirmAction(
      current ? 'Remove Admin' : 'Make Admin',
      current ? 'Remove admin access from this user?' : 'Give this user admin access?',
      async () => {
        await supabase.from('profiles').update({ is_admin: !current }).eq('id', targetId)
        setUsers(prev => prev.map(u => u.id === targetId ? { ...u, is_admin: !current } : u))
      }
    )
  }

  const handleDeleteUser = (targetId: string, displayName: string | null) => {
    if (targetId === userId) {
      const msg = 'You cannot delete your own account from the admin panel.'
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg)
      return
    }
    confirmAction(
      'Delete User Account',
      `Permanently delete ${displayName || 'this user'} and ALL their data (items, messages, photos, etc.)? This cannot be undone.`,
      async () => {
        try {
          // Delete storage files first (avatars, item photos, ID docs, qualifications)
          const storageFolders = [
            { bucket: 'avatars', path: targetId },
            { bucket: 'item-photos', path: targetId },
            { bucket: 'id-verifications', path: targetId },
            { bucket: 'qualifications', path: targetId },
          ]
          for (const { bucket, path } of storageFolders) {
            try {
              const { data: files } = await supabase.storage.from(bucket).list(path)
              if (files && files.length > 0) {
                const paths = files.map(f => `${path}/${f.name}`)
                await supabase.storage.from(bucket).remove(paths)
              }
            } catch {
              // Storage folder may not exist, continue
            }
          }

          // Call the database function to delete user and all data
          const { error } = await supabase.rpc('admin_delete_user', { target_user_id: targetId })
          if (error) throw error

          setUsers(prev => prev.filter(u => u.id !== targetId))
          setStats(prev => ({ ...prev, totalUsers: prev.totalUsers - 1 }))
          const msg = `${displayName || 'User'} has been deleted.`
          Platform.OS === 'web' ? alert(msg) : Alert.alert('Done', msg)
        } catch (err: any) {
          const msg = err.message || 'Failed to delete user'
          Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg)
        }
      }
    )
  }

  const handleApproveVerification = (v: IdVerification) => {
    confirmAction('Approve Verification', `Approve ID for ${v.profiles?.display_name || 'this user'}? They'll get +100 KP (or +200 if Plus) and a verified badge.`, async () => {
      try {
        await approveVerification(v.id, userId!)
        setVerifications(prev => prev.filter(x => x.id !== v.id))
        const msg = 'Verification approved!'
        Platform.OS === 'web' ? alert(msg) : Alert.alert('Done', msg)
      } catch (err: any) {
        const msg = err.message || 'Failed to approve'
        Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg)
      }
    })
  }

  const handleRejectVerification = (v: IdVerification) => {
    confirmAction('Reject Verification', `Reject ID for ${v.profiles?.display_name || 'this user'}?`, async () => {
      try {
        await rejectVerification(v.id, userId!, 'Photos do not match or are unclear')
        setVerifications(prev => prev.filter(x => x.id !== v.id))
        const msg = 'Verification rejected.'
        Platform.OS === 'web' ? alert(msg) : Alert.alert('Done', msg)
      } catch (err: any) {
        const msg = err.message || 'Failed to reject'
        Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg)
      }
    })
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noAccess}>
          <Text style={{ fontSize: 48 }}>🔒</Text>
          <Text style={styles.noAccessTitle}>Admin Only</Text>
          <Text style={styles.noAccessDesc}>You don't have admin access.</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Panel</Text>
      </View>

      {/* Tab bar */}
      <View style={styles.tabs}>
        {(['overview', 'users', 'items', 'reports', 'verify'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'overview' ? '📊' : t === 'users' ? '👥' : t === 'items' ? '📦' : t === 'reports' ? '🚨' : '🛡️'}
              {' '}{t === 'verify' ? 'ID' : t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={Colors.teal} />}
      >
        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <View>
            <View style={styles.statsGrid}>
              <StatCard label="Users" value={stats.totalUsers} emoji="👥" />
              <StatCard label="Items" value={stats.totalItems} emoji="📦" />
              <StatCard label="Active Listings" value={stats.activeItems} emoji="🟢" />
              <StatCard label="Matches" value={stats.totalMatches} emoji="🤝" />
              <StatCard label="Conversations" value={stats.totalConversations} emoji="💬" />
              <StatCard label="Reports" value={stats.totalReports} emoji="🚨" color={stats.totalReports > 0 ? Colors.red : undefined} />
            </View>
          </View>
        )}

        {/* USERS TAB */}
        {tab === 'users' && (
          <View>
            <Text style={styles.sectionTitle}>{users.length} users</Text>
            {users.map(u => (
              <View key={u.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      {u.display_name || 'No name'}
                      {u.is_admin ? ' (Admin)' : ''}
                    </Text>
                    <Text style={styles.cardSub}>
                      {u.suburb || 'No suburb'} · {u.points} pts
                      {u.id_verified ? ' · Verified' : ''}
                      {u.is_premium ? ' · ⭐ Plus' : ''}
                    </Text>
                    <Text style={styles.cardDate}>
                      Joined {new Date(u.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, u.id_verified ? styles.actionBtnActive : null]}
                      onPress={() => handleToggleVerified(u.id, u.id_verified)}
                    >
                      <Text style={styles.actionBtnText}>{u.id_verified ? 'Unverify' : 'Verify'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, u.is_premium ? styles.actionBtnPremium : null]}
                      onPress={() => handleTogglePremium(u.id, u.is_premium)}
                    >
                      <Text style={styles.actionBtnText}>{u.is_premium ? '⭐ Remove Plus' : '⭐ Give Plus'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, u.is_admin ? styles.actionBtnDanger : null]}
                      onPress={() => handleToggleAdmin(u.id, u.is_admin)}
                    >
                      <Text style={styles.actionBtnText}>{u.is_admin ? 'Remove Admin' : 'Make Admin'}</Text>
                    </TouchableOpacity>
                    {u.id !== userId && (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnDanger]}
                        onPress={() => handleDeleteUser(u.id, u.display_name)}
                      >
                        <Text style={[styles.actionBtnText, { color: Colors.red }]}>Delete</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ITEMS TAB */}
        {tab === 'items' && (
          <View>
            <Text style={styles.sectionTitle}>{items.length} items</Text>
            {items.map(item => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardSub}>
                      {item.type === 'give' ? 'Giving' : 'Needing'} · {item.category} · {item.status}
                    </Text>
                    <Text style={styles.cardDate}>
                      by {(item.user as any)?.display_name || 'Unknown'} · {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnDanger]}
                    onPress={() => handleDeleteItem(item.id)}
                  >
                    <Text style={styles.actionBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* REPORTS TAB */}
        {tab === 'reports' && (
          <View>
            <Text style={styles.sectionTitle}>{reports.length} reports</Text>
            {reports.length === 0 && (
              <Text style={styles.emptyText}>No reports yet</Text>
            )}
            {reports.map(r => (
              <View key={r.id} style={[styles.card, { borderLeftWidth: 3, borderLeftColor: Colors.red }]}>
                <Text style={styles.cardTitle}>{r.category}</Text>
                <Text style={styles.cardSub}>{r.details || 'No details'}</Text>
                <Text style={styles.cardDate}>
                  Reported by {(r.reporter as any)?.display_name || 'Unknown'}
                  {' → '}{(r.reported_user as any)?.display_name || 'Unknown'}
                  {' · '}{new Date(r.created_at).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ID VERIFICATIONS TAB */}
        {tab === 'verify' && (
          <View>
            <Text style={styles.sectionTitle}>{verifications.length} pending verifications</Text>
            {verifications.length === 0 && (
              <Text style={styles.emptyText}>No pending verifications</Text>
            )}
            {verifications.map(v => (
              <View key={v.id} style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#D4A843' }]}>
                <Text style={styles.cardTitle}>{v.profiles?.display_name || 'Unknown user'}</Text>
                <Text style={styles.cardSub}>{v.document_type} · Submitted {new Date(v.created_at).toLocaleDateString()}</Text>

                {verifyPhotos[v.id] && (
                  <View style={styles.verifyPhotoRow}>
                    <View style={styles.verifyPhotoCol}>
                      <Text style={styles.verifyPhotoLabel}>ID Document</Text>
                      <Image source={{ uri: verifyPhotos[v.id].idUrl }} style={styles.verifyPhoto} />
                    </View>
                    <View style={styles.verifyPhotoCol}>
                      <Text style={styles.verifyPhotoLabel}>Selfie</Text>
                      <Image source={{ uri: verifyPhotos[v.id].selfieUrl }} style={styles.verifyPhoto} />
                    </View>
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { flex: 1, backgroundColor: '#E8F5F3' }]}
                    onPress={() => handleApproveVerification(v)}
                  >
                    <Text style={[styles.actionBtnText, { color: '#147A6E' }]}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { flex: 1, backgroundColor: Colors.redLight }]}
                    onPress={() => handleRejectVerification(v)}
                  >
                    <Text style={[styles.actionBtnText, { color: Colors.red }]}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

function StatCard({ label, value, emoji, color }: { label: string; value: number; emoji: string; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={{ fontSize: 24 }}>{emoji}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.dark },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 6, marginBottom: 8 },
  tab: {
    flex: 1, paddingVertical: 8, borderRadius: Radius.sm,
    backgroundColor: '#fff', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.sand,
  },
  tabActive: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  tabText: { fontSize: 11, fontWeight: '600', color: Colors.grey },
  tabTextActive: { color: '#fff' },
  scroll: { padding: 16, paddingBottom: 40 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    width: '47%', backgroundColor: '#fff', borderRadius: Radius.md,
    padding: 16, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: Colors.sand,
  },
  statValue: { fontSize: 28, fontWeight: '700', color: Colors.dark },
  statLabel: { fontSize: 12, color: Colors.grey, fontWeight: '500' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: Colors.grey, marginBottom: 12 },
  card: {
    backgroundColor: '#fff', borderRadius: Radius.md, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.sand,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: Colors.dark },
  cardSub: { fontSize: 12, color: Colors.grey, marginTop: 2 },
  cardDate: { fontSize: 11, color: Colors.greyLight, marginTop: 4 },
  cardActions: { gap: 6 },
  actionBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
    backgroundColor: Colors.sand, alignItems: 'center',
  },
  actionBtnActive: { backgroundColor: Colors.tealLight },
  actionBtnPremium: { backgroundColor: '#FFF8E1', borderWidth: 1, borderColor: '#D4A843' },
  actionBtnDanger: { backgroundColor: Colors.redLight },
  actionBtnText: { fontSize: 11, fontWeight: '600', color: Colors.dark },
  noAccess: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  noAccessTitle: { fontSize: 22, fontWeight: '700', color: Colors.dark },
  noAccessDesc: { fontSize: 14, color: Colors.grey },
  emptyText: { fontSize: 14, color: Colors.grey, textAlign: 'center', marginTop: 40 },
  verifyPhotoRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  verifyPhotoCol: { flex: 1, alignItems: 'center' },
  verifyPhotoLabel: { fontSize: 11, fontWeight: '600', color: Colors.grey, marginBottom: 4 },
  verifyPhoto: { width: '100%', aspectRatio: 0.75, borderRadius: 8, backgroundColor: Colors.sand },
})
