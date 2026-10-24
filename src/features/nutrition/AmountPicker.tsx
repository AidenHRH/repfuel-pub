import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { ListRow } from '@/components/ListGroup';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useDb } from '@/database/DatabaseProvider';
import { recordUse } from '@/database/repositories/tourRepository';
import { measureLabel, type Measure } from '@/domain/commonFoods';
import { friendlyNumber } from '@/domain/format';
import { foodMeasures, packHint } from '@/domain/measures';
import { parseAmount } from '@/domain/parse';
import { PORTIONS } from '@/domain/portions';
import type { FoodProduct } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, spacing } from '@/theme/tokens';
import { TourTarget } from '@/features/tour/TourTarget';

const SERVINGS = PORTIONS.map(String);

export type AmountFood = Pick<FoodProduct, 'basis' | 'servingSize' | 'presetId' | 'packSize'>;

export type AmountState = ReturnType<typeof useAmount>;

/**
 * How much of a food: servings for per-serving foods; g or ml for the rest, with its sizes (a serving, a cup, the
 * whole pack), ¼…2 of a size, and How many (3 handfuls). Starts at `initial`, else one serving or the first size.
 */
export function useAmount(food: AmountFood | null, initial?: number) {
  const db = useDb();
  // Noted for tips about features not used lately.
  const usedHowMany = () => void recordUse(db, 'howMany').catch(() => undefined);
  // null until the owner types or picks: then the food's usual amount is shown.
  const [typed, setTyped] = useState<string | null>(initial !== undefined ? String(initial) : null);
  // "How many" as typed (e.g. "3" handfuls), kept so "1." isn't rewritten while typing.
  const [countTyped, setCountTyped] = useState<string | null>(null);
  const [measureIndex, setMeasureIndex] = useState(0);
  const setAmountText = (text: string) => {
    setTyped(text);
    setCountTyped(null);
  };

  const perServing = food?.basis === 'per_serving';
  const unit: 'serving' | 'g' | 'ml' = perServing ? 'serving' : food?.basis === 'per_100ml' ? 'ml' : 'g';
  const measures: Measure[] = food ? foodMeasures(food) : [];
  const measure = measures[Math.min(measureIndex, measures.length - 1)] ?? null;
  const asAmount = (portion: string) => (measure ? String(Math.round(Number(portion) * measure.grams * 100) / 100) : portion);

  const amountText = typed ?? (perServing ? '1' : measure ? String(measure.grams) : '');
  const parsed = parseAmount(amountText);
  const valid = parsed !== null && Number.isFinite(parsed) && parsed > 0;
  const amount = valid ? parsed : 0;
  // How many servings, or how many of the chosen size (3 handfuls), shown and set alongside the amount.
  const per = perServing ? 1 : (measure?.grams ?? 1);
  const count = valid ? amount / per : 0;
  const countText = countTyped ?? (valid ? String(Math.round(count * 100) / 100) : '');
  const setCount = (n: number) => {
    usedHowMany();
    setAmountText(String(Math.round(n * per * 100) / 100));
  };
  const typeCount = (text: string) => {
    usedHowMany();
    const n = parseAmount(text);
    if (n !== null && Number.isFinite(n) && n > 0) setTyped(String(Math.round(n * per * 100) / 100));
    else setTyped('');
    setCountTyped(text);
  };
  const chooseMeasure = (i: number) => {
    setMeasureIndex(i);
    setAmountText(String(measures[i].grams));
  };
  const hint = valid && unit !== 'serving' ? packHint(amount, food?.packSize ?? null, unit) : null;

  return {
    perServing,
    unit,
    measures,
    measure,
    measureIndex: Math.min(measureIndex, Math.max(0, measures.length - 1)),
    chooseMeasure,
    asAmount,
    amountText,
    setAmountText,
    amount,
    valid,
    count,
    countText,
    setCount,
    typeCount,
    hint,
  };
}

/** The controls for `useAmount`, to sit inside a list group. */
export function AmountPicker({ food, state, autoFocus }: { food: AmountFood; state: AmountState; autoFocus?: boolean }) {
  const { colors } = useTheme();
  const { perServing, unit, measures, measure, valid, amount, count } = state;
  return (
    <>
      {measures.length > 1 ? (
        <View style={{ padding: spacing.md, paddingBottom: 0 }}>
          <Segmented
            accessibilityLabel="Measure"
            value={String(state.measureIndex)}
            onChange={(i) => state.chooseMeasure(Number(i))}
            options={measures.map((m, i) => ({ value: String(i), label: measureLabel(food, m) }))}
          />
        </View>
      ) : null}
      {perServing || measure ? (
        <View style={{ padding: spacing.md, gap: spacing.sm }}>
          <Segmented
            accessibilityLabel="Servings"
            value={SERVINGS.find((s) => state.asAmount(s) === String(amount)) ?? ''}
            onChange={(s) => state.setAmountText(state.asAmount(s))}
            options={SERVINGS.map((s) => ({ value: s, label: friendlyNumber(Number(s)) }))}
          />
          {measure ? (
            <Text variant="caption" color="text2" numeric>
              {`${measure.label} = ${friendlyNumber(measure.grams)} ${unit}`}
            </Text>
          ) : null}
        </View>
      ) : null}
      {perServing || measure ? (
        <TourTarget id="product-how-many">
          <ListRow label="How many">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Button
                variant="secondary"
                label="−"
                accessibilityLabel="One fewer"
                disabled={!valid || count <= 1}
                onPress={() => state.setCount(Math.max(1, Math.ceil(count) - 1))}
                style={{ paddingHorizontal: spacing.md }}
              />
              <TextInput
                accessibilityLabel="How many"
                value={state.countText}
                onChangeText={state.typeCount}
                keyboardType="decimal-pad"
                selectionColor={colors.accent}
                style={{
                  width: 56,
                  textAlign: 'center',
                  color: colors.text,
                  fontFamily: fonts.semibold,
                  fontSize: 17,
                  padding: 0,
                }}
              />
              <Button
                variant="secondary"
                label="+"
                accessibilityLabel="One more"
                onPress={() => state.setCount(valid ? Math.floor(count) + 1 : 1)}
                style={{ paddingHorizontal: spacing.md }}
              />
              <Text variant="callout" color="text2" numberOfLines={1} style={{ flexShrink: 1 }}>
                {perServing ? 'servings' : `× ${measure!.label}`}
              </Text>
            </View>
          </ListRow>
        </TourTarget>
      ) : null}
      {perServing ? null : (
        <TextField
          label="Amount"
          value={state.amountText}
          onChangeText={state.setAmountText}
          keyboardType="decimal-pad"
          suffix={unit}
          autoFocus={autoFocus ?? !measure}
        />
      )}
      {state.hint ? (
        <Text variant="caption" color="text2" numeric style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
          {state.hint}
        </Text>
      ) : null}
    </>
  );
}
