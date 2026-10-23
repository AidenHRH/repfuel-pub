import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { NutritionIcon, SearchIcon, StarIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { useDb } from '@/database/DatabaseProvider';
import { deleteFood, listFoods, setFoodFavourite } from '@/database/repositories/foodRepository';
import { deleteRecipe, listRecipes, recipeNutrients, setRecipeFavourite } from '@/database/repositories/recipeRepository';
import { kcalLabel, proteinLabel } from '@/domain/format';
import { nutritionEvents } from '@/features/nutrition/events';
import { PlanView } from '@/features/plan/PlanView';
import { safely } from '@/features/safely';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';
import { TourTarget } from '@/features/tour/TourTarget';

type Tab = 'meals' | 'foods' | 'plan';
type Row = { kind: 'recipe' | 'food'; id: string; name: string; detail: string; isFavourite: boolean };

const PER: Record<string, string> = { per_serving: 'per serving', per_100g: 'per 100 g', per_100ml: 'per 100 ml' };

export default function NutritionScreen() {
  const db = useDb();
  const router = useRouter();
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('meals');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => nutritionEvents.subscribe(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    if (tab === 'plan') return;
    let cancelled = false;
    (async () => {
      let next: Row[] = [];
      try {
        if (tab === 'meals') {
          const recipes = await listRecipes(db, { search });
          next = await Promise.all(
            recipes.map(async (r) => {
              const { nutrients, isApproximate } = await recipeNutrients(db, r.id);
              return {
                kind: 'recipe' as const,
                id: r.id,
                name: r.name,
                detail: `${kcalLabel(nutrients, isApproximate)} · ${proteinLabel(nutrients)} per portion${r.portionsMade > 1 ? ` · batch of ${r.portionsMade}` : ''}`,
                isFavourite: r.isFavourite,
              };
            }),
          );
        } else {
          const foods = await listFoods(db, { search });
          next = foods.map((f) => ({
            kind: 'food' as const,
            id: f.id,
            name: f.name,
            detail: `${kcalLabel(f.nutrients, f.dataSource === 'user_approximate')} · ${proteinLabel(f.nutrients)} ${PER[f.basis]}`,
            isFavourite: f.isFavourite,
          }));
        }
      } catch {
        next = [];
      }
      if (!cancelled) setRows(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, tab, search, version]);

  const toggleStar = async (row: Row) => {
    await safely(`update ${row.name}`, () =>
      row.kind === 'food' ? setFoodFavourite(db, row.id, !row.isFavourite) : setRecipeFavourite(db, row.id, !row.isFavourite),
    );
    nutritionEvents.emit({ type: 'changed' });
  };

  const confirmDelete = (row: Row) =>
    Alert.alert(
      `Delete ${row.name}?`,
      row.kind === 'food'
        ? 'It leaves your saved foods. Past entries and meals that use it are kept.'
        : 'It leaves your saved meals. Past entries and meals that include it are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await safely(`delete ${row.name}`, () => (row.kind === 'food' ? deleteFood(db, row.id) : deleteRecipe(db, row.id)));
            nutritionEvents.emit({ type: 'changed' });
          },
        },
      ],
    );

  const noun = tab === 'meals' ? 'meals' : 'foods';

  return (
    <Screen title="Nutrition">
      <TourTarget id="nutrition-plan">
        <Segmented
          accessibilityLabel="Show"
          value={tab}
          onChange={(next) => {
            if (next === tab) return;
            setRows(null);
            setTab(next);
          }}
          options={[
            { value: 'meals', label: 'Meals' },
            { value: 'foods', label: 'Foods' },
            { value: 'plan', label: 'Plan' },
          ]}
        />
      </TourTarget>

      {tab === 'plan' ? <PlanView /> : null}

      {tab === 'plan' ? null : (
        <>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              backgroundColor: colors.card,
              borderRadius: radii.control,
              paddingHorizontal: spacing.md,
              minHeight: 44,
            }}>
            <SearchIcon color={colors.text2} size={18} />
            <TextInput
              accessibilityLabel="Search"
              placeholder={`Search ${noun}`}
              placeholderTextColor={colors.text2}
              value={search}
              onChangeText={setSearch}
              selectionColor={colors.pro}
              style={{ flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 16, padding: 0 }}
            />
          </View>

          <View style={{ gap: spacing.sm }}>
            <SectionHeader
              title={tab === 'meals' ? 'Saved meals' : 'Saved foods'}
              action={{ label: 'New', onPress: () => router.push(tab === 'meals' ? '/recipe/new' : '/food/new') }}
            />
            {rows && rows.length === 0 && search ? (
              <Text variant="callout" color="text2" style={{ paddingHorizontal: spacing.xs }}>
                {`No ${noun} match “${search}”`}
              </Text>
            ) : null}
            {rows && rows.length === 0 && !search ? (
              <EmptyState
                icon={<NutritionIcon color={colors.pro} />}
                title={tab === 'meals' ? 'No saved meals yet' : 'No saved foods yet'}
                message={
                  tab === 'meals'
                    ? 'Build a meal or a batch like pico salad once, then log it with one tap.'
                    : 'Add a food from its label once and reuse it in meals and quick logs.'
                }
                action={{
                  label: tab === 'meals' ? 'Build a recipe' : 'Add a food',
                  onPress: () => router.push(tab === 'meals' ? '/recipe/new' : '/food/new'),
                }}
              />
            ) : null}
            {rows && rows.length > 0 ? (
              <View style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' }}>
                {rows.map((row, i) => (
                  <View
                    key={row.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: colors.sep,
                    }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${row.name}`}
                      accessibilityHint="Hold to delete"
                      onPress={() => router.push(row.kind === 'recipe' ? `/recipe/${row.id}` : `/food/${row.id}`)}
                      onLongPress={() => confirmDelete(row)}
                      style={({ pressed }) => ({
                        flex: 1,
                        paddingLeft: spacing.lg,
                        paddingVertical: spacing.md,
                        gap: 2,
                        backgroundColor: pressed ? colors.well : 'transparent',
                      })}>
                      <Text style={{ fontFamily: fonts.medium }} numberOfLines={1}>
                        {row.name}
                      </Text>
                      <Text variant="caption" color="text2" numeric numberOfLines={1}>
                        {row.detail}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${row.isFavourite ? 'Unstar' : 'Star'} ${row.name}`}
                      onPress={() => toggleStar(row)}
                      hitSlop={6}
                      style={{ width: 52, minHeight: 52, alignItems: 'center', justifyContent: 'center' }}>
                      <StarIcon color={row.isFavourite ? colors.kcal : colors.text2} filled={row.isFavourite} size={22} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            {rows && rows.length > 0 ? (
              <Text variant="caption" color="text2" style={{ paddingHorizontal: spacing.xs }}>
                Starred items appear first in My meals on Today. Hold a row to delete it.
              </Text>
            ) : null}
          </View>
        </>
      )}
    </Screen>
  );
}
