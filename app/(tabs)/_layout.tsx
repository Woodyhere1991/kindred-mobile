import { Tabs } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { Colors } from '../../constants/theme'
import { useApp } from '../../lib/appContext'

function TabIcon({ emoji, label, focused, badge }: { emoji: string; label: string; focused: boolean; badge?: number }) {
  return (
    <View style={styles.tabIconWrap}>
      <Text style={styles.tabEmoji}>{emoji}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
      {focused && <View style={styles.activeIndicator} />}
      {badge ? (
        <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>
      ) : null}
    </View>
  )
}

export default function TabsLayout() {
  const { totalUnreadMsgs, isAdmin } = useApp()
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" label="Activity" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="💬" label="Messages" focused={focused} badge={totalUnreadMsgs || undefined} />,
        }}
      />
      <Tabs.Screen
        name="points"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="✨" label="Points" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Profile" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          href: isAdmin ? '/admin' : null,
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" label="Admin" focused={focused} />,
        }}
      />
      {/* Hide browse from tabs - it's a sub-tab inside Activity */}
      <Tabs.Screen name="browse" options={{ href: null }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F2EDE7',
    height: 60,
  },
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingTop: 4,
  },
  tabEmoji: { fontSize: 18 },
  tabLabel: { fontSize: 11, fontWeight: '500', color: '#8B9AAD', marginTop: 2 },
  tabLabelActive: { color: '#1A9E8F', fontWeight: '600' },
  badge: {
    position: 'absolute', top: -2, right: -10,
    backgroundColor: '#C53030', borderRadius: 7,
    width: 14, height: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 8, fontWeight: '700' },
  activeIndicator: { width: 20, height: 3, borderRadius: 1.5, backgroundColor: '#1A9E8F', marginTop: 2 },
})
