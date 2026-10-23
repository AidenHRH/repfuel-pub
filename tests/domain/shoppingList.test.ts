import { getCommonFood } from '@/domain/commonFoods';
import { buildShoppingList, type ShoppingLine } from '@/domain/shoppingList';

const common = (id: string, amount: number): ShoppingLine => {
  const f = getCommonFood(id)!;
  return {
    key: `preset:${id}`,
    name: f.name,
    group: f.group,
    amount,
    unit: f.basis === 'per_100ml' ? 'ml' : 'g',
    measures: f.measures,
  };
};

test('adds up the same food across meals, with a count to pick up in the shop', () => {
  const list = buildShoppingList([
    common('banana', 118),
    common('banana', 177),
    common('egg', 100),
    common('egg', 150),
    common('tortilla-wrap', 124),
  ]);
  const items = Object.fromEntries(list.flatMap((g) => g.items).map((i) => [i.name, i]));
  expect(items.Banana).toMatchObject({ amountLabel: '295 g', countLabel: '3 medium' });
  expect(items.Egg).toMatchObject({ amountLabel: '250 g', countLabel: '5 large' });
  expect(items['Tortilla wrap']).toMatchObject({ countLabel: '2 wraps' });
});

test('grouped in shop order, with no count for things bought by weight', () => {
  const list = buildShoppingList([
    common('olive-oil', 21),
    common('semi-skimmed-milk', 1250),
    common('banana', 118),
    { key: 'food:x', name: 'Protein bar', group: 'Other', amount: 3, unit: 'serving' },
  ]);
  expect(list.map((g) => g.group)).toEqual(['Fruit', 'Drinks', 'Nuts, seeds & spreads', 'Other']);
  expect(list[1].items[0]).toMatchObject({ amountLabel: '1.3 l', countLabel: null });
  expect(list[2].items[0]).toMatchObject({ amountLabel: '21 g', countLabel: null });
  expect(list[3].items[0]).toMatchObject({ amountLabel: '3 servings', countLabel: null });
});
