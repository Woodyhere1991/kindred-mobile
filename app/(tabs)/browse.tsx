import { View, Text, StyleSheet, SafeAreaView } from 'react-native'
import { Colors } from '../../constants/theme'

export default function BrowseScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🔍</Text>
        <Text style={styles.heading}>Browse Nearby</Text>
        <Text style={styles.desc}>Items and services from your community will appear here.</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emoji: { fontSize: 48, marginBottom: 12 },
  heading: { fontSize: 18, fontWeight: '600', color: Colors.dark, marginBottom: 6 },
  desc: { fontSize: 14, color: Colors.grey, textAlign: 'center' },
})
