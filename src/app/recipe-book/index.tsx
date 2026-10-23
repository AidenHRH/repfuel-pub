import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { ModalScreen } from '@/components/ModalScreen';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { useDb } from '@/database/DatabaseProvider';
import { choosePrepDish, getPrepSettings } from '@/database/repositories/mealPlanRepository';
import { listRecipes } from '@/database/repositories/recipeRepository';
import type { PrepSlot } from '@/domain/prepPlan';
import type { Recipe } from '@/domain/types';
import { nutritionEvents } from '@/features/nutrition/events';
import { safely } from '@/features/safely';
import { MEAL_LABELS } from '@/domain/meals';
import { MEAL_TEMPLATES, recipeTime, templateNutrients } from '@/domain/mealTemplates';
import { getMealDb, type MealDbSummary } from '@/services/mealdb';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

/** TheMealDB's part of the screen: nothing yet, loading, its categories, meals found, or unreachable. */
type Online =
  | { state: 'idle' | 'loading' | 'error' }
  | { state: 'categories'; categories: string[] }
  | { state: 'meals'; meals: MealDbSummary[] };

type Filter = 'all' | 'breakfast' | 'lunch' | 'dinner';
const FILTERS: Filter[] = ['all', 'breakfast', 'lunch', 'dinner'];

const isSlot = (v: string | undefined): v is PrepSlot => v === 'breakfast' || v === 'lunch' || v === 'dinner';

/**
 * The recipe book: every breakfast, lunch and dinner, searchable, each opening its recipe. With `pick=<meal>`
 * (Browse from the prep plan), choosing one puts it on that meal for every prep day, and the owner's own meals are
 * listed too.
 */
