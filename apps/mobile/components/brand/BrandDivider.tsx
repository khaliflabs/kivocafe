import { StyleSheet, View } from 'react-native';

import { BrandLeaf } from '@/components/brand/BrandLeaf';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';

export function BrandDivider({ botanical = false }: { botanical?: boolean }) {
  return <View style={styles.row}><View style={styles.line} />{botanical ? <BrandLeaf size={18} /> : null}{botanical ? <View style={styles.line} /> : null}</View>;
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, width: '100%' },
  line: { backgroundColor: colors.border, flex: 1, height: StyleSheet.hairlineWidth },
});
