import { StyleSheet, Text, View } from 'react-native';

import { BrandDivider } from '@/components/brand/BrandDivider';
import { KivoEmblem } from '@/components/brand/KivoEmblem';
import { KivoWordmark } from '@/components/brand/KivoWordmark';
import { KivoButton } from '@/components/ui/KivoButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/fonts';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

export default function HomeScreen() {
  return (
    <ScreenContainer scroll>
      <View style={styles.brandHeader}>
        <KivoWordmark />
        <View style={styles.headerDivider}><BrandDivider /></View>
      </View>
      <View style={styles.welcome}>
        <Text style={styles.eyebrow}>WELCOME TO KIVO</Text>
        <Text style={styles.welcomeTitle}>Your café moment,<Text style={styles.italic}> made with care.</Text></Text>
        <KivoButton label="ORDER NOW" />
      </View>
      <View style={styles.sections}>
        <View style={styles.section}>
          <SectionHeader title="Featured" />
          <View style={styles.featureCard}>
            <View style={styles.featureCopy}><Text style={styles.cardEyebrow}>A KIVO FAVOURITE</Text><Text style={styles.featureTitle}>Something special is brewing.</Text><Text style={styles.cardBody}>Our featured café selection will be revealed here soon.</Text></View>
            <KivoEmblem size={78} />
          </View>
        </View>
        <View style={styles.section}>
          <SectionHeader title="Favourites" />
          <View style={styles.favouriteRow}>
            <View style={styles.smallCard}><Text style={styles.smallTitle}>Coffee</Text><Text style={styles.smallCopy}>Café classics coming soon</Text></View>
            <View style={styles.smallCard}><Text style={styles.smallTitle}>Sweet</Text><Text style={styles.smallCopy}>Made with care, every day</Text></View>
          </View>
        </View>
        <View style={styles.section}>
          <SectionHeader title="Offers" />
          <View style={styles.offerCard}><Text style={styles.offerScript}>Good coffee. Good mood.</Text><Text style={styles.offerTitle}>KIVO MOMENTS, COMING SOON</Text><BrandDivider botanical /></View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  brandHeader: { alignItems: 'center', paddingTop: spacing.md },
  headerDivider: { marginTop: spacing.xl, width: '100%' },
  welcome: { alignItems: 'flex-start', paddingVertical: spacing.xxxl },
  eyebrow: { ...typography.caption, color: colors.accent, marginBottom: spacing.sm },
  welcomeTitle: { ...typography.pageTitle, fontSize: 34, lineHeight: 39, marginBottom: spacing.xl, maxWidth: 310 },
  italic: { fontFamily: fonts.serif, fontStyle: 'italic' },
  sections: { gap: spacing.xxxl },
  section: { gap: spacing.lg },
  featureCard: { alignItems: 'center', backgroundColor: colors.surfaceMuted, flexDirection: 'row', gap: spacing.lg, minHeight: 176, padding: spacing.xl },
  featureCopy: { flex: 1 },
  cardEyebrow: { ...typography.caption, color: colors.accent, marginBottom: spacing.sm },
  featureTitle: { ...typography.pageTitle, fontSize: 28, lineHeight: 31, marginBottom: spacing.sm },
  cardBody: { ...typography.body, color: colors.mutedText },
  favouriteRow: { flexDirection: 'row', gap: spacing.md },
  smallCard: { backgroundColor: colors.surface, borderColor: colors.border, borderTopWidth: 1, flex: 1, minHeight: 126, padding: spacing.lg },
  smallTitle: { color: colors.primary, fontFamily: fonts.serifMedium, fontSize: 25, lineHeight: 29, marginBottom: spacing.sm },
  smallCopy: { ...typography.body, color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  offerCard: { alignItems: 'center', backgroundColor: colors.footer, gap: spacing.md, padding: spacing.xl },
  offerScript: { color: colors.onPrimary, fontFamily: fonts.serif, fontSize: 25, fontStyle: 'italic', lineHeight: 30 },
  offerTitle: { ...typography.caption, color: colors.onPrimary, textAlign: 'center' },
});
