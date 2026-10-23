import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radii } from '@/theme/tokens';

import { Text } from './Text';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
};

export function Segmented<T extends string>({ options, value, onChange, accessibilityLabel }: Props<T>) {
  const { colors } = useTheme();
  // Five or more options (e.g. the meals) share the width by label length, so Breakfast still fits on a small phone.
  const crowded = options.length > 4;
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: 'row', backgroundColor: colors.well, borderRadius: radii.control, padding: 4, gap: 4 }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={{
              flexGrow: 1,
              flexBasis: crowded ? 'auto' : 0,
              minHeight: 40,
              paddingHorizontal: crowded ? 6 : 12,
              borderRadius: 9,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? colors.seg : 'transparent',
              boxShadow: selected ? '0px 1px 4px rgba(0,0,0,0.18)' : undefined,
            }}>
            <Text variant="callout" style={{ fontSize: crowded ? 14 : 15 }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
