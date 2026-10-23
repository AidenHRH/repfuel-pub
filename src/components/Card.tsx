import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';

type Props = ViewProps & { hero?: boolean };

export function Card({ hero, style, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: hero ? radii.hero : radii.card,
          padding: hero ? spacing.xl : spacing.lg,
          borderCurve: 'continuous',
        },
        style,
      ]}
    />
  );
}
