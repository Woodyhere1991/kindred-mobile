import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Image, Platform, Alert } from 'react-native'
import { useApp } from '../../lib/appContext'
import { KP_TIERS, Colors, getTierIcon } from '../../constants/theme'
import { getSuburbLeaderboard, getTimedLeaderboard, LeaderboardEntry, LeaderboardPeriod } from '../../lib/leaderboard'

const MEDAL = ['🥇', '🥈', '🥉']

export default function PointsScreen() {
  const { points, currentTier, nextTier, tierProgress, myReliability, isPremium, suburb, userId, idVerified, profile } = useApp()
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<LeaderboardPeriod>('alltime')

  const myRelScore = myReliability.total === 0 ? null : Math.round((myReliability.completed / myReliability.total) * 100)

  useEffect(() => {
    if (!suburb) { setLeaderboard([]); return }
    if (leaderboardPeriod === 'alltime') {
      getSuburbLeaderboard(suburb).then(setLeaderboard).catch(console.error)
    } else {
      getTimedLeaderboard(suburb, leaderboardPeriod).then(setLeaderboard).catch(console.error)
    }
  }, [leaderboardPeriod, suburb])

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kindred</Text>
        <Text style={styles.headerSub}>The community app powered by kindness</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Current tier */}
        <View style={styles.tierCard}>
          <Text style={styles.tierIcon}>{currentTier.icon}</Text>
          <Text style={[styles.tierName, { color: currentTier.color }]}>{currentTier.name}</Text>
          <Text style={styles.tierPoints}>{points}</Text>
          <Text style={styles.tierLabel}>Kindness Points</Text>
          {nextTier && (
            <>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${tierProgress}%` }]} />
              </View>
              <Text style={styles.tierNext}>{nextTier.min - points} Kindness Points to {nextTier.icon} {nextTier.name}</Text>
            </>
          )}
        </View>

        {/* Leaderboard */}
        {/* Leaderboard */}
        <Text style={styles.sectionTitle}>Top Givers in {suburb || 'Your Area'}</Text>
        <View style={styles.leaderToggleRow}>
          {(['daily', 'weekly', 'monthly', 'alltime'] as LeaderboardPeriod[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.leaderToggle, leaderboardPeriod === p && styles.leaderToggleActive]}
              onPress={() => setLeaderboardPeriod(p)}
            >
              <Text style={[styles.leaderToggleText, leaderboardPeriod === p && styles.leaderToggleTextActive]}>
                {p === 'alltime' ? 'All Time' : p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.leaderCard}>
          {leaderboard.length === 0 ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ fontSize: 28, marginBottom: 8 }}>🏆</Text>
              <Text style={{ fontSize: 13, color: '#8B9AAD', textAlign: 'center', lineHeight: 19 }}>
                {leaderboardPeriod === 'alltime'
                  ? `No exchanges completed in ${suburb || 'your area'} yet. Be the first!`
                  : `No activity in ${suburb || 'your area'} ${leaderboardPeriod === 'daily' ? 'today' : leaderboardPeriod === 'weekly' ? 'this week' : 'this month'} yet. Be the first!`}
              </Text>
            </View>
          ) : (
            leaderboard.map((entry, i) => {
              const isMe = entry.id === userId
              return (
                <View key={entry.id} style={[styles.leaderRow, i < leaderboard.length - 1 ? styles.earnRowBorder : undefined, isMe ? styles.leaderRowMe : undefined]}>
                  <Text style={styles.leaderRank}>{i < 3 ? MEDAL[i] : `${i + 1}`}</Text>
                  {entry.avatar_url ? (
                    <Image source={{ uri: entry.avatar_url }} style={styles.leaderAvatar} />
                  ) : (
                    <View style={[styles.leaderAvatar, styles.leaderAvatarFallback]}>
                      <Text style={{ fontSize: 14 }}>{(entry.display_name || '?').charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <Text style={{ fontSize: 11 }}>{getTierIcon(entry.total_points)}</Text>
                      <Text style={[styles.leaderName, isMe ? { color: Colors.teal, fontWeight: '700' } : undefined]}>
                        {entry.display_name ? entry.display_name.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Anonymous'}{isMe ? ' (you)' : ''}
                      </Text>
                      {entry.is_premium && <Text style={{ fontSize: 10, color: '#D97706' }}>⭐Plus</Text>}
                    </View>
                    <Text style={styles.leaderStat}>
                      {entry.completed_exchanges} {entry.completed_exchanges === 1 ? 'exchange' : 'exchanges'}
                    </Text>
                  </View>
                  <Text style={styles.leaderKp}>
                    {entry.points} Kindness Points
                  </Text>
                </View>
              )
            })
          )}
        </View>

        {/* Journey */}
        <Text style={styles.sectionTitle}>Your Journey</Text>
        <View style={styles.journeyCard}>
          <Text style={styles.journeyDesc}>Earn Kindness Points by giving, helping, and completing exchanges.</Text>
          {KP_TIERS.map((tier, i) => {
            const reached = points >= tier.min
            const isCurrent = currentTier.name === tier.name
            return (
              <View key={i} style={[styles.tierRow, { opacity: reached ? 1 : 0.5 }]}>
                <View style={[styles.tierDot, { backgroundColor: isCurrent ? tier.color + '22' : '#F2EDE7', borderColor: isCurrent ? tier.color : 'transparent' }]}>
                  <Text style={styles.tierDotIcon}>{reached ? tier.icon : '🔒'}</Text>
                </View>
                <View style={styles.tierInfo}>
                  <View style={styles.tierInfoRow}>
                    <Text style={[styles.tierInfoName, { color: isCurrent ? tier.color : '#1B2A3D' }]}>
                      {tier.name}
                      {isCurrent && <Text style={[styles.tierBadge, { backgroundColor: tier.color + '18', color: tier.color }]}> You're here</Text>}
                    </Text>
                    <Text style={styles.tierMin}>{tier.min} Kindness Points</Text>
                  </View>
                  <Text style={styles.tierPerks}>
                    {tier.name === 'Newcomer' ? 'Community feed, basic matching, create listings (3/day)' :
                     tier.name === 'Open' ? 'Open badge on profile, priority placement in browse results' :
                     tier.name === 'Connected' ? '5 listings/day, Connected badge, early access to new features' :
                     tier.name === 'Elevated' ? '7 listings/day, boosted listings in browse, custom profile colour' :
                     '10 listings/day, Kindred Spirit crown, entered in monthly giveaway draw'}
                  </Text>
                </View>
              </View>
            )
          })}
        </View>

        {/* Reliability */}
        <Text style={styles.sectionTitle}>Your Reliability</Text>
        <View style={styles.reliabilityCard}>
          <Text style={styles.reliabilityDesc}>Your reliability is based on your completion rate.</Text>
          <View style={styles.reliabilityStats}>
            <View>
              {myRelScore !== null ? (
                <>
                  <Text style={[styles.reliabilityScore, { color: myRelScore >= 90 ? '#6BA368' : myRelScore >= 70 ? '#F4A261' : '#C53030' }]}>{myRelScore}%</Text>
                  <Text style={styles.reliabilityLabel}>
                    {myRelScore >= 90 ? 'Reliable' : myRelScore >= 70 ? 'Building trust' : 'Low'}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.reliabilityScore}>--</Text>
                  <Text style={styles.reliabilityLabel}>No exchanges yet</Text>
                </>
              )}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              {myReliability.streak >= 3 && (
                <View style={styles.streakBadge}><Text style={styles.streakText}>🔥 {myReliability.streak} streak</Text></View>
              )}
              <Text style={styles.reliabilityTotal}>{myReliability.completed} of {myReliability.total} completed</Text>
            </View>
          </View>
          {myRelScore !== null ? (
            <View style={styles.reliabilityBar}><View style={[styles.reliabilityFill, { width: `${myRelScore}%`, backgroundColor: myRelScore >= 90 ? '#6BA368' : myRelScore >= 70 ? '#F4A261' : '#C53030' }]} /></View>
          ) : (
            <View style={styles.reliabilityBar} />
          )}
          <View style={styles.reliabilityLabels}><Text style={styles.reliabilityLabelSmall}>0%</Text><Text style={styles.reliabilityLabelSmall}>100%</Text></View>
        </View>

        {/* How to earn */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>How to Earn</Text>
          {isPremium && <Text style={{ fontSize: 11, color: '#D4A843', fontWeight: '600' }}>All points now doubled with ⭐Plus</Text>}
        </View>
        <View style={styles.earnCard}>
          {[
            { a: 'Create a Listing', base: 5, d: 'Post something to give or something you need', i: '📝' },
            { a: 'Complete an Exchange (Giver)', base: 25, d: 'Successfully give away an item', i: '🎁' },
            { a: 'Complete an Exchange (Receiver)', base: 5, d: 'Confirm you received an item', i: '📦' },
            { a: 'Rate an Exchange', base: 5, d: 'Leave a rating after completing an exchange', i: '✍️' },
            ...((myReliability.completed === 0) ? [{ a: 'First Exchange Bonus', base: 50, d: 'One-time bonus for your very first exchange', i: '🎉' }] : []),
            { a: '5-Star Rating Bonus', base: 10, d: 'When someone gives you a 5-star review', i: '⭐' },
            ...(!profile?.phone_verified ? [{ a: 'Verify Your Phone', base: 50, d: 'One-time bonus for phone verification', i: '📱' }] : []),
            ...(!idVerified ? [{ a: 'Verify Your Identity', base: 100, d: 'One-time bonus for identity verification', i: '🛡️' }] : []),
          ].map((x, i, arr) => {
            const amt = isPremium ? x.base * 2 : x.base
            return (
              <View key={i} style={[styles.earnRow, i < arr.length - 1 ? styles.earnRowBorder : undefined]}>
                <View style={styles.earnIcon}><Text style={{ fontSize: 16 }}>{x.i}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.earnAction}>{x.a}</Text>
                  <Text style={styles.earnDesc}>{x.d}</Text>
                </View>
                <Text style={styles.earnPoints}>+{amt}</Text>
              </View>
            )
          })}
        </View>

        {/* Plus upsell */}
        {!isPremium && (
          <View style={styles.plusCard}>
            <Text style={styles.plusIcon}>⭐</Text>
            <Text style={styles.plusTitle}>Kindred Plus</Text>
            <Text style={styles.plusDesc}>
              Do more, earn more, and let the app work harder for you.
            </Text>
            <View style={styles.plusPerks}>
              <Text style={styles.plusPerk}>✓  2x Kindness Points on everything</Text>
              <Text style={styles.plusPerk}>✓  Unlimited daily listings</Text>
              <Text style={styles.plusPerk}>✓  Smart matching — we find gives for your needs</Text>
              <Text style={styles.plusPerk}>✓  Plus badge on your profile</Text>
            </View>
            <Text style={styles.plusCommunity}>
              Plus members power the Kindred community — your support helps us keep growing!
            </Text>
            <TouchableOpacity style={styles.plusBtn} onPress={() => {
              const msg = 'Kindred Plus is coming soon! We\'ll let you know when it\'s available.'
              Platform.OS === 'web' ? alert(msg) : Alert.alert('Coming Soon', msg)
            }}>
              <Text style={styles.plusBtnText}>Upgrade to Plus</Text>
            </TouchableOpacity>
          </View>
        )}

        {isPremium && (
          <View style={styles.plusActiveCard}>
            <Text style={styles.plusActiveText}>⭐ You're a Kindred Plus member — thank you for powering kindness!</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF9F6' },
  header: { paddingHorizontal: 18, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F2EDE7' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#1A9E8F' },
  headerSub: { fontSize: 11, color: '#8B9AAD' },
  content: { flex: 1, padding: 16 },

  // Tier card
  tierCard: { backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center', marginBottom: 20, shadowColor: '#1B2A3D', shadowOpacity: 0.08, shadowRadius: 16, elevation: 2 },
  tierIcon: { fontSize: 42, marginBottom: 8 },
  tierName: { fontSize: 24, fontWeight: '700' },
  tierPoints: { fontSize: 32, fontWeight: '700', color: '#1A9E8F', marginTop: 8 },
  tierLabel: { fontSize: 12, color: '#8B9AAD', textTransform: 'uppercase', letterSpacing: 1 },
  progressBar: { width: '100%', height: 8, backgroundColor: '#F2EDE7', borderRadius: 50, marginTop: 16, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 50, backgroundColor: '#1A9E8F' },
  tierNext: { fontSize: 12, color: '#8B9AAD', marginTop: 8 },

  // Sections
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1B2A3D', marginBottom: 12 },

  // Journey
  journeyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20, shadowColor: '#1B2A3D', shadowOpacity: 0.04, elevation: 1 },
  journeyDesc: { fontSize: 12, color: '#8B9AAD', marginBottom: 14, lineHeight: 18 },
  tierRow: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  tierDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  tierDotIcon: { fontSize: 18 },
  tierInfo: { flex: 1 },
  tierInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tierInfoName: { fontSize: 13, fontWeight: '600' },
  tierBadge: { fontSize: 10, paddingHorizontal: 8, paddingVertical: 1, borderRadius: 50, marginLeft: 6 },
  tierMin: { fontSize: 11, color: '#C8D1DC', fontWeight: '600' },
  tierPerks: { fontSize: 12, color: '#8B9AAD', marginTop: 2 },

  // Reliability
  reliabilityCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#1B2A3D', shadowOpacity: 0.04, elevation: 1 },
  reliabilityDesc: { fontSize: 12, color: '#8B9AAD', marginBottom: 12, lineHeight: 18 },
  reliabilityStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  reliabilityScore: { fontSize: 32, fontWeight: '700', color: '#8B9AAD' },
  reliabilityLabel: { fontSize: 12, color: '#8B9AAD' },
  streakBadge: { backgroundColor: 'linear-gradient(135deg,#FFD700,#FFA500)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 50, marginBottom: 4 },
  streakText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  reliabilityTotal: { fontSize: 11, color: '#8B9AAD' },
  reliabilityBar: { height: 8, backgroundColor: '#F2EDE7', borderRadius: 50, overflow: 'hidden' },
  reliabilityFill: { height: '100%', borderRadius: 50 },
  reliabilityLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  reliabilityLabelSmall: { fontSize: 10, color: '#C8D1DC' },

  // Earn
  earnCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20, shadowColor: '#1B2A3D', shadowOpacity: 0.04, elevation: 1 },
  earnRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  earnRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F2EDE7' },
  earnIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#E8F5F3', alignItems: 'center', justifyContent: 'center' },
  earnAction: { fontSize: 13, fontWeight: '600', color: '#1B2A3D' },
  earnDesc: { fontSize: 11, color: '#8B9AAD' },
  earnPoints: { fontSize: 14, fontWeight: '700', color: '#6BA368' },

  // Leaderboard
  leaderToggleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  leaderToggle: { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F2EDE7', alignItems: 'center' as const },
  leaderToggleActive: { backgroundColor: '#1A9E8F' },
  leaderToggleText: { fontSize: 12, fontWeight: '600' as const, color: '#8B9AAD' },
  leaderToggleTextActive: { color: '#fff' },
  leaderCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20, shadowColor: '#1B2A3D', shadowOpacity: 0.04, elevation: 1 },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  leaderRowMe: { backgroundColor: '#E8F5F3', marginHorizontal: -16, paddingHorizontal: 16, borderRadius: 8 },
  leaderRank: { fontSize: 16, fontWeight: '700', color: '#8B9AAD', width: 28, textAlign: 'center' },
  leaderAvatar: { width: 32, height: 32, borderRadius: 16 },
  leaderAvatarFallback: { backgroundColor: '#E8E2DA', alignItems: 'center' as const, justifyContent: 'center' as const },
  leaderName: { fontSize: 13, fontWeight: '600' as const, color: '#1B2A3D' },
  leaderStat: { fontSize: 11, color: '#8B9AAD' },
  leaderKp: { fontSize: 12, fontWeight: '600' as const, color: '#1A9E8F' },

  // Plus upsell
  plusCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, marginBottom: 20, borderWidth: 2, borderColor: '#D4A843', shadowColor: '#D4A843', shadowOpacity: 0.15, shadowRadius: 12, elevation: 3, alignItems: 'center' as const },
  plusIcon: { fontSize: 32, marginBottom: 6 },
  plusTitle: { fontSize: 20, fontWeight: '700' as const, color: '#D4A843', marginBottom: 6 },
  plusDesc: { fontSize: 13, color: '#8B9AAD', textAlign: 'center' as const, lineHeight: 19, marginBottom: 14 },
  plusPerks: { alignSelf: 'stretch' as const, marginBottom: 14 },
  plusPerk: { fontSize: 13, color: '#1B2A3D', lineHeight: 24, paddingLeft: 4 },
  plusCommunity: { fontSize: 12, color: '#8B9AAD', textAlign: 'center' as const, lineHeight: 18, fontStyle: 'italic' as const, marginBottom: 16, paddingHorizontal: 8 },
  plusBtn: { backgroundColor: '#D4A843', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 50 },
  plusBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' as const },
  plusActiveCard: { backgroundColor: '#FFF8E1', borderRadius: 16, padding: 16, marginBottom: 20, alignItems: 'center' as const, borderWidth: 1, borderColor: '#D4A843' },
  plusActiveText: { fontSize: 13, color: '#D4A843', fontWeight: '600' as const, textAlign: 'center' as const },
})
