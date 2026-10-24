import { useEffect, useRef, useState } from 'react';
import { Switch, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { EffortPicker } from '@/components/EffortPicker';
import { Text } from '@/components/Text';
import type { Tracking } from '@/domain/exercises';
import { formatDuration } from '@/domain/lifts';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';
import { TourTarget } from '@/features/tour/TourTarget';

/** A set as typed: text fields, so a half-typed number is never stored. `assisted`: last reps a spotter helped with. */
export type SetDraft = { weight: string; reps: string; time?: string; effort: number | null; assisted?: number | null };

type Props = {
  index: number;
  set: SetDraft;
  tracking: Tracking;
  bodyweight: boolean;
  onChange: (patch: Partial<SetDraft>) => void;
  onRemove?: () => void;
};

/** One set's fields, shaped by how the exercise is logged: weight × reps, reps only, or a time. */
export function SetFields({ index, set, tracking, bodyweight, onChange, onRemove }: Props) {
  const { colors } = useTheme();
  const n = index + 1;
  // Reps-only and timed sets can still carry weight (a vest, a plate), but only when asked for.
  const [showWeight, setShowWeight] = useState(tracking === 'weight_reps' || set.weight !== '');

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radii.hero, padding: spacing.lg, gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 32 }}>
        <Text variant="overline" color="text2">
          Set {n}
        </Text>
        {onRemove ? <Button variant="plain" label="Remove" accessibilityLabel={`Remove set ${n}`} onPress={onRemove} /> : null}
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        {showWeight ? (
          <NumberBox
            label="Weight"
            unit="kg"
            accessibilityLabel={`Weight for set ${n}`}
            value={set.weight}
            placeholder={bodyweight || tracking !== 'weight_reps' ? 'Body' : '0'}
            onChangeText={(weight) => onChange({ weight })}
            keyboardType="decimal-pad"
          />
        ) : null}
        {tracking === 'time' ? (
          <TimeBox n={n} value={set.time ?? ''} onChangeText={(time) => onChange({ time })} />
        ) : (
          <NumberBox
            label="Reps"
            accessibilityLabel={`Reps for set ${n}`}
            value={set.reps}
            placeholder="0"
            onChangeText={(reps) => onChange({ reps })}
            keyboardType="number-pad"
          />
        )}
      </View>
      {!showWeight ? (
        <Button
          variant="plain"
          label="Add weight (vest, plate)"
          onPress={() => setShowWeight(true)}
          style={{ alignSelf: 'flex-start' }}
        />
      ) : null}

      {tracking === 'time' ? null : (
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 }}>
            <Text>Spotter helped</Text>
            <Switch
              accessibilityLabel={`Spotter helped on set ${n}`}
              value={!!set.assisted}
              // Help usually means nothing was left: effort 10, which can still be changed.
              onValueChange={(on) => onChange(on ? { assisted: 1, effort: 10 } : { assisted: null })}
              trackColor={{ true: colors.accent, false: colors.well }}
              thumbColor="#FFFFFF"
            />
          </View>
          {set.assisted ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text color="text2" style={{ flex: 1 }}>
                {(() => {
                  const shown = Number(set.reps) > 0 ? Math.min(set.assisted, Number(set.reps)) : set.assisted;
                  return `Last ${shown} rep${shown === 1 ? '' : 's'}`;
                })()}
              </Text>
              <Button
                variant="secondary"
                label="−"
                accessibilityLabel={`One fewer helped rep on set ${n}`}
                disabled={set.assisted <= 1}
                onPress={() => onChange({ assisted: Math.max(1, set.assisted! - 1) })}
                style={{ paddingHorizontal: spacing.md }}
              />
              <Button
                variant="secondary"
                label="+"
                accessibilityLabel={`One more helped rep on set ${n}`}
                disabled={Number(set.reps) > 0 && set.assisted >= Number(set.reps)}
                onPress={() => onChange({ assisted: set.assisted! + 1 })}
                style={{ paddingHorizontal: spacing.md }}
              />
            </View>
          ) : null}
        </View>
      )}

      {/* The first set's effort is where the Effort tip points. */}
      <TourTarget id={n === 1 ? 'log-workout-effort' : null}>
        <EffortPicker
          variant="set"
          value={set.effort}
          onChange={(effort) => onChange({ effort })}
          accessibilityLabel={`Effort for set ${n}`}
          buttonLabel={(e) => `Set ${n} effort ${e}`}
        />
      </TourTarget>
    </View>
  );
}

function NumberBox({
  label,
  unit,
  value,
  placeholder,
  onChangeText,
  keyboardType,
  accessibilityLabel,
}: {
  label: string;
  unit?: string;
  value: string;
  placeholder: string;
  onChangeText: (text: string) => void;
  keyboardType: 'decimal-pad' | 'number-pad' | 'numbers-and-punctuation';
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.well,
        borderRadius: radii.card - 2,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
      }}>
      <Text variant="caption" color="text2">
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
        <TextInput
          accessibilityLabel={accessibilityLabel}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text2}
          keyboardType={keyboardType}
          selectionColor={colors.accent}
          style={{
            flex: 1,
            minWidth: 0,
            color: colors.text,
            fontFamily: fonts.bold,
            fontSize: 30,
            fontVariant: ['tabular-nums'],
            padding: 0,
          }}
        />
        {unit ? <Text color="text2">{unit}</Text> : null}
      </View>
    </View>
  );
}

/** A time as m:ss, typed or counted by the timer (Start, then Stop when the hold ends). */
function TimeBox({ n, value, onChangeText }: { n: number; value: string; onChangeText: (text: string) => void }) {
  const [running, setRunning] = useState(false);
  const started = useRef(0);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (tick.current) clearInterval(tick.current);
    },
    [],
  );

  const elapsed = () => Math.round((Date.now() - started.current) / 1000);
  const start = () => {
    started.current = Date.now();
    setRunning(true);
    onChangeText(formatDuration(0));
    tick.current = setInterval(() => onChangeText(formatDuration(elapsed())), 1000);
  };
  const stop = () => {
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
    setRunning(false);
    onChangeText(formatDuration(elapsed()));
  };

  return (
    <View style={{ flex: 1, gap: spacing.sm }}>
      <NumberBox
        label="Time"
        accessibilityLabel={`Time for set ${n}`}
        value={value}
        placeholder="0:00"
        onChangeText={onChangeText}
        keyboardType="numbers-and-punctuation"
      />
      <Button
        variant={running ? 'primary' : 'secondary'}
        label={running ? 'Stop' : 'Start timer'}
        accessibilityLabel={`${running ? 'Stop' : 'Start'} timer for set ${n}`}
        onPress={running ? stop : start}
      />
    </View>
  );
}
