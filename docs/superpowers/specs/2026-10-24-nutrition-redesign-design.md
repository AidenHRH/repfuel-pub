# Nutrition redesign — design

Status: proposed (2026-10-24), from the owner interview. Mockups: https://claude.ai/artifact/EYjpBy49JhBpmNSEKipqUd
(Summary, logging steps, weekly review, colour schemes). Releases: 0.23 → 0.26, in that order (owner chose small
releases, approach A).

## Why

The owner: "it seems a little bit difficult to use … I just want to go in, log food, maybe see what I had
yesterday, or see my protein across the week, and if I've been meeting my targets", "very interactive … motivate me
… think Garmin", "I want it to walk me through step by step", "yesterday I got a Chinese, but I didn't log the meal
because I couldn't find exactly what I had". Workouts are fine; nutrition and its UI are the problem.

## Goals

- Logging that walks you through it and takes a few taps, with real photos and everyday amounts.
- Any past day viewable and editable; a meal can be logged again into any meal.
- Clear, rewarding feedback: day dots, streaks, badges, a weekly review, gentle nudges.
- Every food findable: packs by barcode or search with brand and shop, takeaways by estimate.
- Meal planning on TheMealDB with honest macros and Gousto-style filters.

## Non-goals

- Water tracking (owner: calorie drinks only). Weight is not on Summary (it lives on Progress).
- Tonnes lifted anywhere ("doesn't translate to anything").
- AI photo or text estimates of meals (possible later, costs per use).
- Paid data sources; a second food database (FatSecret) is a later, optional step.

## Anti-goals

- Never block logging on optional questions (shop, photo).
- Never treat an unknown value as zero; estimates are marked ≈.
- Nudges that nag or guilt: motivational, at most two a day, each switchable.

## Release 0.23 — the new look and looking back

