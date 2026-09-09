import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

type KivoButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
};

export function KivoButton({ label, onPress, variant = 'primary' }: KivoButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles[variant], pressed && styles.pressed]}
    >
      <Text style={[styles.label, variant === 'secondary' && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 7,
    borderWidth: 1,
    minWidth: 152,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  secondary: { backgroundColor: 'transparent', borderColor: colors.border },
  pressed: {
    opacity: 0.76,
  },
  label: {
    color: colors.onPrimary,
    ...typography.button,
  },
  secondaryLabel: { color: colors.primary },
});
