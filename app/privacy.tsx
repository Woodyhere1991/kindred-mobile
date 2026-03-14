import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native'
import { router } from 'expo-router'
import { Colors } from '../constants/theme'

export default function PrivacyScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.updated}>Last updated: 12 March 2026</Text>

        <Text style={styles.body}>
          Kindred ("we", "us", "our") operates the Kindred mobile application. This Privacy Policy
          explains how we collect, use, disclose, and safeguard your information when you use our app.
          We are committed to complying with the New Zealand Privacy Act 2020.
        </Text>

        <Text style={styles.heading}>1. Information We Collect</Text>
        <Text style={styles.subheading}>Account Information</Text>
        <Text style={styles.body}>
          When you create an account, we collect your name, email address, phone number (optional),
          date of birth, and suburb. If you sign in with Google, we receive your name and email from
          your Google account.
        </Text>

        <Text style={styles.subheading}>Location Data</Text>
        <Text style={styles.body}>
          With your permission, we collect your device's GPS coordinates to show you nearby community
          members and items. You can set a home location for browsing when you are away from home.
          Location data is stored on our servers to enable proximity-based features.
        </Text>

        <Text style={styles.subheading}>Photos and Media</Text>
        <Text style={styles.body}>
          You may upload photos of items you are listing, a profile photo, identity documents for
          verification, and qualification certificates. These are stored securely in our cloud storage.
        </Text>

        <Text style={styles.subheading}>Messages</Text>
        <Text style={styles.body}>
          We store messages you send to other users through the in-app messaging system to facilitate
          exchanges and for safety purposes.
        </Text>

        <Text style={styles.subheading}>Usage Data</Text>
        <Text style={styles.body}>
          We collect information about your activity on the platform, including items listed, exchanges
          completed, points earned, and interactions with other users.
        </Text>

        <Text style={styles.subheading}>Emergency Contacts</Text>
        <Text style={styles.body}>
          You may optionally provide an emergency contact name and phone number for safety features.
          This information is only used in safety-related situations.
        </Text>

        <Text style={styles.heading}>2. How We Use Your Information</Text>
        <Text style={styles.body}>
          We use your information to:{'\n'}
          {'\n'}{'\u2022'} Provide and maintain the Kindred service{'\n'}
          {'\u2022'} Connect you with nearby community members{'\n'}
          {'\u2022'} Facilitate item exchanges and messaging{'\n'}
          {'\u2022'} Operate the Kindred Points reward system{'\n'}
          {'\u2022'} Verify your identity when requested{'\n'}
          {'\u2022'} Ensure platform safety and prevent misuse{'\n'}
          {'\u2022'} Send you notifications about exchanges and messages{'\n'}
          {'\u2022'} Improve and develop new features{'\n'}
          {'\n'}We do not sell your personal data to third parties.
        </Text>

        <Text style={styles.heading}>3. Data Sharing</Text>
        <Text style={styles.body}>
          We share limited information with other Kindred users as part of the service (e.g. your
          name, suburb, profile photo, and listed items are visible to other users). Your email,
          phone number, date of birth, and ID verification documents are never shared with other users.
          {'\n\n'}We use Supabase as our backend infrastructure provider, which stores data in
          secure, encrypted servers. We may also share data if required by New Zealand law or to
          protect the safety of our users.
        </Text>

        <Text style={styles.heading}>4. Data Storage and Security</Text>
        <Text style={styles.body}>
          Your data is stored securely using Supabase, our backend infrastructure provider, with
          servers located in the Oceania (Sydney) region. All data is encrypted in transit using TLS
          and at rest. Authentication is handled securely through our backend provider.
          {'\n\n'}
          The App uses local storage on your device (AsyncStorage and SecureStore) to maintain your
          session and preferences. This data remains on your device and is not transmitted to third
          parties.
          {'\n\n'}
          However, no method of electronic transmission or storage is 100% secure, and we cannot
          guarantee absolute security.
        </Text>

        <Text style={styles.heading}>5. Data Retention</Text>
        <Text style={styles.body}>
          We retain your data for as long as your account is active. If you delete your account, we
          will delete your personal data within 30 days, except where we are required to retain it
          by law. Anonymised, aggregated data may be retained for analytics purposes.
        </Text>

        <Text style={styles.heading}>6. Your Rights</Text>
        <Text style={styles.body}>
          Under the New Zealand Privacy Act 2020, you have the right to:{'\n'}
          {'\n'}{'\u2022'} Access your personal information{'\n'}
          {'\u2022'} Request correction of inaccurate data{'\n'}
          {'\u2022'} Request deletion of your data{'\n'}
          {'\u2022'} Withdraw consent for location tracking at any time{'\n'}
          {'\u2022'} Delete your account through the app{'\n'}
          {'\n'}You can exercise these rights through your profile settings or by contacting us.
        </Text>

        <Text style={styles.heading}>7. Children's Privacy</Text>
        <Text style={styles.body}>
          Kindred is not intended for users under the age of 18. We do not knowingly collect personal
          information from children. If we learn that we have collected data from a child under 18,
          we will delete it promptly.
        </Text>

        <Text style={styles.heading}>8. Changes to This Policy</Text>
        <Text style={styles.body}>
          We may update this Privacy Policy from time to time. We will notify you of any material
          changes by posting the new policy in the app. Continued use of Kindred after changes
          constitutes acceptance of the updated policy.
        </Text>

        <Text style={styles.heading}>9. Complaints</Text>
        <Text style={styles.body}>
          If you are not satisfied with our response to a privacy concern, you have the right to
          lodge a complaint with the Office of the New Zealand Privacy Commissioner:{'\n\n'}
          Website: privacy.org.nz{'\n'}
          Phone: 0800 803 909
        </Text>

        <Text style={styles.heading}>10. Contact Us</Text>
        <Text style={styles.body}>
          If you have questions about this Privacy Policy or wish to exercise your privacy rights,
          please contact us at:{'\n\n'}Email: privacy@kindred.nz{'\n'}
          Or through the in-app support channel.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.sand,
  },
  back: { color: Colors.teal, fontSize: 15, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '700', color: Colors.dark },
  content: { padding: 24, paddingBottom: 48 },
  updated: { fontSize: 13, color: Colors.grey, marginBottom: 16, fontStyle: 'italic' },
  heading: { fontSize: 16, fontWeight: '700', color: Colors.dark, marginTop: 24, marginBottom: 8 },
  subheading: { fontSize: 14, fontWeight: '600', color: Colors.dark, marginTop: 12, marginBottom: 4 },
  body: { fontSize: 14, color: Colors.grey, lineHeight: 22 },
})
