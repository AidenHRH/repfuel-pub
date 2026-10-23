import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

import { Button } from './Button';
import { Card } from './Card';
import { Text } from './Text';

type Props = {
  icon?: ReactNode;
  title: string;
  message: string;
  action?: { label: string; onPress: () => void };
};

export function EmptyState({ icon, title, message, action }: Props) {
  const { colors } = useTheme();
  return (
    <Card style={{ alignItems: 'center', paddingVertical: spacing.section, gap: spacing.sm }}>
      {icon ? (
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.well,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.xs,
          }}>
          {icon}
        </View>
      ) : null}
      <Text variant="headline" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      <Text variant="callout" color="text2" style={{ textAlign: 'center', maxWidth: 280 }}>
        {message}
      </Text>
      {action ? (
        <Button variant="secondary" label={action.label} onPress={action.onPress} style={{ marginTop: spacing.md }} />
      ) : null}
    </Card>
  );
}
