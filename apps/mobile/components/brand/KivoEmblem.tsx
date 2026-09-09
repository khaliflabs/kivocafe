import { StyleSheet, Text, View } from 'react-native';

import { BrandLeaf } from '@/components/brand/BrandLeaf';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/fonts';

export function KivoEmblem({ size = 92 }: { size?: number }) {
  const innerSize = size - Math.max(8, size * 0.1);
  return (
    <View accessibilityLabel="KIVO Café emblem" style={[styles.outer, { borderRadius: size / 2, height: size, width: size }]}>
      <View style={[styles.inner, { borderRadius: innerSize / 2, height: innerSize, width: innerSize }]}>
        <Text style={[styles.letter, { fontSize: size * 0.54, lineHeight: size * 0.58 }]}>K</Text>
        <View style={[styles.leaf, { right: size * 0.13, top: size * 0.49 }]}><BrandLeaf size={size * 0.24} /></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { alignItems: 'center', backgroundColor: colors.accent, justifyContent: 'center' },
  inner: { alignItems: 'center', backgroundColor: colors.primary, borderColor: colors.primaryDark, borderWidth: 1, justifyContent: 'center' },
  letter: { color: colors.accent, fontFamily: fonts.serifMedium, marginRight: '8%', marginTop: '-5%' },
  leaf: { position: 'absolute' },
});
