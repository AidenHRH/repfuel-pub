import { COMMON_FOODS, type Measure } from './commonFoods';

/** One ingredient amount needed by a planned meal. Lines with the same key are added together. */
export type ShoppingLine = {
  key: string;
  name: string;
  group: string;
  amount: number;
  unit: 'g' | 'ml' | 'serving';
  /** Household measures, for a count you can pick up in a shop ("3 medium"). */
  measures?: Measure[];
};

export type ShoppingItem = { key: string; name: string; amountLabel: string; countLabel: string | null };
export type ShoppingGroup = { group: string; items: ShoppingItem[] };

const GROUP_ORDER = [...new Set(COMMON_FOODS.map((f) => f.group as string)), 'Other'];
const NOT_COUNTABLE = /^1 (cup|tbsp|tsp|handful|glass|mug|bowl|serving|pot|portion|scoop|pint|bottle|can)\b/;
const ADJECTIVES = new Set(['small', 'medium', 'large']);

function amountLabel(amount: number, unit: ShoppingLine['unit']): string {
  if (unit === 'serving') {
    const n = Math.ceil(amount * 2 - 0.01) / 2;
    return `${n} serving${n === 1 ? '' : 's'}`;
  }
  if (amount >= 1000) return `${Math.round(amount / 100) / 10} ${unit === 'g' ? 'kg' : 'l'}`;
  const step = amount >= 50 ? 5 : 1;
  return `${Math.max(1, Math.ceil(amount / step - 0.01) * step)} ${unit}`;
}

/** "3 medium", "2 wraps", "6 large" — or null when the food isn't bought by the piece. */
function countLabel(grams: number, measures: Measure[] | undefined): string | null {
  const m = measures?.find((x) => /^1 [a-z]+$/i.test(x.label) && !NOT_COUNTABLE.test(x.label));
  if (!m) return null;
  // A little over a whole one rounds down: 2.1 bananas is two bananas.
  const n = Math.max(1, Math.ceil(grams / m.grams - 0.15));
  const word = m.label.slice(2);
  const plural = n === 1 || ADJECTIVES.has(word) ? word : `${word}${/(s|ch|sh)$/.test(word) ? 'es' : 's'}`;
  return `${n} ${plural}`;
}

/** Adds up what a plan needs and groups it the way a shop is laid out. */
export function buildShoppingList(lines: ShoppingLine[]): ShoppingGroup[] {
  const totals = new Map<string, ShoppingLine>();
  for (const line of lines) {
    const k = `${line.key}|${line.unit}`;
    const prev = totals.get(k);
    totals.set(k, prev ? { ...prev, amount: prev.amount + line.amount } : { ...line });
  }
  const groups = new Map<string, ShoppingItem[]>();
  for (const [k, line] of totals) {
    const group = GROUP_ORDER.includes(line.group) ? line.group : 'Other';
    const items = groups.get(group) ?? [];
    items.push({
      key: k,
      name: line.name,
      amountLabel: amountLabel(line.amount, line.unit),
      countLabel: line.unit === 'serving' ? null : countLabel(line.amount, line.measures),
    });
    groups.set(group, items);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b))
    .map(([group, items]) => ({ group, items: items.sort((a, b) => a.name.localeCompare(b.name)) }));
}
