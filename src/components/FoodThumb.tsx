import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

import { Text } from './Text';

/**
 * A food's photo, kept on the phone once seen. Without one (or if it won't load), a tile with the food's first letter,
 * so lists always line up.
 */
export function FoodThumb({
  uri,
  name,
  size = 44,
  word = false,
}: {
  uri: string | null | undefined;
  name: string;
  size?: number;
  /** Without a photo, show the name's first word ("oats") rather than its first letter. */
  word?: boolean;
}) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState<string | null>(null);
  const radius = Math.round(size * 0.23);
  if (uri && failed !== uri)
    return (
      <Image
        testID="food-photo"
        source={{ uri }}
        accessibilityLabel={`${name} picture`}
        contentFit="contain"
        cachePolicy="memory-disk"
        transition={120}
        onError={() => setFailed(uri)}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: '#FFFFFF' }}
      />
    );
  return (
    <View
      testID="food-letter"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: colors.well,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {word ? (
        <Text color="text2" numberOfLines={1} style={{ fontSize: 10, lineHeight: 12, paddingHorizontal: 2 }}>
          {name.trim().split(/\s+/)[0].toLowerCase().slice(0, 7) || '·'}
        </Text>
      ) : (
        <Text color="text2" style={{ fontFamily: fonts.semibold, fontSize: size * 0.4, lineHeight: size * 0.5 }}>
          {name.trim().charAt(0).toUpperCase() || '·'}
        </Text>
      )}
    </View>
  );
}
