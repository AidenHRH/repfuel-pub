import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { BarcodeIcon, ChevronIcon, PlusIcon, SearchIcon } from '@/components/icons';
import { ModalScreen } from '@/components/ModalScreen';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { useDb } from '@/database/DatabaseProvider';
import { recentItems, toLoggable } from '@/database/repositories/foodLogRepository';
import { saveProductFood } from '@/database/repositories/barcodeRepository';
import { setInDrinksRow, setInSnacksRow } from '@/database/repositories/snackRepository';
import { listFoods } from '@/database/repositories/foodRepository';
import { foodsShownAsMeals, listRecipes } from '@/database/repositories/recipeRepository';
import { measureLabel, searchCommonFoods, type CommonFood } from '@/domain/commonFoods';
import { amountLabel, friendlyNumber, kcalLabel, proteinLabel } from '@/domain/format';
import { MEAL_CATEGORIES, MEAL_LABELS, mealCategoryFor } from '@/domain/meals';
import { roundForDisplay } from '@/domain/nutrition';
import { rankHits } from '@/domain/searchRank';
import type { NutriScore } from '@/domain/health';
import type { FoodProduct, Loggable, MealCategory } from '@/domain/types';
import { logAndAnnounce } from '@/features/nutrition/events';
import { NutriScoreBadge } from '@/features/nutrition/HealthCard';
import { TileRow } from '@/features/nutrition/TileRow';
import { useDrinkItems, useFavouriteItems, useSnackItems } from '@/features/nutrition/useQuickPicks';
import { safely } from '@/features/safely';
import type { SearchHit, SearchResult } from '@/services/food-provider/types';
import { getFoodProvider } from '@/services/foodProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';
import { TourTarget } from '@/features/tour/TourTarget';

type Item = {
  key: string;
  name: string;
  loggable: Loggable | null;
  food: FoodProduct | null;
  detail: string;
};

const CATEGORIES = MEAL_CATEGORIES;
const AUTO_SEARCH_MIN = 3;
const AUTO_SEARCH_PAUSE_MS = 700;
const RECENT_SHOWN = 3;
const isMeal = (v: string | undefined): v is MealCategory => !!v && (CATEGORIES as string[]).includes(v);

/** "1 cup · 148 g · 84 kcal" for a common food's first measure. */
function commonDetail(f: CommonFood): string {
  const m = f.measures[0];
  return `${measureLabel(f, m)} · ${Math.round(((f.per100.kcal ?? 0) * m.grams) / 100)} kcal · typical`;
}

type Online =
  | { query: string; state: 'loading' }
  | { query: string; state: 'done'; hits: SearchHit[] }
  | {
      query: string;
      state: 'error';
      reason: Extract<SearchResult, { status: 'error' }>['reason'];
    };

const ONLINE_PROBLEMS: Record<Extract<Online, { state: 'error' }>['reason'], string> = {
  busy: 'You’ve searched a lot in the last minute. Open Food Facts asks apps to slow down, so try again shortly.',
  offline: 'No internet connection. Your saved foods and meals above still work.',
  timeout: 'Open Food Facts didn’t answer. Try again in a moment.',
  server: 'Open Food Facts is having trouble. Try again later.',
};

/** Per-100 foods always ask how much; everything else logs its usual amount in one tap. */
function needsAmount(item: Item) {
  return item.food !== null && item.food.basis !== 'per_serving';
}

/** "Nestlé · 215 kcal per 41.5 g", or per 100 g when no serving is listed. */
function hitDetail({ draft }: SearchHit): string {
  const per100 = draft.basis === 'per_100ml' ? 'ml' : 'g';
  const kcal = draft.nutrients.kcal ?? 0;
  const amount = draft.servingSize
    ? `${roundForDisplay((kcal * draft.servingSize) / 100, 'kcal')} kcal per ${friendlyNumber(draft.servingSize)} ${per100}`
    : `${roundForDisplay(kcal, 'kcal')} kcal per 100 ${per100}`;
  return draft.brand ? `${draft.brand} · ${amount}` : amount;
}

/** "Nestlé · 41.5 g" (or "per 100 g" when the pack lists no serving). */
function hitSubtitle({ draft }: SearchHit): string {
  const unit = draft.basis === 'per_100ml' ? 'ml' : 'g';
  const size = draft.servingSize ? `${friendlyNumber(draft.servingSize)} ${unit}` : `per 100 ${unit}`;
  return draft.brand ? `${draft.brand} · ${size}` : size;
}

