import { StyleSheet, Text, View } from 'react-native';

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
      <Text style={styles.eyebrow}>KIVO CAFÉ</Text>
      <Text style={styles.title}>{title}</Text>
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
  eyebrow: {
    color: colors.accent,
    fontSize: typography.caption,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    padding: spacing.xl,
  },
  copy: {
    color: colors.mutedText,
    fontSize: typography.body,
    lineHeight: 24,
  },
});
