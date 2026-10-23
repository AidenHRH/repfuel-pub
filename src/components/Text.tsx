import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { type as typeScale, type Palette, type TypeVariant } from '@/theme/tokens';

type Props = TextProps & {
  variant?: TypeVariant;
  color?: keyof Palette;
  /** Tabular figures so numbers don't jump as they change. */
  numeric?: boolean;
};

export function Text({ variant = 'body', color = 'text', numeric, style, ...rest }: Props) {
  const { colors } = useTheme();
  const numericStyle: TextStyle | undefined = numeric ? { fontVariant: ['tabular-nums'] } : undefined;
  return <RNText {...rest} style={[typeScale[variant], { color: colors[color] }, numericStyle, style]} />;
}
