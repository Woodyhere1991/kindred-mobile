import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native'
import { router } from 'expo-router'
import { Colors } from '../constants/theme'

export default function TermsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Terms of Service</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.updated}>Last updated: 12 March 2026</Text>

        <Text style={styles.heading}>1. Acceptance of Terms</Text>
        <Text style={styles.body}>
          By creating an account or using the Kindred mobile application ("the App"), you agree to
          be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you must
          not use the App. You must be at least 18 years of age to create an account and use Kindred.
          These Terms constitute a legally binding agreement between you and Kindred ("we", "us", "our").
        </Text>

        <Text style={styles.heading}>2. About Kindred</Text>
        <Text style={styles.body}>
          Kindred is a community platform that connects neighbours to give, lend, and share items
          within their local community. Kindred is not a marketplace, retailer, or commercial trading
          platform. We do not buy, sell, or own any items listed on the App. We simply provide the
          technology to facilitate connections between community members.
        </Text>

        <Text style={styles.heading}>3. Account Responsibilities</Text>
        <Text style={styles.body}>
          You agree to:{'\n\n'}
          {'\u2022'} Provide accurate, current, and complete information when creating your account{'\n'}
          {'\u2022'} Keep your login credentials secure and not share them with others{'\n'}
          {'\u2022'} Maintain only one account per person{'\n'}
          {'\u2022'} Notify us immediately if you suspect unauthorised access to your account{'\n'}
          {'\u2022'} Be responsible for all activity that occurs under your account{'\n\n'}
          We reserve the right to suspend or terminate accounts that contain false or misleading information.
        </Text>

        <Text style={styles.heading}>4. User Conduct</Text>
        <Text style={styles.body}>
          You agree to use Kindred respectfully and lawfully. You must not:{'\n\n'}
          {'\u2022'} List prohibited, illegal, stolen, recalled, or dangerous items{'\n'}
          {'\u2022'} List items that infringe any third party's intellectual property rights{'\n'}
          {'\u2022'} Use the platform for commercial purposes, reselling, or profit-making{'\n'}
          {'\u2022'} Harass, threaten, abuse, or discriminate against other users{'\n'}
          {'\u2022'} Send spam, unsolicited messages, or misleading communications{'\n'}
          {'\u2022'} Impersonate another person or misrepresent your identity{'\n'}
          {'\u2022'} Attempt to circumvent any security features of the App{'\n'}
          {'\u2022'} Use the App in any way that violates New Zealand law{'\n\n'}
          Prohibited items include but are not limited to: weapons, drugs, medications, hazardous
          materials, recalled products, counterfeit goods, alcohol, tobacco, firearms, and any items
          that are illegal to possess or distribute under New Zealand law.
        </Text>

        <Text style={styles.heading}>5. Item Listings and Exchanges</Text>
        <Text style={styles.body}>
          When listing items, you are solely responsible for:{'\n\n'}
          {'\u2022'} Ensuring item descriptions and photos are accurate and not misleading{'\n'}
          {'\u2022'} Disclosing any known defects, damage, or safety concerns{'\n'}
          {'\u2022'} Ensuring you have the legal right to give or lend the item{'\n'}
          {'\u2022'} Complying with any applicable product safety standards{'\n\n'}
          All exchanges are conducted solely between users. Kindred is not a party to any exchange
          and does not inspect, verify, or guarantee any items listed on the platform. You acknowledge
          that items are provided by individual community members, not by Kindred.
        </Text>

        <Text style={styles.heading}>6. Personal Safety</Text>
        <Text style={styles.body}>
          When arranging to meet other users for exchanges, you are responsible for your own safety.
          We strongly recommend:{'\n\n'}
          {'\u2022'} Meeting in public, well-lit locations{'\n'}
          {'\u2022'} Telling someone you trust about your plans{'\n'}
          {'\u2022'} Not sharing your home address with strangers{'\n'}
          {'\u2022'} Trusting your instincts — if something feels wrong, do not proceed{'\n\n'}
          Kindred does not conduct background checks on users. While we offer optional identity
          verification features, these do not guarantee the trustworthiness or conduct of any user.
        </Text>

        <Text style={styles.heading}>7. Limitation of Liability</Text>
        <Text style={styles.body}>
          To the maximum extent permitted by New Zealand law:{'\n\n'}
          {'\u2022'} Kindred is provided "as is" and "as available" without warranties of any kind,
          whether express or implied{'\n'}
          {'\u2022'} We do not warrant that the App will be uninterrupted, error-free, or secure{'\n'}
          {'\u2022'} We are not liable for any direct, indirect, incidental, special, consequential,
          or punitive damages arising from your use of the App{'\n'}
          {'\u2022'} We are not responsible for the quality, safety, legality, or fitness for purpose
          of any items listed by users{'\n'}
          {'\u2022'} We are not responsible for the conduct, actions, or omissions of any user{'\n'}
          {'\u2022'} We are not responsible for any loss, damage, injury, or harm arising from
          exchanges or interactions between users{'\n'}
          {'\u2022'} We are not responsible for any disputes between users{'\n\n'}
          Our total liability to you for any claim arising from your use of the App shall not exceed
          NZD $100.
        </Text>

        <Text style={styles.heading}>8. Indemnification</Text>
        <Text style={styles.body}>
          You agree to indemnify, defend, and hold harmless Kindred, its directors, officers,
          employees, and agents from and against any claims, liabilities, damages, losses, costs,
          or expenses (including reasonable legal fees) arising out of or in connection with:{'\n\n'}
          {'\u2022'} Your use of the App{'\n'}
          {'\u2022'} Your violation of these Terms{'\n'}
          {'\u2022'} Your violation of any rights of another person or entity{'\n'}
          {'\u2022'} Any items you list or exchange through the App{'\n'}
          {'\u2022'} Any interaction or exchange you have with another user
        </Text>

        <Text style={styles.heading}>9. Intellectual Property</Text>
        <Text style={styles.body}>
          The Kindred App, including its design, branding, code, and features, is owned by Kindred
          and protected by New Zealand and international intellectual property laws. You may not copy,
          modify, distribute, or create derivative works based on the App without our written consent.
          {'\n\n'}
          By posting content (such as item photos and descriptions) on the App, you retain ownership
          of your content but grant Kindred a non-exclusive, royalty-free, worldwide licence to use,
          display, and distribute that content within the App for the purpose of providing the service.
        </Text>

        <Text style={styles.heading}>10. Account Suspension and Termination</Text>
        <Text style={styles.body}>
          We may suspend or terminate your account at our discretion if we reasonably believe you
          have violated these Terms, engaged in fraudulent or harmful activity, or pose a risk to
          other users or the community. We will endeavour to provide notice where practicable, but
          are not obligated to do so in cases of serious or urgent violations.{'\n\n'}
          You may delete your account at any time through the App settings.
        </Text>

        <Text style={styles.heading}>11. Dispute Resolution</Text>
        <Text style={styles.body}>
          Disputes between users should be resolved directly between the parties involved. Kindred
          may offer to facilitate communication but is not obligated to mediate or resolve any dispute.
          We are not responsible for the outcome of any dispute between users.{'\n\n'}
          If you have a dispute with Kindred regarding these Terms or the App, you agree to first
          attempt to resolve it informally by contacting us. If informal resolution is not successful,
          any dispute shall be resolved through the Disputes Tribunal of New Zealand or the
          New Zealand courts, as appropriate.
        </Text>

        <Text style={styles.heading}>12. Consumer Guarantees Act</Text>
        <Text style={styles.body}>
          Kindred is a free community platform. To the extent permitted by law, the Consumer
          Guarantees Act 1993 does not apply to the services provided by Kindred, as the App is
          provided free of charge and not in trade. Exchanges between users are peer-to-peer
          transactions between private individuals and are not subject to the Consumer Guarantees
          Act. Nothing in these Terms is intended to limit any rights you may have that cannot be
          excluded by law.
        </Text>

        <Text style={styles.heading}>13. Fair Trading Act</Text>
        <Text style={styles.body}>
          You agree not to engage in misleading or deceptive conduct when using the App, including
          when describing items or communicating with other users, in accordance with the Fair Trading
          Act 1986. Kindred is not responsible for any misleading representations made by individual
          users.
        </Text>

        <Text style={styles.heading}>14. Governing Law</Text>
        <Text style={styles.body}>
          These Terms are governed by and construed in accordance with the laws of New Zealand. You
          agree to submit to the exclusive jurisdiction of the courts of New Zealand for the resolution
          of any disputes arising from these Terms or your use of the App.
        </Text>

        <Text style={styles.heading}>15. Changes to These Terms</Text>
        <Text style={styles.body}>
          We may update these Terms from time to time. We will notify you of any material changes by
          posting the updated Terms in the App or by sending you a notification. Your continued use
          of Kindred after any changes constitutes acceptance of the updated Terms. If you do not
          agree to the updated Terms, you must stop using the App and delete your account.
        </Text>

        <Text style={styles.heading}>16. Contact Us</Text>
        <Text style={styles.body}>
          If you have questions about these Terms of Service, please contact us at:{'\n\n'}
          Email: support@kindred.nz{'\n'}
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
  body: { fontSize: 14, color: Colors.grey, lineHeight: 22 },
})
