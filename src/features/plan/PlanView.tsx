import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { useDb } from '@/database/DatabaseProvider';
import {
  getDietPrefs,
  getPrep,
  getPrepSettings,
  logPlannedMeal,
  makePrep,
  setDietPrefs,
  setPrepSettings,
  shufflePrepSlot,
  type PrepView,
} from '@/database/repositories/mealPlanRepository';
import { DEFAULT_DIET, dietSummary, type DietPrefs } from '@/domain/diet';
import { portionCount } from '@/domain/format';
import { MEAL_LABELS } from '@/domain/meals';
import { DEFAULT_PREP, MAX_PREP_DAYS, PREP_SLOTS, type PrepSettings, type PrepSlot } from '@/domain/prepPlan';
import type { Nutrients } from '@/domain/types';
import { announce, nutritionEvents } from '@/features/nutrition/events';
import { safely } from '@/features/safely';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

import { DietSheet } from './DietSheet';

const n = (x: number | null) => (x === null ? '—' : Math.round(x).toLocaleString('en-GB'));
const lower = (slot: PrepSlot) => MEAL_LABELS[slot].toLowerCase();

/** "2,350 kcal · 165 g protein · 240 g carbs · 70 g fat" (unknowns as —). */
function macroLine(v: Nutrients): string {
  return `${n(v.kcal)} kcal · ${n(v.proteinG)} g protein · ${n(v.carbsG)} g carbs · ${n(v.fatG)} g fat`;
}

/**
 * Meal prep plan in the Nutrition tab: how many days and which meals, one suggested dish per meal (Shuffle, Browse,
 * or tap for the recipe), and the macros per meal, per day against the targets, and for the whole prep.
 */
