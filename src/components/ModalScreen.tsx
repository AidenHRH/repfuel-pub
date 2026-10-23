import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { layout, spacing } from '@/theme/tokens';

import { Button } from './Button';
import { Text } from './Text';

type Props = {
  title: string;
  /** Leave out for a screen with no way back (the welcome's first step). */
  onClose?: () => void;
  closeLabel?: string;
  action?: { label: string; onPress: () => void; disabled?: boolean };
  /** Pinned under the scrolling content, e.g. the main Save button. */
  footer?: ReactNode;
  children: ReactNode;
};

/** A focused task screen presented over the tabs: Cancel · Title · Done. */
export function ModalScreen({ title, onClose, closeLabel = 'Cancel', action, footer, children }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: layout.gutter - spacing.xs,
          paddingBottom: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
        }}>
        {onClose ? <Button variant="plain" label={closeLabel} onPress={onClose} /> : <View style={{ width: 60 }} />}
        <Text variant="headline" accessibilityRole="header" numberOfLines={1} style={{ flexShrink: 1, textAlign: 'center' }}>
          {title}
        </Text>
        {action ? (
          <Button variant="plain" label={action.label} onPress={action.onPress} disabled={action.disabled} />
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: layout.gutter,
          paddingTop: spacing.md,
          paddingBottom: footer ? spacing.xl : insets.bottom + spacing.section * 2,
          gap: spacing.xxl,
        }}>
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={{
            paddingHorizontal: layout.gutter,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.lg,
            borderTopWidth: 1,
            borderTopColor: colors.sep,
            backgroundColor: colors.bg,
          }}>
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