/** "215 kcal · 2.7 P · 24.9 C · 11.2 F" for one serving (or 100 g); unknowns show as –. */
export function macroFooter({ draft }: SearchHit): string {
  const factor = (draft.servingSize ?? 100) / 100;
  const n = draft.nutrients;
  const g = (v: number | null) => (v === null ? '–' : String(Math.round(v * factor * 10) / 10));
  return `${n.kcal === null ? '–' : Math.round(n.kcal * factor)} kcal · ${g(n.proteinG)} P · ${g(n.carbsG)} C · ${g(n.fatG)} F`;
}

export type FoodLoggerMode = 'home' | 'search' | 'saved';

const TITLES: Record<FoodLoggerMode, string> = { home: 'Log food', search: 'Search food', saved: 'Saved meals' };

/**
 * Log food and its two side screens: `home` (the start of logging), `search` (What are you having?: Suggested,
 * Best match, More results) and `saved` (saved meals, starred first). Anything logged here closes back to Summary.
 */
export function FoodLogger({ mode }: { mode: FoodLoggerMode }) {
  const params = useLocalSearchParams<{ meal?: string }>();
  const db = useDb();
  const router = useRouter();
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Item[] | null>(null);
  const [recent, setRecent] = useState<Loggable[] | null>(null);
  const [online, setOnline] = useState<Online | null>(null);
  const snackTiles = useSnackItems();
  const drinkTiles = useDrinkItems();
  const favouriteTiles = useFavouriteItems();
  // The meal everything logged from here goes to: picked first, like a diary.
  const [category, setCategory] = useState<MealCategory>(() => (isMeal(params.meal) ? params.meal : mealCategoryFor(new Date())));
  // Snack tiles go under Snacks unless a meal was picked on purpose (here or by the screen that opened this).
  const [mealPicked, setMealPicked] = useState(isMeal(params.meal));

  useEffect(() => {
    let cancelled = false;
    recentItems(db).then(
      (list) => !cancelled && setRecent(list),
      () => !cancelled && setRecent([]),
    );
    return () => {
      cancelled = true;
    };
  }, [db]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [recipes, allFoods, asMeals] = await Promise.all([
          listRecipes(db, { search }),
          // Without a search, saved meals and starred foods are listed here; other foods turn up under Recently had or a search.
          search.trim() ? listFoods(db, { search }) : listFoods(db, {}).then((all) => all.filter((f) => f.isFavourite)),
          foodsShownAsMeals(db),
        ]);
        // A quick meal saved as a meal is listed once, as the meal.
        const foods = allFoods.filter((f) => !asMeals.has(f.id));
        const recipeItems = await Promise.all(
          recipes.map(async (r) => {
            const loggable = await toLoggable(db, { kind: 'recipe', id: r.id });
            return {
              key: `recipe:${r.id}`,
              name: r.name,
              loggable,
              food: null,
              detail: loggable ? detail(loggable) : 'Meal',
            };
          }),
        );
        const foodItems = await Promise.all(
          foods.map(async (f) => {
            const loggable = f.basis === 'per_serving' ? await toLoggable(db, { kind: 'food', id: f.id }) : null;
            const per = f.basis === 'per_100g' ? 'per 100 g' : 'per 100 ml';
            return {
              key: `food:${f.id}`,
              name: f.name,
              loggable,
              food: f,
              detail: loggable ? detail(loggable) : `${kcalLabel(f.nutrients, f.dataSource === 'user_approximate')} · ${per}`,
            };
          }),
        );
        if (!cancelled) setItems([...recipeItems, ...foodItems]);
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, search]);

  const log = async (item: { kind: 'food' | 'recipe'; id: string; name: string }, amount: number) => {
    const entry = await safely(`log ${item.name}`, () => logAndAnnounce(db, item, amount, category));
    if (entry) router.dismissAll();
  };

  const query = search.trim();
  const searchOnline = async (q = query) => {
    if (!q || (online?.query === q && online.state !== 'error')) return;
    const query = q;
    const provider = getFoodProvider();
    if (!provider.search) return;
    setOnline({ query, state: 'loading' });
    const result = await provider.search(query).catch((): SearchResult => ({ status: 'error', reason: 'server' }));
    setOnline(
      result.status === 'ok' ? { query, state: 'done', hits: result.hits } : { query, state: 'error', reason: result.reason },
    );
  };

  // The shops are searched by themselves once typing pauses (Search on the keyboard goes straight away).
  useEffect(() => {
    if (query.length < AUTO_SEARCH_MIN) return;
    const timer = setTimeout(() => void searchOnline(query), AUTO_SEARCH_PAUSE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs per query; searchOnline reads the latest state
  }, [query]);

  const chooseHit = (hit: SearchHit) => {
    const params = {
      draft: JSON.stringify(hit.draft),
      ...(hit.barcode ? { barcode: hit.barcode } : {}),
    };
    // Calories and protein are needed for your totals; without them, check the product first.
    const complete = hit.draft.nutrients.kcal !== null && hit.draft.nutrients.proteinG !== null;
    router.push({
      pathname: complete ? '/food/log' : '/food/new',
      params: { ...params, meal: category },
    });
  };

  // One serving straight from the results, when the product has a serving size and its calories and protein.
  const canQuickLog = (hit: SearchHit) =>
    !!hit.draft.name && !!hit.draft.servingSize && hit.draft.nutrients.kcal !== null && hit.draft.nutrients.proteinG !== null;
  const quickLog = async (hit: SearchHit) => {
    const entry = await safely(`log ${hit.draft.name}`, async () => {
      const food = await saveProductFood(db, { barcode: hit.barcode, draft: hit.draft });
      return logAndAnnounce(db, { kind: 'food', id: food.id }, hit.draft.servingSize!, category);
    });
    if (entry) router.dismissAll();
  };

  const shownOnline = online && online.query === query ? online : null;
  const ranked = shownOnline?.state === 'done' ? rankHits(shownOnline.hits, query) : [];
  // Recent leaves out what's already a tile below, so nothing on Log food is listed twice.
  const tileIds = new Set([...(snackTiles ?? []), ...(drinkTiles ?? []), ...(favouriteTiles ?? [])].map((t) => t.id));
  const recentShown = (recent ?? []).filter((r) => !(r.kind === 'food' && tileIds.has(r.id))).slice(0, RECENT_SHOWN);
  // Saved meals lists meals only; a search lists everything of yours that matches.
  const listed = query ? items : (items?.filter((i) => i.food === null) ?? null);
  // The meal goes on to the side screens only when it was picked, so a drink there can still default to Drink.
  const mealParam = mealPicked ? { meal: category } : {};
  const common = searchCommonFoods(query);
  const meal = { meal: category };
  const openAmount = (food: FoodProduct) => router.push({ pathname: '/food/log', params: { id: food.id, ...meal } });
  const logRecent = (item: Loggable) =>
    item.kind === 'food' && item.unit !== 'serving'
      ? router.push({ pathname: '/food/log', params: { id: item.id, ...meal } })
      : void log(item, item.defaultAmount);

  return (
    <ModalScreen title={TITLES[mode]} onClose={() => router.back()}>
      <TourTarget id="log-food-meal">
        <Segmented
          accessibilityLabel="Meal"
          value={category}
          onChange={(c) => {
            setCategory(c);
            setMealPicked(true);
          }}
          options={CATEGORIES.map((c) => ({ value: c, label: MEAL_LABELS[c] }))}
        />
      </TourTarget>
      {mode !== 'search' ? null : (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              backgroundColor: colors.card,
              borderRadius: radii.control + 2,
              paddingHorizontal: spacing.md,
              minHeight: 48,
            }}>
            <SearchIcon color={colors.text2} size={18} />
            <TextInput
              accessibilityLabel="Search foods and meals"
              placeholder="What are you having?"
              placeholderTextColor={colors.text2}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => void searchOnline()}
              returnKeyType="search"
              autoFocus
              selectionColor={colors.accent}
              style={{
                flex: 1,
                color: colors.text,
                fontFamily: fonts.regular,
                fontSize: 17,
                padding: 0,
              }}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scan a barcode"
            onPress={() => router.push({ pathname: '/scan', params: meal })}
            style={({ pressed }) => ({
              width: 48,
              height: 48,
              borderRadius: radii.control + 2,
              backgroundColor: colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}>
            <BarcodeIcon color={colors.onAccent} size={22} />
          </Pressable>
        </View>
      )}

      {mode === 'home' ? (
        <>
          <TourTarget id="log-food-scan">
            <Button
              label="Scan barcode"
              icon={<BarcodeIcon color={colors.onAccent} size={22} />}
              onPress={() => router.push({ pathname: '/scan', params: meal })}
            />
          </TourTarget>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              variant="secondary"
              label="Search food"
              onPress={() => router.push({ pathname: '/search-food', params: mealParam })}
              style={{ flex: 1 }}
            />
            <Button
              variant="secondary"
              label="Saved meals"
              onPress={() => router.push({ pathname: '/saved-meals', params: mealParam })}
              style={{ flex: 1 }}
            />
          </View>
        </>
      ) : null}

      {mode === 'search' && !query ? (
        <Text variant="callout" color="text2" style={{ paddingHorizontal: spacing.xs }}>
          Type a food or a brand. RepFuel shows your own foods first, then what’s in the shops.
        </Text>
      ) : null}

      {mode === 'home' && recentShown.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="overline" color="text2" accessibilityRole="header" style={{ paddingHorizontal: spacing.xs }}>
            Recent
          </Text>
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: radii.card,
              overflow: 'hidden',
            }}>
            {recentShown.map((item, i) => {
              const ask = item.kind === 'food' && item.unit !== 'serving';
              return (
                <Row
                  key={`${item.kind}:${item.id}`}
                  first={i === 0}
                  label={
                    ask ? `Choose amount of ${item.name}` : `Log ${amountLabel(item.defaultAmount, item.unit)} of ${item.name}`
                  }
                  name={item.name}
                  detail={detail(item)}
                  imageUrl={null}
                  trailing={ask ? 'chevron' : 'plus'}
                  onPress={() => logRecent(item)}
                />
              );
            })}
          </View>
        </View>
      ) : null}

      {mode === 'home' ? (
        <>
          <TileRow title="Favourites" items={favouriteTiles} category={category} onLogged={() => router.dismissAll()} />
          {/* Snack and drink tiles go under Snacks and Drinks unless a meal was picked on purpose. */}
          <TileRow
            title="Snacks"
            items={snackTiles}
            category={mealPicked ? category : 'snack'}
            onLogged={() => router.dismissAll()}
            removal={{ label: 'Remove from Snacks', run: (id) => setInSnacksRow(db, id, false) }}
          />
          <TileRow
            title="Drinks"
            items={drinkTiles}
            category={mealPicked ? category : 'drink'}
            onLogged={() => router.dismissAll()}
            removal={{ label: 'Remove from Drinks', run: (id) => setInDrinksRow(db, id, false) }}
          />
          <View style={{ gap: spacing.sm }}>
            <Text variant="overline" color="text2" accessibilityRole="header" style={{ paddingHorizontal: spacing.xs }}>
              More ways to add
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.md - 2 }}>
              <ActionTile
                label="Quick meal"
                hint="Rough numbers, e.g. Gousto"
                onPress={() => router.push({ pathname: '/food/new', params: { quick: '1', ...meal } })}
              />
              <ActionTile
                label="Build a meal"
                hint="Add what's on your plate"
                onPress={() => router.push({ pathname: '/recipe/new', params: { now: '1', ...meal } })}
              />
              <ActionTile
                label="New food"
                hint="From a label"
                onPress={() => router.push({ pathname: '/food/new', params: meal })}
              />
            </View>
          </View>
        </>
      ) : null}

      {mode === 'saved' || query ? (
        <View style={{ gap: spacing.sm }}>
          {query ? (
            <Text variant="overline" color="text2" accessibilityRole="header" style={{ paddingHorizontal: spacing.xs }}>
              Suggested
            </Text>
          ) : null}
          {listed && listed.length === 0 && common.length === 0 ? (
            <Text variant="callout" color="text2" style={{ paddingHorizontal: spacing.xs }}>
              {query
                ? 'Nothing of yours matches that yet.'
                : 'No saved meals yet. Build a meal, or save a quick meal to My meals.'}
            </Text>
          ) : null}
          {(listed && listed.length > 0) || common.length > 0 ? (
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: radii.card,
                overflow: 'hidden',
              }}>
              {(listed ?? []).map((item, i) => {
                const ask = needsAmount(item);
                const label = ask
                  ? `Choose amount of ${item.name}`
                  : item.loggable
                    ? `Log ${amountLabel(item.loggable.defaultAmount, item.loggable.unit)} of ${item.name}`
                    : `Log ${item.name}`;
                return (
                  <Row
                    key={item.key}
                    first={i === 0}
                    label={label}
                    name={item.name}
                    detail={item.detail}
                    imageUrl={item.food?.imageUrl ?? null}
                    grade={item.food?.health?.nutriscore}
                    trailing={ask ? 'chevron' : 'plus'}
                    disabled={!ask && !item.loggable}
                    // Saved meals: hold to change what's in it.
                    onLongPress={
                      mode === 'saved' && item.food === null
                        ? () => router.push(`/recipe/${item.key.slice('recipe:'.length)}`)
                        : undefined
                    }
                    onPress={() => {
                      if (ask && item.food) openAmount(item.food);
                      else if (item.loggable) void log(item.loggable, item.loggable.defaultAmount);
                    }}
                  />
                );
              })}
              {common.map((f, i) => (
                <Row
                  key={f.id}
                  first={i === 0 && !listed?.length}
                  label={`Choose ${f.name}, ${commonDetail(f)}`}
                  name={f.name}
                  detail={commonDetail(f)}
                  imageUrl={null}
                  trailing="chevron"
                  onPress={() =>
                    router.push({
                      pathname: '/food/log',
                      params: { preset: f.id, ...meal },
                    })
                  }
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {query ? (
        <View style={{ gap: spacing.sm }}>
          {!shownOnline || shownOnline.state !== 'done' || shownOnline.hits.length === 0 ? (
            <Text variant="overline" color="text2" accessibilityRole="header" style={{ paddingHorizontal: spacing.xs }}>
              In the shops
            </Text>
          ) : null}
          {(!shownOnline && query.length < AUTO_SEARCH_MIN) || shownOnline?.state === 'error' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Search Open Food Facts for “${query}”`}
              onPress={() => void searchOnline()}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                minHeight: 52,
                paddingHorizontal: spacing.lg,
                borderRadius: radii.card,
                backgroundColor: pressed ? colors.well : colors.card,
              })}>
              <SearchIcon color={colors.accent} size={18} />
              <Text color="accent" style={{ fontFamily: fonts.semibold, flexShrink: 1 }} numberOfLines={1}>
                {`Search for “${query}”`}
              </Text>
            </Pressable>
          ) : null}
          {shownOnline?.state === 'error' ? (
            <Text variant="callout" color="text2" style={{ paddingHorizontal: spacing.xs }}>
              {ONLINE_PROBLEMS[shownOnline.reason]}
            </Text>
          ) : null}
          {shownOnline?.state === 'loading' || (!shownOnline && query.length >= AUTO_SEARCH_MIN) ? (
            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center', padding: spacing.md }}>
              <ActivityIndicator color={colors.accent} />
              <Text variant="callout" color="text2">
                Searching the shops…
              </Text>
            </View>
          ) : null}
          {shownOnline?.state === 'done' && shownOnline.hits.length === 0 ? (
            <Text variant="callout" color="text2" style={{ paddingHorizontal: spacing.xs }}>
              Nothing on Open Food Facts matches that. Try fewer words or the brand, scan the barcode, or add it as a new food.
            </Text>
          ) : null}
          {ranked.length > 0 ? (
            <>
              <Text variant="overline" color="text2" accessibilityRole="header" style={{ paddingHorizontal: spacing.xs }}>
                Best match
              </Text>
              <View style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' }}>
                <HitRow
                  first
                  hit={ranked[0]}
                  onChoose={() => chooseHit(ranked[0])}
                  onQuickLog={canQuickLog(ranked[0]) ? () => void quickLog(ranked[0]) : undefined}
                />
              </View>
            </>
          ) : null}
          {ranked.length > 1 ? (
            <>
              <Text
                variant="overline"
                color="text2"
                accessibilityRole="header"
                style={{ paddingHorizontal: spacing.xs, marginTop: spacing.sm }}>
                More results
              </Text>
              <View style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' }}>
                {ranked.slice(1).map((hit, i) => (
                  <HitRow
                    key={`${hit.barcode ?? 'x'}:${i}`}
                    first={i === 0}
                    hit={hit}
                    onChoose={() => chooseHit(hit)}
                    onQuickLog={canQuickLog(hit) ? () => void quickLog(hit) : undefined}
                  />
                ))}
              </View>
            </>
          ) : null}
          {ranked.length > 0 ? (
            <Text variant="caption" color="text2" style={{ paddingHorizontal: spacing.xs }}>
              From Open Food Facts, a free database anyone can edit. Check the label if a number looks off.
            </Text>
          ) : null}
        </View>
      ) : null}
    </ModalScreen>
  );
}

function detail(loggable: Loggable) {
  return `${amountLabel(loggable.defaultAmount, loggable.unit)} · ${kcalLabel(loggable.nutrients, loggable.isApproximate)} · ${proteinLabel(loggable.nutrients)}`;
}

function Row({
  first,
  label,
  name,
  detail: subtitle,
  imageUrl,
  showPicture,
  trailing,
  disabled,
  grade,
  onPress,
  onLongPress,
}: {
  first: boolean;
  label: string;
  name: string;
  detail: string;
  imageUrl: string | null;
  /** Keep a picture slot even without a picture, so search results line up. */
  showPicture?: boolean;
  trailing: 'plus' | 'chevron';
  disabled?: boolean;
  /** Nutri-Score, shown as a small coloured letter when known. */
  grade?: NutriScore | null;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={onLongPress ? 'Hold to edit' : undefined}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingLeft: spacing.lg,
        paddingRight: spacing.md,
        paddingVertical: spacing.md,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.sep,
        backgroundColor: pressed ? colors.well : 'transparent',
      })}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          accessibilityLabel={`${name} picture`}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={120}
          style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            backgroundColor: '#FFFFFF',
          }}
        />
      ) : showPicture ? (
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            backgroundColor: colors.well,
          }}
        />
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.medium }} numberOfLines={2}>
          {name}
        </Text>
        <Text variant="caption" color="text2" numeric numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {grade ? <NutriScoreBadge grade={grade} /> : null}
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: trailing === 'chevron' ? colors.well : colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {trailing === 'chevron' ? <ChevronIcon color={colors.accent} size={16} /> : <PlusIcon color={colors.onAccent} size={16} />}
      </View>
    </Pressable>
  );
}

function ActionTile({ label, hint, onPress }: { label: string; hint: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 78,
        backgroundColor: colors.card,
        borderRadius: radii.card,
        padding: spacing.md + 2,
        justifyContent: 'space-between',
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}>
      <Text variant="headline" style={{ fontSize: 15 }}>
        {label}
      </Text>
      <Text variant="caption" color="text2">
        {hint}
      </Text>
    </Pressable>
  );
}

/** A shop product: picture, name, brand and size, macros per serving; tap to choose an amount, + to log one. */
function HitRow({
  first,
  hit,
  onChoose,
  onQuickLog,
}: {
  first: boolean;
  hit: SearchHit;
  onChoose: () => void;
  onQuickLog?: () => void;
}) {
  const { colors } = useTheme();
  const name = hit.draft.name ?? '';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.sep,
      }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Choose ${name}, ${hitDetail(hit)}`}
        onPress={onChoose}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingLeft: spacing.md,
          paddingRight: spacing.sm,
          paddingVertical: spacing.md - 2,
          backgroundColor: pressed ? colors.well : 'transparent',
        })}>
        {hit.imageUrl ? (
          <Image
            source={{ uri: hit.imageUrl }}
            accessibilityLabel={`${name} picture`}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={120}
            style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: '#FFFFFF' }}
          />
        ) : (
          <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: colors.well }} />
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.semibold }} numberOfLines={2}>
            {name}
          </Text>
          <Text variant="caption" color="text2" numberOfLines={1}>
            {hitSubtitle(hit)}
          </Text>
          <Text variant="caption" color="text2" numeric numberOfLines={1}>
            {macroFooter(hit)}
          </Text>
        </View>
        {hit.draft.health?.nutriscore ? <NutriScoreBadge grade={hit.draft.health.nutriscore} /> : null}
      </Pressable>
      {onQuickLog ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Log 1 serving of ${name}`}
          onPress={onQuickLog}
          hitSlop={6}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 18,
            marginRight: spacing.md,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pressed ? 0.92 : 1 }],
          })}>
          <PlusIcon color={colors.onAccent} size={18} />
        </Pressable>
      ) : (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            marginRight: spacing.md,
            backgroundColor: colors.well,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <ChevronIcon color={colors.accent} size={16} />
        </View>
      )}
    </View>
  );
}
