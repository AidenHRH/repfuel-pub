import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { layout, motion, radii, spacing } from '@/theme/tokens';

import { Button } from './Button';
import { Text } from './Text';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  closeLabel?: string;
  children: ReactNode;
};

/** A bottom sheet over the current screen for short, focused choices. */
export function Sheet({ visible, title, onClose, closeLabel = 'Cancel', children }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      {/* The modal draws edge to edge, so Android won't resize it for the keyboard: lift the sheet ourselves. */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim }}
        />
        <Animated.View
          entering={SlideInDown.duration(motion.standard)}
          accessibilityViewIsModal
          style={{
            // Never taller than the space above the keyboard: the content scrolls instead.
            maxHeight: '100%',
            backgroundColor: colors.sheet,
            borderTopLeftRadius: radii.sheet,
            borderTopRightRadius: radii.sheet,
            paddingHorizontal: layout.gutter,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.xl,
            gap: spacing.lg,
          }}>
          <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: colors.track, alignSelf: 'center' }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="title" accessibilityRole="header" style={{ flexShrink: 1 }}>
              {title}
            </Text>
            <Button variant="plain" label={closeLabel} onPress={onClose} />
          </View>
          <ScrollView
            style={{ flexGrow: 0, flexShrink: 1 }}
            contentContainerStyle={{ gap: spacing.lg }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