export default function RecipeBookScreen() {
  const params = useLocalSearchParams<{ pick?: string }>();
  const pick = isSlot(params.pick) ? params.pick : null;
  const db = useDb();
  const router = useRouter();
  const { colors } = useTheme();
  const [filter, setFilter] = useState<Filter>(pick ?? 'all');
  const [mine, setMine] = useState<Recipe[]>([]);
  useEffect(() => {
    if (!pick) return;
    let cancelled = false;
    listRecipes(db, {}).then(
      (r) => !cancelled && setMine(r),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [db, pick]);

  const choose = async (dish: { kind: 'template' | 'recipe'; id: string }) => {
    if (!pick) return;
    const done = await safely('choose that meal', async () => {
      await choosePrepDish(db, await getPrepSettings(db), pick, dish);
      return true;
    });
    if (!done) return;
    nutritionEvents.emit({ type: 'changed' });
    router.back();
  };
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const [online, setOnline] = useState<Online>({ state: 'idle' });
  const searchOnline = async (category?: string) => {
    setOnline({ state: 'loading' });
    const api = getMealDb();
    if (!category && q.length < 2) {
      const r = await api.categories();
      setOnline(r.status === 'ok' ? { state: 'categories', categories: r.categories } : { state: 'error' });
      return;
    }
    const r = await (category ? api.mealsIn(category) : api.searchMeals(q));
    setOnline(r.status === 'ok' ? { state: 'meals', meals: r.meals } : { state: 'error' });
  };
  const recipes = MEAL_TEMPLATES.filter(
    (t) => t.slot !== 'snack' && (filter === 'all' || t.slot === filter) && (!q || t.name.toLowerCase().includes(q)),
  );

  return (
    <ModalScreen title={pick ? `Choose ${MEAL_LABELS[pick].toLowerCase()}` : 'Recipes'} onClose={() => router.back()}>
      {pick ? null : (
        <Segmented
          accessibilityLabel="Meal"
          value={filter}
          onChange={setFilter}
          options={FILTERS.map((f) => ({ value: f, label: f === 'all' ? 'All' : MEAL_LABELS[f] }))}
        />
      )}
      <TextInput
        accessibilityLabel="Search recipes"
        placeholder="Search recipes"
        placeholderTextColor={colors.text2}
        value={search}
        onChangeText={setSearch}
        selectionColor={colors.pro}
        style={{
          backgroundColor: colors.card,
          borderRadius: radii.control,
          minHeight: 44,
          paddingHorizontal: spacing.md,
          color: colors.text,
          fontFamily: fonts.regular,
          fontSize: 16,
        }}
      />
      <View style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' }}>
        {recipes.length === 0 ? (
          <Text color="text2" style={{ padding: spacing.lg }}>
            No recipes match that.
          </Text>
        ) : null}
        {recipes.map((t, i) => {
          const per = templateNutrients(t);
          const macros = `${per.kcal === null ? '—' : Math.round(per.kcal)} kcal · ${per.proteinG === null ? '—' : Math.round(per.proteinG)} g protein`;
          return (
            <Pressable
              key={t.id}
              accessibilityRole="button"
              accessibilityLabel={`${t.name}, ${macros}`}
              onPress={() =>
                pick
                  ? void choose({ kind: 'template', id: t.id })
                  : router.push({ pathname: '/recipe-book/[id]', params: { id: t.id } })
              }
              style={({ pressed }) => ({
                padding: spacing.lg,
                gap: 2,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.sep,
                backgroundColor: pressed ? colors.well : 'transparent',
              })}>
              <Text style={{ fontFamily: fonts.medium }}>{t.name}</Text>
              <Text variant="caption" color="text2" numeric>
                {`${MEAL_LABELS[t.slot]} · ${macros} · ${recipeTime(t)}`}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {pick && mine.length ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="overline" color="text2" accessibilityRole="header" style={{ paddingHorizontal: spacing.xs }}>
            Your meals
          </Text>
          <View style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' }}>
            {mine
              .filter((r) => !q || r.name.toLowerCase().includes(q))
              .map((r, i) => (
                <Pressable
                  key={r.id}
                  accessibilityRole="button"
                  accessibilityLabel={r.name}
                  onPress={() => void choose({ kind: 'recipe', id: r.id })}
                  style={({ pressed }) => ({
                    padding: spacing.lg,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.sep,
                    backgroundColor: pressed ? colors.well : 'transparent',
                  })}>
                  <Text style={{ fontFamily: fonts.medium }}>{r.name}</Text>
                </Pressable>
              ))}
          </View>
        </View>
      ) : null}
      {pick ? null : (
        <View style={{ gap: spacing.sm }}>
          <Text variant="overline" color="text2" accessibilityRole="header" style={{ paddingHorizontal: spacing.xs }}>
            More from TheMealDB
          </Text>
          <Button
            variant="secondary"
            label={online.state === 'loading' ? 'Searching…' : 'Search online'}
            accessibilityLabel="Search online"
            disabled={online.state === 'loading'}
            onPress={() => void searchOnline()}
          />
          {online.state === 'error' ? (
            <Text color="text2" style={{ paddingHorizontal: spacing.xs }}>
              Can’t reach TheMealDB right now
            </Text>
          ) : null}
          {online.state === 'categories' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {online.categories.map((c) => (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityLabel={c}
                  onPress={() => void searchOnline(c)}
                  style={({ pressed }) => ({
                    paddingHorizontal: spacing.md,
                    minHeight: 40,
                    justifyContent: 'center',
                    borderRadius: radii.pill,
                    backgroundColor: pressed ? colors.well : colors.card,
                  })}>
                  <Text variant="callout">{c}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {online.state === 'meals' ? (
            <View style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' }}>
              {online.meals.length === 0 ? (
                <Text color="text2" style={{ padding: spacing.lg }}>
                  Nothing on TheMealDB for that.
                </Text>
              ) : null}
              {online.meals.map((m, i) => (
                <Pressable
                  key={m.id}
                  accessibilityRole="button"
                  accessibilityLabel={m.name}
                  onPress={() => router.push({ pathname: '/recipe-book/online/[id]', params: { id: m.id } })}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    padding: spacing.md,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.sep,
                    backgroundColor: pressed ? colors.well : 'transparent',
                  })}>
                  {m.thumb ? (
                    <Image
                      source={{ uri: `${m.thumb}/preview` }}
                      contentFit="cover"
                      style={{ width: 56, height: 56, borderRadius: radii.control }}
                    />
                  ) : null}
                  <Text style={{ flex: 1, fontFamily: fonts.medium }}>{m.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </ModalScreen>
  );
}
