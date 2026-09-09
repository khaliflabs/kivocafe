import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/fonts';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

export function KivoWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <View accessibilityLabel="KIVO Café. Good coffee. Good mood." style={styles.container}>
      <Text adjustsFontSizeToFit numberOfLines={1} style={[typography.wordmark, compact && styles.compactWordmark]}>KIVO</Text>
      <View style={styles.cafeRow}><View style={styles.rule} /><Text style={[styles.cafe, compact && styles.compactCafe]}>CAFÉ</Text><View style={styles.rule} /></View>
      {!compact ? <Text style={styles.tagline}>GOOD COFFEE. GOOD MOOD.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', width: '100%' },
  compactWordmark: { fontSize: 38, letterSpacing: 8, lineHeight: 42 },
  cafeRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'center', marginTop: -2, width: '72%' },
  rule: { backgroundColor: colors.border, flex: 1, height: StyleSheet.hairlineWidth, maxWidth: 76 },
  cafe: { color: colors.primary, fontFamily: fonts.sansMedium, fontSize: 18, letterSpacing: 7, lineHeight: 26, marginRight: -7 },
  compactCafe: { fontSize: 13, letterSpacing: 5, lineHeight: 20, marginRight: -5 },
  tagline: { color: colors.text, fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 2.6, lineHeight: 18, marginRight: -2.6, marginTop: spacing.sm },
});
