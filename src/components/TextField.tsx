import type { ComponentRef, Ref } from 'react';
import { TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts, spacing } from '@/theme/tokens';

import { Text } from './Text';

type Props = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  suffix?: string;
  error?: string;
  autoFocus?: boolean;
  /** Hides what's typed (passwords). */
  secureTextEntry?: boolean;
  /** For emails and passwords: no capitals or autocorrect. */
  plain?: boolean;
  /** Defaults to the visible label. */
  accessibilityLabel?: string;
  /** To focus the field from elsewhere, e.g. a "Type the number" button. */
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
};

/** A labelled input row for use inside a ListGroup. */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  suffix,
  error,
  autoFocus,
  secureTextEntry,
  plain,
  accessibilityLabel,
  inputRef,
}: Props) {
  const { colors } = useTheme();
  const numeric = keyboardType === 'decimal-pad' || keyboardType === 'number-pad' || keyboardType === 'numeric';
  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, minHeight: 52, justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Text style={{ minWidth: 92 }}>{label}</Text>
        <TextInput
          ref={inputRef}
          accessibilityLabel={accessibilityLabel ?? label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text2}
          keyboardType={keyboardType}
          autoFocus={autoFocus}
          secureTextEntry={secureTextEntry}
          autoCapitalize={plain ? 'none' : undefined}
          autoCorrect={plain ? false : undefined}
          selectionColor={colors.accent}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 36,
            textAlign: numeric ? 'right' : 'left',
            color: colors.text,
            fontFamily: fonts.regular,
            fontSize: 16,
            fontVariant: numeric ? ['tabular-nums'] : undefined,
            padding: 0,
          }}
        />
        {suffix ? (
          <Text color="text2" style={{ minWidth: 28 }}>
            {suffix}
          </Text>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" color="danger" style={{ marginTop: 2 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
