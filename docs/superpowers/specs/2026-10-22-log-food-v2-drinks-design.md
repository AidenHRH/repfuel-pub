# RepFuel: Log food v2 (scan first) and drinks

Status: draft for the owner's approval · 2026-10-22 · small change; builds before the tour (the tour points at it)

## Why

The owner: scanning a barcode is RepFuel's best feature, so it should be the main way to log food, with search and
saved meals next to it, the last few things logged, and favourites one tap away. "A drink isn't a snack": drinks are
logged differently but still count towards the day's calories and macros, and stay under Log food.

## Log food, top to bottom

1. Meal picker: Breakfast · Lunch · Dinner · Snack · **Drink** (default from the clock as now; never Drink by default).
2. **Scan barcode**: full-width blue button with the barcode icon; opens the camera.
3. Two buttons side by side: **Search food** (opens the search screen: "What are you having?", Suggested, Best match,
   More results, as built) and **Saved meals** (saved meals and dishes, starred first, one tap to log).
4. **Recent**: the 3 most recently logged things, each with + to log again (per-100 foods ask how much).
5. **Favourites**: starred foods as one-tap tiles (hold for portions).
6. **Snacks** row and **Drinks** row of tiles (the old "Snacks & drinks" row split in two; hold to remove).
7. "More ways to add": Quick meal · Build a meal · New food (small row at the bottom).

## Drinks

- New meal category **Drink**: its own section on Summary ("Drinks"), its own place in the picker, counted in the
  day's totals like everything else.
- Logging a drink is volume-first: amounts in ml with the drink's sizes (Small/Medium/Large for coffees, a can,
  a glass, a bottle) and How many.
- A drink tile logs under Drink. Which foods are drinks: anything sold by volume (per 100 ml), the built-in Drinks
  group, and anything already in the old "Snacks & drinks" row that's per 100 ml; the rest of that row stays a snack.
- Water is still not tracked (owner: calorie drinks only).
- Migration 012: allow `drink` in the meal category of the food diary (rebuilding that table keeps every entry), and
  mark existing tiles as snack or drink.

## Calls for the owner to check

- Drink is never chosen automatically by time; you pick it (or tap a drink tile).
- Drink sizes: coffees keep Small/Medium/Large; cans 330 ml, a glass 250 ml, a bottle 500 ml where the product doesn't
  give its own size.

## Left to the builder

Button styles within the tokens, tile sizes, the exact search-screen route, migration mechanics, tests.
