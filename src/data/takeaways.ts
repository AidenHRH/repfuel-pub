/**
 * UK takeaway estimates: common dishes at typical takeaway portions. Values are ESTIMATES, built from typical
 * published UK figures for takeaway portions (restaurant nutrition pages, NHS and Food Standards Agency surveys of
 * takeaway meals): protein, carbs and fat per regular portion, with calories worked out from them (4/4/9 kcal per g).
 * Takeaways vary a lot between shops, so every one is logged marked ≈. Half and large are 0.5× and 1.4× a regular;
 * pizza is by the slice of a 12″ pizza.
 */

export const TAKEAWAY_CUISINES = ['Chinese', 'Indian', 'Pizza', 'Chippy', 'Kebab', 'Burger', 'Italian', 'Thai'] as const;
export type TakeawayCuisine = (typeof TAKEAWAY_CUISINES)[number];

export type TakeawaySize = {
  label: 'Half' | 'Regular' | 'Large' | '1 slice';
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type TakeawayDish = { id: string; cuisine: TakeawayCuisine; name: string; sizes: TakeawaySize[] };

type Macros = [protein: number, carbs: number, fat: number];

const size = (label: TakeawaySize['label'], [p, c, f]: Macros, factor: number): TakeawaySize => {
  const proteinG = Math.round(p * factor);
  const carbsG = Math.round(c * factor);
  const fatG = Math.round(f * factor);
  return { label, proteinG, carbsG, fatG, kcal: Math.round((proteinG * 4 + carbsG * 4 + fatG * 9) / 10) * 10 };
};

const dish = (cuisine: TakeawayCuisine, id: string, name: string, regular: Macros): TakeawayDish => ({
  id,
  cuisine,
  name,
  sizes:
    cuisine === 'Pizza'
      ? [size('1 slice', regular, 1)]
      : [size('Half', regular, 0.5), size('Regular', regular, 1), size('Large', regular, 1.4)],
});

// [protein, carbs, fat] in g for a regular portion (pizza: one slice).
export const TAKEAWAYS: TakeawayDish[] = [
  dish('Chinese', 'chow-mein-chicken', 'Chicken chow mein', [45, 95, 32]),
  dish('Chinese', 'sweet-sour-chicken', 'Sweet and sour chicken (battered)', [38, 120, 38]),
  dish('Chinese', 'egg-fried-rice', 'Egg fried rice', [20, 125, 28]),
  dish('Chinese', 'salt-pepper-chicken', 'Salt and pepper chicken', [48, 40, 42]),
  dish('Chinese', 'crispy-chilli-beef', 'Crispy chilli beef', [32, 95, 48]),
  dish('Chinese', 'black-bean-beef', 'Beef in black bean sauce', [40, 25, 32]),
  dish('Chinese', 'chinese-chicken-curry', 'Chicken curry (Chinese)', [42, 35, 30]),
  dish('Chinese', 'spring-rolls', 'Vegetable spring rolls (4)', [8, 48, 22]),
  dish('Chinese', 'prawn-crackers', 'Prawn crackers (bag)', [2, 58, 30]),
  dish('Indian', 'tikka-masala', 'Chicken tikka masala', [60, 30, 62]),
  dish('Indian', 'korma', 'Chicken korma', [52, 32, 70]),
  dish('Indian', 'jalfrezi', 'Chicken jalfrezi', [58, 22, 34]),
  dish('Indian', 'rogan-josh', 'Lamb rogan josh', [48, 20, 56]),
  dish('Indian', 'chicken-biryani', 'Chicken biryani', [55, 120, 38]),
  dish('Indian', 'pilau-rice', 'Pilau rice', [9, 95, 10]),
  dish('Indian', 'plain-naan', 'Plain naan', [16, 90, 14]),
  dish('Indian', 'onion-bhaji', 'Onion bhajis (2)', [7, 32, 26]),
  dish('Pizza', 'pizza-margherita', 'Margherita pizza', [10, 28, 8]),
  dish('Pizza', 'pizza-pepperoni', 'Pepperoni pizza', [12, 28, 13]),
  dish('Pizza', 'pizza-bbq-chicken', 'BBQ chicken pizza', [14, 31, 9]),
  dish('Pizza', 'pizza-meat-feast', 'Meat feast pizza', [15, 28, 16]),
  dish('Pizza', 'pizza-vegetarian', 'Vegetarian pizza', [9, 29, 8]),
  dish('Pizza', 'pizza-hawaiian', 'Ham and pineapple pizza', [11, 30, 8]),
  dish('Pizza', 'garlic-bread-slice', 'Garlic bread (1 slice)', [5, 22, 8]),
  dish('Chippy', 'battered-cod', 'Battered cod', [36, 34, 36]),
  dish('Chippy', 'battered-haddock', 'Battered haddock', [38, 34, 33]),
  dish('Chippy', 'chippy-chips', 'Chips', [14, 136, 44]),
  dish('Chippy', 'battered-sausage', 'Battered sausage', [12, 30, 30]),
  dish('Chippy', 'mushy-peas', 'Mushy peas', [12, 26, 2]),
  dish('Chippy', 'fishcake', 'Fishcake', [8, 30, 16]),
  dish('Chippy', 'curry-sauce', 'Curry sauce', [2, 18, 8]),
  dish('Kebab', 'doner-pitta', 'Doner kebab in pitta', [45, 70, 58]),
  dish('Kebab', 'chicken-shish-pitta', 'Chicken shish in pitta', [50, 65, 20]),
  dish('Kebab', 'lamb-shish-pitta', 'Lamb shish in pitta', [48, 65, 30]),
  dish('Kebab', 'mixed-kebab', 'Mixed kebab', [70, 75, 68]),
  dish('Kebab', 'kebab-chips', 'Chips (kebab shop)', [12, 120, 38]),
  dish('Kebab', 'garlic-mayo', 'Garlic mayo (pot)', [1, 3, 32]),
  dish('Burger', 'cheeseburger', 'Cheeseburger', [16, 32, 12]),
  dish('Burger', 'double-burger', 'Double cheeseburger', [28, 44, 28]),
  dish('Burger', 'chicken-burger', 'Crispy chicken burger', [24, 48, 22]),
  dish('Burger', 'burger-fries', 'Fries', [4, 44, 16]),
  dish('Burger', 'chicken-nuggets', 'Chicken nuggets (6)', [15, 16, 15]),
  dish('Burger', 'milkshake', 'Milkshake', [9, 55, 9]),
  dish('Italian', 'spaghetti-bolognese', 'Spaghetti bolognese', [35, 90, 25]),
  dish('Italian', 'carbonara', 'Spaghetti carbonara', [35, 90, 48]),
  dish('Italian', 'lasagne', 'Lasagne', [40, 60, 42]),
  dish('Italian', 'arrabbiata', 'Penne arrabbiata', [18, 100, 14]),
  dish('Italian', 'mushroom-risotto', 'Mushroom risotto', [18, 85, 30]),
  dish('Italian', 'garlic-bread', 'Garlic bread', [9, 45, 15]),
  dish('Thai', 'pad-thai', 'Chicken pad thai', [45, 110, 30]),
  dish('Thai', 'green-curry', 'Thai green curry (chicken)', [40, 20, 52]),
  dish('Thai', 'red-curry', 'Thai red curry (chicken)', [38, 22, 48]),
  dish('Thai', 'massaman', 'Massaman curry', [40, 45, 56]),
  dish('Thai', 'jasmine-rice', 'Jasmine rice', [8, 98, 1]),
  dish('Thai', 'chicken-satay', 'Chicken satay (4 skewers)', [40, 12, 26]),
  dish('Thai', 'thai-fishcakes', 'Thai fish cakes (4)', [20, 22, 14]),
];

export function getTakeaway(id: string): TakeawayDish | null {
  return TAKEAWAYS.find((d) => d.id === id) ?? null;
}