**Ember colours.** Dark: background #141414, cards #1F1F1F, wells #2E2E2E, text #F7F3F0, secondary #ADA5A0, accent
coral #FF6B4A (text on it #1A0A05), protein teal #2EC4B6, calories amber #FFB547, missed-goal ring #FFD25A, PRs gold.
Light Ember (builder's call): warm off-white, the same coral, a darker teal so text passes contrast. Effort's
green→red scale is unchanged.

**Summary**, laid out after MyFitnessPal:
- "Today ▾" opens a date picker; a streak badge sits beside it.
- Week row (Mon–Sun) of dots, tappable to open that day: grey dashed (nothing logged); part-filled ring (some of
  breakfast, lunch and dinner logged); amber ring (fully logged, goals missed); solid coral with a tick (fully logged,
  goals hit). Fully logged = breakfast, lunch and dinner each have an item or are marked "skipped".
- Calories card (eaten / target, left), macro card (protein, carbs, fat with bars), "Drinks today: N · X kcal"
  (every item measured in ml, whatever meal it's in; tap for the list).
- Meals: Breakfast, Lunch, Dinner, Snacks, Drinks (drinks on their own), each with its total, photo thumbnails, a
  planned dish if any, and Log. "View diary" lists every item.
- Daily habits: creatine (tap to take, amounts as now), each workout session today (time · muscles, tap for its sets),
  no weight row.
- A + button (logging, 0.24 makes it step-by-step; in 0.23 it opens the current Log food).
- Week view: tap the dot row's header for the week's protein and calories per day against targets, and days on target.

**Past days.** The date picker or a dot opens that day in the same layout. Log buttons add to that day's meal (fixing
a forgotten Chinese). Hold an item or a meal → **Log again** → choose the meal (defaults to the one for the current
time) → it's logged today with the same amounts, editable.

**Workout sessions.** A lift logged within 60 minutes of the previous lift joins its session; longer starts a new one.
A session is named from its muscles ("Shoulders", "Chest & triceps") and its start time; classes are their own
sessions. Hold a lift → Move to previous session / Start new session. Summary and the Workouts tab show sessions; a
session opens its exercises, sets, reps, weights, effort and PRs.

**Shuffle fix.** A meal logged from a plan saves a copy under the owner's meals with the same name; shuffle must not
treat it as a different dish. Candidates are de-duplicated by name.

## Release 0.24 — logging step by step

1. **+** opens Log food set to the meal for the time (breakfast before 11:00, lunch 11–15, snack 15–17, dinner 17–22,
   snack after; builder's call), with pills Breakfast · Lunch · Dinner · Snack · Drink to change it.
2. Ways to add: **Scan barcodes** (stays in the scanner: scan the sandwich, then the can), **Search foods**,
   **Takeaway**, **My meals**; and "Recent at <meal>" with photos and one-tap add.
3. Each item asks only how much, in its natural units: the food's measures (1 can, 1 slice, a handful, "1 Malteser")
   and grams. A pack with no per-piece size asks once "How much does one weigh?" or "How many in the pack?" and
   remembers.
4. A basket ("Your lunch") lists items with photos and amounts, drinks marked, + Add a drink, + Add a snack, the
   meal's totals and what's left for the day; **Log N items** logs them all (drinks inside a meal stay in that meal and
   count in liquid calories).

**Search** shows the owner's own foods first ("you had this Tuesday"), then Open Food Facts results, each with pack
photo, name, brand, a shop tag (from Open Food Facts' stores, else own-brand rules: Ashfield Farm → Aldi, Birchwood →
Lidl, …) and kcal/protein per 100 g. A food saved without a known shop asks "Where's this from?" with shop pills and
Skip; never required; editable on the food's page. Each shop's version is its own food.

**Photos.** Packs use Open Food Facts' photo; TheMealDB dishes theirs; the owner's meals their photo; built-in plain
foods (banana, rice, chicken breast…) use freely licensed photos (Unsplash/Pexels-style licences), small, downloaded
on first view and cached. Photos show when choosing, in the basket, in the diary and on Summary.

**Takeaway estimates.** Tabs Chinese · Indian · Pizza · Chippy · Kebab · Burger · Italian · Thai; common dishes with
typical UK takeaway portions (half / regular / large; pizza by the slice), sides included; marked ≈ and counted like
any food. Values from published UK nutrition data, written as estimates.

**Nutrients.** Main: calories, protein, carbs, fat. Secondary: fibre and sugar, shown when known.

## Release 0.25 — goals, rewards and the weekly review

- **Goals hit** = protein ≥ target and calories within ±10% of target (builder's call), plus any extra goals turned
  on in Settings (e.g. fibre ≥ 30 g, sugar ≤ 60 g). A solid dot needs every goal on.
- **Streak**: days in a row with a solid dot; a small celebration (animation, haptic, "3 days in a row") when today's
  dot turns solid.
- **Badges** (Rewards page): 3/7/14/30/100-day streaks, first perfect week, 50 meals logged, protein 10 days running…
  **Streak savers**: one earned per 7-day streak, spent automatically on a missed day. **Unlocks**: some badges
  unlock an accent colour or app icon.
- **Weekly review** every Monday on Summary (swipeable; past ones under Progress): the week's dots and days on target;
  food (protein and calories per day vs targets with arrows on the week before, drinks' calories); training
  (sessions, PRs, average effort, strength gained: lifts' 1RM estimates against a month ago); one win and one thing to
  try, from plain rules on the owner's numbers; badges earned.
- **Nudges** (Settings › Reminders, each switchable, at most two a day, motivational wording): an unlogged meal after
  its usual time ("Lunch not logged yet. Snap the barcode and you're done"), protein still to go in the evening, a
  streak at stake before bed.
- **Progress**: "Weight lifted" goes; Overview's training figures become strength gained, PRs, sessions and effort.

## Release 0.26 — meal planning on TheMealDB

- The plan uses TheMealDB instead of the built-in recipe book (built-ins stay as "RepFuel recipes" but are not
  suggested by default).
- RepFuel downloads TheMealDB's catalogue (a few hundred meals, by letter) once and refreshes it weekly; filtering is
  instant and offline.
- **Honest macros**: an ingredient table covering TheMealDB's ingredient list (~600) with per-100 g values and typical
  piece sizes (a sausage, a rasher, a slice), plus **portions** estimated from the main protein (about 150 g raw meat
  or fish a portion; builder's call), editable. Anything still unmatched is listed and the totals marked ≈.
- **Plan screen**: the settings box (days, start, meals, diet), then search, then a scrolling pill row: main
  ingredient (Chicken, Beef, Turkey, Pork, Lamb, Fish, Prawns, Veggie, Vegan), protein (30 g+, 40 g+), calories (500 or
  less, 600 or less), cuisine (from TheMealDB areas), meal (Breakfast, Pasta, Salad). Same group = either; different
  groups narrow; a live count; at zero, offer to drop the last pill. Diet still applies.
- **Past plans**: a list by week with photos; open one to see its dishes, macros, which days were logged and how the
  week went; **Reuse this plan** (the normal setup, prefilled) or pick a single dish for lunch or dinner.

## Constraints

Expo SDK 58 app, local-first (SQLite); offline logging always works; Open Food Facts and TheMealDB over the network;
Supabase only for backup (and later a FatSecret key). Tokens only in `src/theme/tokens.ts`. Each release passes
`npm run check` and ships as a signed APK from `AidenHRH/repfuel-pub`.

## Left to the builder

Screen details within the mockups and tokens; the exact own-brand → shop list; photo sources and sizes; takeaway
dish list and values; badge list wording; migrations.