export function PlanView() {
  const db = useDb();
  const router = useRouter();
  const { colors } = useTheme();
  const [settings, setSettings] = useState<PrepSettings>(DEFAULT_PREP);
  const [view, setView] = useState<PrepView | null>(null);
  const [prefs, setPrefs] = useState<DietPrefs>(DEFAULT_DIET);
  const [editingDiet, setEditingDiet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => nutritionEvents.subscribe(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await getPrepSettings(db);
      const [v, d] = await Promise.all([getPrep(db, s), getDietPrefs(db)]);
      if (cancelled) return;
      setSettings(s);
      setView(v);
      setPrefs(d);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [db, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const run = async (what: string, task: () => Promise<unknown>) => {
    setBusy(true);
    await safely(what, task);
    setBusy(false);
    refresh();
  };
  const change = (next: PrepSettings) => {
    setSettings(next);
    void run('save that', () => setPrepSettings(db, next));
  };
  const toggleSlot = (slot: PrepSlot) => {
    const on = settings.slots.includes(slot);
    // At least one meal stays on.
    if (on && settings.slots.length === 1) return;
    change({ ...settings, slots: PREP_SLOTS.filter((s) => (s === slot ? !on : settings.slots.includes(s))) });
  };

  const today = view?.days[0];
  const includesToday = settings.start === 'today';

  return (
    <View style={{ gap: spacing.lg }}>
      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ flex: 1, fontFamily: fonts.medium }}>Prep for</Text>
          <Button
            variant="secondary"
            label="−"
            accessibilityLabel="Fewer days"
            disabled={settings.days <= 1}
            onPress={() => change({ ...settings, days: settings.days - 1 })}
            style={{ paddingHorizontal: spacing.md }}
          />
          <Text numeric style={{ minWidth: 64, textAlign: 'center' }}>
            {`${settings.days} day${settings.days === 1 ? '' : 's'}`}
          </Text>
          <Button
            variant="secondary"
            label="+"
            accessibilityLabel="More days"
            disabled={settings.days >= MAX_PREP_DAYS}
            onPress={() => change({ ...settings, days: settings.days + 1 })}
            style={{ paddingHorizontal: spacing.md }}
          />
        </View>
        <Segmented
          accessibilityLabel="Starting"
          value={settings.start}
          onChange={(start) => change({ ...settings, start })}
          options={[
            { value: 'today', label: 'From today' },
            { value: 'tomorrow', label: 'From tomorrow' },
          ]}
        />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {PREP_SLOTS.map((slot) => {
            const on = settings.slots.includes(slot);
            return (
              <Pressable
                key={slot}
                accessibilityRole="checkbox"
                accessibilityLabel={`Plan ${lower(slot)}`}
                accessibilityState={{ checked: on }}
                onPress={() => toggleSlot(slot)}
                style={{
                  flex: 1,
                  minHeight: 40,
                  borderRadius: radii.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: on ? colors.pro : colors.well,
                }}>
                <Text variant="callout" style={{ fontFamily: fonts.semibold, color: on ? colors.onAccent : colors.text2 }}>
                  {MEAL_LABELS[slot]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="caption" color="text2">{`Diet: ${dietSummary(prefs)}`}</Text>
          <Button variant="plain" label="Change" accessibilityLabel="Change diet" onPress={() => setEditingDiet(true)} />
        </View>
      </Card>

      <Button
        label={busy ? 'Suggesting…' : view?.meals ? 'Suggest again' : 'Suggest meals'}
        disabled={busy}
        onPress={() => void run('suggest meals', () => makePrep(db, settings))}
      />

      {view?.earlier ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="callout" color="text2">
            Your earlier plan has different meals each day. Suggest meals to make a prep plan instead.
          </Text>
          {view.earlier.map(({ day, meals }) => (
            <Card key={day} style={{ gap: 2 }}>
              <Text variant="headline" accessibilityRole="header">
                {new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
              </Text>
              {meals.map((m) => (
                <Text key={m.slot} variant="callout" color="text2">{`${MEAL_LABELS[m.slot]}: ${m.name}`}</Text>
              ))}
            </Card>
          ))}
        </View>
      ) : null}

      {view?.meals
        ? view.meals.map((m) => {
            const meal = view.totals?.perMeal[m.slot];
            const cook = m.portions * view.days.length;
            return (
              <Card key={m.slot} style={{ gap: spacing.sm }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${MEAL_LABELS[m.slot]}: ${m.name}`}
                  accessibilityHint="Shows the recipe"
                  onPress={() =>
                    router.push(
                      m.kind === 'template'
                        ? { pathname: '/recipe-book/[id]', params: { id: m.id, portions: String(cook) } }
                        : `/recipe/${m.id}`,
                    )
                  }
                  style={({ pressed }) => ({ gap: 2, opacity: pressed ? 0.6 : 1 })}>
                  <Text variant="overline" color="text2">
                    {MEAL_LABELS[m.slot]}
                  </Text>
                  <Text variant="headline">{m.name}</Text>
                  <Text variant="caption" color="text2" numeric>
                    {`${portionCount(m.portions)} portion${m.portions === 1 ? '' : 's'} a day · ${portionCount(cook)} to make in all`}
                  </Text>
                  {meal ? (
                    <Text variant="caption" color="text2" numeric>
                      {macroLine(meal)}
                    </Text>
                  ) : null}
                </Pressable>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Button
                    variant="secondary"
                    label="Shuffle"
                    accessibilityLabel={`Shuffle ${lower(m.slot)}`}
                    disabled={busy}
                    onPress={() => void run(`shuffle ${lower(m.slot)}`, () => shufflePrepSlot(db, settings, m.slot))}
                    style={{ flex: 1 }}
                  />
                  <Button
                    variant="secondary"
                    label="Browse"
                    accessibilityLabel={`Browse ${lower(m.slot)}`}
                    onPress={() => router.push({ pathname: '/recipe-book', params: { pick: m.slot } })}
                    style={{ flex: 1 }}
                  />
                  {includesToday && today ? (
                    m.logged ? (
                      <Text
                        variant="caption"
                        color="pro"
                        accessibilityLabel={`${m.name} logged`}
                        style={{ alignSelf: 'center', paddingHorizontal: spacing.sm }}>
                        Logged ✓
                      </Text>
                    ) : (
                      <Button
                        variant="secondary"
                        label="Log"
                        accessibilityLabel={`Log ${m.name} for ${lower(m.slot)}`}
                        onPress={() => void run('log this meal', async () => announce(await logPlannedMeal(db, today, m.slot)))}
                        style={{ flex: 1 }}
                      />
                    )
                  ) : null}
                </View>
              </Card>
            );
          })
        : null}

      {view?.meals && view.totals ? (
        <Card style={{ gap: spacing.sm }}>
          <View accessible accessibilityLabel={`Per day: ${macroLine(view.totals.perDay)}`} style={{ gap: 2 }}>
            <Text variant="overline" color="text2">
              Per day
            </Text>
            <Text numeric>{macroLine(view.totals.perDay)}</Text>
            <Text variant="caption" color="text2" numeric>
              {`Targets ${n(view.targets.kcal)} kcal · ${n(view.targets.proteinG)} g protein${
                settings.slots.length < 3 ? ' (for the whole day, including meals not in the prep)' : ''
              }`}
            </Text>
          </View>
          <View
            accessible
            accessibilityLabel={`Whole prep, ${view.days.length} days: ${macroLine(view.totals.whole)}`}
            style={{ gap: 2 }}>
            <Text variant="overline" color="text2">
              {`Whole prep · ${view.days.length} day${view.days.length === 1 ? '' : 's'}`}
            </Text>
            <Text numeric>{macroLine(view.totals.whole)}</Text>
          </View>
        </Card>
      ) : null}

      {view?.meals || view?.earlier ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button variant="secondary" label="Shopping list" onPress={() => router.push('/shopping')} style={{ flex: 1 }} />
          <Button variant="secondary" label="Meal prep" onPress={() => router.push('/prep')} style={{ flex: 1 }} />
        </View>
      ) : null}
      <Button variant="plain" label="All recipes" onPress={() => router.push('/recipe-book')} />

      <DietSheet
        visible={editingDiet}
        prefs={prefs}
        onClose={() => setEditingDiet(false)}
        onSave={(next: DietPrefs) => {
          setEditingDiet(false);
          void run('save your diet', async () => {
            await setDietPrefs(db, next);
            await makePrep(db, settings);
          });
        }}
      />
    </View>
  );
}
