import { StyleSheet, Text, View } from 'react-native';

import { BrandDivider } from '@/components/brand/BrandDivider';
import { KivoEmblem } from '@/components/brand/KivoEmblem';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

type PlaceholderScreenProps = {
  copy: string;
  title: string;
};

export function PlaceholderScreen({ copy, title }: PlaceholderScreenProps) {
  return (
    <ScreenContainer contentContainerStyle={styles.container}>
      <View style={styles.emblem}><KivoEmblem size={72} /></View>
      <Text style={styles.eyebrow}>KIVO CAFÉ</Text>
      <Text style={styles.title}>{title}</Text>
      <BrandDivider botanical />
      <View style={styles.card}>
        <Text style={styles.copy}>{copy}</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  emblem: { alignItems: 'center', marginBottom: spacing.xl },
  eyebrow: {
    ...typography.caption,
    color: colors.accent,
    textAlign: 'center',
  },
  title: {
    ...typography.pageTitle,
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surfaceMuted,
    borderLeftColor: colors.accent,
    borderLeftWidth: 2,
    marginTop: spacing.xl,
    padding: spacing.xl,
  },
  copy: {
    ...typography.body,
    color: colors.mutedText,
    textAlign: 'center',
  },
});
