import { StyleSheet, Text, View } from 'react-native';

import { BrandLeaf } from '@/components/brand/BrandLeaf';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

export function SectionHeader({ title }: { title: string }) {
  return <View style={styles.row}><BrandLeaf size={27} /><Text style={styles.title}>{title.toUpperCase()}</Text><View style={styles.line} /></View>;
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  title: { ...typography.sectionTitle },
  line: { backgroundColor: colors.border, flex: 1, height: 1 },
});
