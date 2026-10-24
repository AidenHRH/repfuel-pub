import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Share, View } from 'react-native';

import { Button } from '@/components/Button';
import { CheckRow } from '@/components/CheckRow';
import { EmptyState } from '@/components/EmptyState';
import { NutritionIcon } from '@/components/icons';
import { ModalScreen } from '@/components/ModalScreen';
import { Text } from '@/components/Text';
import { useDb } from '@/database/DatabaseProvider';
import { planDayKeys, planShoppingList, setShoppingTick, shoppingTicks } from '@/database/repositories/mealPlanRepository';
import type { ShoppingGroup } from '@/domain/shoppingList';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';

/** What the week's plan needs, grouped like a shop, with ticks as you go round. */
export default function ShoppingScreen() {
  const db = useDb();
  const router = useRouter();
  const { colors } = useTheme();
  const [list, setList] = useState<ShoppingGroup[] | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    Promise.all([planShoppingList(db, planDayKeys(new Date())), shoppingTicks(db)])
      .then(([groups, ticks]) => {
        if (cancelled) return;
        setList(groups);
        setTicked(ticks);
      })
      .catch(() => {
        if (!cancelled) setList([]);
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const toggle = (key: string) => {
    const next = new Set(ticked);
    const on = !next.has(key);
    if (on) next.add(key);
    else next.delete(key);
    setTicked(next);
    setShoppingTick(db, key, on).catch(() => undefined);
  };

  const share = () => {
    const text = (list ?? [])
      .map((g) =>
        [g.group, ...g.items.filter((i) => !ticked.has(i.key)).map((i) => `• ${i.name}: ${i.countLabel ?? i.amountLabel}`)].join(
          '\n',
        ),
      )
      .join('\n\n');
    Share.share({ message: `Shopping list\n\n${text}` }).catch(() => undefined);
  };

  const count = list?.reduce((t, g) => t + g.items.length, 0) ?? 0;
  const left = list?.reduce((t, g) => t + g.items.filter((i) => !ticked.has(i.key)).length, 0) ?? 0;

  return (
    <ModalScreen
      title="Shopping list"
      closeLabel="Done"
      onClose={() => router.back()}
      action={count ? { label: 'Share', onPress: share } : undefined}>
      {list && count === 0 ? (
        <EmptyState
          icon={<NutritionIcon color={colors.accent} />}
          title="Nothing to buy yet"
          message="Make a meal plan in Nutrition and its shopping list appears here."
        />
      ) : null}
      {count > 0 ? (
        <Text variant="callout" color="text2">
          {left === 0 ? 'All done.' : `${left} of ${count} left for the next 7 days`}
        </Text>
      ) : null}
      {list?.map((g) => (
        <View key={g.group} style={{ gap: spacing.sm }}>
          <Text variant="overline" color="text2" accessibilityRole="header" style={{ paddingHorizontal: spacing.xs }}>
            {g.group}
          </Text>
          <View style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' }}>
            {g.items.map((item, i) => {
              const done = ticked.has(item.key);
              return (
                <CheckRow
                  key={item.key}
                  first={i === 0}
                  title={item.name}
                  checked={done}
                  onToggle={() => toggle(item.key)}
                  accessibilityLabel={`${item.name}, ${item.countLabel ? `${item.countLabel}, ` : ''}${item.amountLabel}`}
                  trailing={
                    <View style={{ alignItems: 'flex-end' }}>
                      {item.countLabel ? (
                        <Text variant="callout" color={done ? 'text2' : 'text'} numeric>
                          {item.countLabel}
                        </Text>
                      ) : null}
                      <Text variant="caption" color="text2" numeric>
                        {item.amountLabel}
                      </Text>
                    </View>
                  }
                />
              );
            })}
          </View>
        </View>
      ))}
      {count > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="caption" color="text2">
            Amounts are for the meals still to eat this week, with fresh weights for meat and cooked weights for rice, pasta and
            pulses.
          </Text>
          <Button variant="secondary" label="Share list" onPress={share} />
        </View>
      ) : null}
    </ModalScreen>
  );
}
