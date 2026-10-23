# RepFuel: meal prep browser (part B)

Status: draft for the owner's approval · 2026-10-23

## Why

The owner finds the current plan confusing: it picks meals and they tap Log. They want something like Gousto but
their own: suggested meals that fit their goal for breakfast, dinner (midday) and tea (evening), shuffle any of
them, open a meal to see its picture, full macros, every ingredient and step-by-step directions with the
ingredients highlighted, and see the macros per meal, per day and for the whole prep. Sometimes they cook 2 meals
for tomorrow, sometimes 4 for the week, sometimes they just get Gousto.

## Approaches (owner chose "both")

1. A built-in library of about 40 meal-prep recipes written for RepFuel, with exact grams (accurate macros) and
   Gousto-style steps. Works offline.
2. Search TheMealDB online from the phone for more ideas: real photos and directions, no macros or times.

The owner chose both. Recipe sites can't be reached from the build environment, so built-in directions are written
for RepFuel from standard methods rather than copied; TheMealDB is used live on the phone (free use is for personal
or educational apps, which RepFuel is for now).

## Words

The app's meals stay Breakfast, Lunch, Dinner. The owner's "dinner" is Lunch and "tea" is Dinner.

## What changes

### 1. Prep plan (Nutrition › Plan, replacing today's auto plan screen)

- **Days**: tomorrow only, or 2 to 7 days from tomorrow (or from today). **Meals**: Breakfast, Lunch, Dinner, each
  on or off (e.g. just Lunch and Dinner for 2 days).
- **One dish per meal for the whole prep** (that's meal prep: 4 boxes of chilli). Each meal shows a suggested dish
  that fits the targets, with **Shuffle** for another and **Browse** to pick from the full list.
- Portions are sized to the calorie and protein targets (as the planner does today), shown in the dish's own terms
  ("1.25 portions").
- **Macros**: per meal (each dish card), per day (the day's meals added up, against the targets) and **whole prep**
  (everything you'll cook: kcal, protein, carbs, fat, fibre).
- From the plan: **Shopping list** and **Meal prep** (the combined cooking order and fridge/freezer boxes) as now,
  and Log a planned meal in one tap on the day.
- Gousto weeks: nothing to do; Quick meal and saved Gousto meals as now.

### 2. Recipe screen (tap any dish: suggested, in Browse, or in a plan)

- **Picture**: the owner's own photo, or a plain placeholder with **Add a photo** (camera or gallery). Built-in
  recipes have no stock photos. TheMealDB recipes show theirs until the owner adds their own.
- **Times**: prep and cook minutes. **Macros** per portion, and for the portions in the plan.
- **Ingredients**: name, amount for the plan's portions (and per portion), and how it's prepared ("diced").
- **Steps**: numbered, Gousto style: what to do, how long, and the ingredients used in that step shown as
  highlighted chips with their amounts. **Cook mode**: one step at a time, large text, the screen kept awake.
- **Storage**: fridge or freezer and for how long, by the existing NHS rules.
- Diet tags (vegetarian, dairy-free…) as today; the diet settings filter suggestions.

### 3. Built-in library

About 40 recipes: today's 26 built-in meals upgraded to full recipes (their ids kept, so saved plans keep working)
plus about 14 new meal-prep dishes, across breakfast (overnight oats, egg muffins, protein pancakes…), lunch and
dinner (chicken rice and veg, turkey chilli, salmon and couscous, tuna pasta bake, beef stir-fry, chicken fajita
bowls, katsu, lasagne…). Each has ingredients in grams from RepFuel's built-in foods (so macros are worked out, not
guessed), prep and cook minutes, steps with their ingredients, and serves-how-many.

### 4. Search online (TheMealDB)

- **Browse › Search online**: search by name ("chicken", "pasta") or pick a category; results with photos.
- A result opens in the recipe screen with its photo, ingredients and amounts as written, and its instructions
  split into steps.
- **Macros are estimates**: each ingredient is matched to a RepFuel food and its amount converted (g, kg, ml, cups,
  tbsp, tsp, pieces). Anything it can't match or measure is listed as "not counted", so totals are marked ≈ and
  never treat an unknown as zero.
- **Save to my meals** makes it a RepFuel recipe: matched ingredients carry over; the rest are listed to scan or pick
  (the Build a meal screen), after which the macros are exact. Saved ones can go in plans like any recipe.
- Offline or TheMealDB down: "Can't reach TheMealDB right now", and the built-in library still works.

## Calls made without asking

- One dish per meal across the prep days (not a different dish per day). Easy to add later.
- No snacks in the prep plan.
- Photos stay on the phone (and in backups).
- New libraries: expo-image-picker (photos) and expo-keep-awake (cook mode), both Expo modules.

## Left to the builder

The recipes themselves (within the list above), the matching of TheMealDB ingredients, layout within the tokens,
tests.
