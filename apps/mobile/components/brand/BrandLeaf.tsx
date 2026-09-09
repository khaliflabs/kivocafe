import { StyleSheet, View } from 'react-native';

import { colors } from '@/src/theme/colors';

export function BrandLeaf({ color = colors.accent, size = 24 }: { color?: string; size?: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.canvas, { height: size, width: size * 0.72 }]}>
      <View style={[styles.stem, { backgroundColor: color, height: size * 0.8 }]} />
      <View style={[styles.leaf, styles.one, { backgroundColor: color, height: size * 0.25, width: size * 0.16 }]} />
      <View style={[styles.leaf, styles.two, { backgroundColor: color, height: size * 0.28, width: size * 0.18 }]} />
      <View style={[styles.leaf, styles.three, { backgroundColor: color, height: size * 0.24, width: size * 0.15 }]} />
      <View style={[styles.leaf, styles.four, { backgroundColor: color, height: size * 0.22, width: size * 0.14 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { position: 'relative' },
  stem: { bottom: 1, left: '48%', position: 'absolute', transform: [{ rotate: '20deg' }], width: 1 },
  leaf: { borderBottomLeftRadius: 10, borderTopRightRadius: 10, position: 'absolute' },
  one: { left: '48%', top: '8%', transform: [{ rotate: '42deg' }] },
  two: { left: '22%', top: '27%', transform: [{ rotate: '-48deg' }] },
  three: { left: '54%', top: '43%', transform: [{ rotate: '47deg' }] },
  four: { left: '31%', top: '61%', transform: [{ rotate: '-44deg' }] },
});
