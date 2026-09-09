import type { TextStyle } from 'react-native';

import { colors } from './colors';
import { fonts } from './fonts';

export const fontSizes = { caption: 11, button: 13, body: 15, sectionTitle: 18, title: 38, display: 54 } as const;

export const typography = {
  wordmark: { color: colors.primaryDark, fontFamily: fonts.serifMedium, fontSize: fontSizes.display, letterSpacing: 12, lineHeight: 58 },
  pageTitle: { color: colors.primary, fontFamily: fonts.serifMedium, fontSize: fontSizes.title, lineHeight: 43 },
  sectionTitle: { color: colors.text, fontFamily: fonts.sansSemiBold, fontSize: fontSizes.sectionTitle, letterSpacing: 2.2, lineHeight: 24 },
  body: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.body, lineHeight: 23 },
  caption: { color: colors.mutedText, fontFamily: fonts.sansMedium, fontSize: fontSizes.caption, letterSpacing: 1.8, lineHeight: 16 },
  button: { fontFamily: fonts.sansSemiBold, fontSize: fontSizes.button, letterSpacing: 1.3, lineHeight: 18 },
} satisfies Record<string, TextStyle>;
