import { StyleSheet, Text, View } from 'react-native';

import { KivoButton } from '@/components/ui/KivoButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

const sections = [
  { title: 'Featured', copy: 'Seasonal favourites and café classics will live here.' },
  { title: 'Favourites', copy: 'Your go-to drinks and treats will be easy to find.' },
  { title: 'Offers', copy: 'Fresh offers and KIVO moments are coming soon.' },
];

export default function HomeScreen() {
  return (
    <ScreenContainer scroll>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>WELCOME TO</Text>
        <Text style={styles.title}>KIVO Café</Text>
        <Text style={styles.tagline}>Good Coffee. Good Mood.</Text>
        <KivoButton label="ORDER NOW" />
      </View>

      <View style={styles.sections}>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <SectionHeader title={section.title} />
            <View style={styles.card}>
              <Text style={styles.cardCopy}>{section.copy}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    padding: spacing.xl,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: typography.caption,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    color: colors.text,
    fontSize: typography.display,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  tagline: {
    color: colors.mutedText,
    fontSize: typography.subtitle,
    marginBottom: spacing.xl,
    marginTop: spacing.xs,
  },
  sections: {
    gap: spacing.xl,
    marginTop: spacing.xxl,
  },
  section: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 20,
    minHeight: 112,
    padding: spacing.lg,
  },
  cardCopy: {
    color: colors.mutedText,
    fontSize: typography.body,
    lineHeight: 24,
  },
});
