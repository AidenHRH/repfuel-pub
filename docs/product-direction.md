# RepFuel — product direction

Last updated 2026-10-22. A note of where the owner wants RepFuel to go, so later stages are planned with it in mind.
Nothing here is built yet unless it says so.

## Now: a personal app (built)

Local-first Android app, shared with friends for feedback (each phone keeps its own data): one-tap meals, batch recipes, barcode scanning, lift logging with PRs,
meal sections, daily motivation. No accounts, no server, no paid cloud. Released as signed APKs from GitHub Actions.

## MyFitnessPal parity (owner request 2026-10-22)

The owner wants MyFitnessPal's logging features. Free in RepFuel, where MyFitnessPal charges for some (barcode
scan, Meal Scan and voice log are Premium there in 2026).

| MyFitnessPal | RepFuel |
| --- | --- |
| Search a food database by name | Done (0.6): Open Food Facts search, UK first, with pack pictures (0.10.1: moved to Open Food Facts' search service, as the old cgi/search.pl answers 503; the old one is a fallback); 0.7: built-in common foods with household measures (cup, slice, medium latte) |
| Barcode scan (Premium) | Working (owner confirmed 0.7.3): RepFuel reads the barcode from a photo itself (ZXing, pure JS), as Google's scanner reports Play services unavailable on some phones and the camera library's own scanner never fired; Google's scanner is an optional button |
| Quick add calories/macros | Removed from Today (0.7.2): owner: nobody knows a latte's calories, so search should fill them in. Quick meal (typed numbers, e.g. a Gousto card) stays in Log food |
| Recent / frequent foods | Done: My meals (starred + most logged), Snacks & drinks tiles |
| Save a meal, recipes | Done: My meals, recipes with batch shares, save an entry or quick meal as a meal |
| Add foods to a meal in the diary | Done (0.6): Build a meal, file under any meal |
| Swipe to edit/delete diary entries | Done (0.6) |
| Copy a meal from another day | Next |
| Build a meal from online search results | Next (Build a meal's picker lists saved foods only) |
| Photos of your own meals | Next: needs a photo picker (new native module) |
| Meal Scan (AI recognises a plate photo) | On hold (owner, 2026-10-22: core logging first). Needs an AI vision service (cost per scan) via the Cloudflare Worker; owner wants it to list what it found and let them add what it missed |
| Voice log | Later |
| Water | Not wanted (owner: calorie drinks only) |
| Meal plan builder (plans to hit calorie/macro targets) | Done (0.9): Nutrition › Plan. A week of breakfast, lunch, dinner and a snack, portions scaled to the calorie and protein targets, from the owner's saved meals (at the meal they usually have them) plus 24 simple built-in meals; no meal two days running; Shuffle a day, New plan, Log a planned meal today |
| Meal prep mode (step-by-step prep tasks, schedules) | Done (0.10): Plan › Meal prep. One cooking session today for the next 2, 3 or 5 days of the plan: totals to cook in order (oven first, cooked and dry weights), then a box per meal with what goes in it, Fridge or Freezer by NHS advice (leftovers 2 days, rice 24 hours), wrap fillings added on the day, salads never frozen. Ticks are kept |
| Dietary preferences for plans | Done (0.9): anything, vegetarian, pescatarian, vegan, plus dairy-free and gluten-free; option to leave out the owner's own meals. RepFuel can only check its built-in everyday foods, so the owner's own meals are taken as suiting them |
| Grocery list from a meal plan | Done (0.9): adds up the rest of the week's plan, grouped like a shop, with counts ("3 medium") and weights, ticks, and Share |
| Reminders (e.g. take creatine) | Done (0.8): creatine reminder, daily time, Taken button, streak on Today |
| Health rating of a scanned product (like Yuka) | Done (0.8.1): Good/Okay/Poor with reasons from Open Food Facts (Nutri-Score, NOVA, additives); Nutri-Score badges in lists. Not yet: rating an ingredients list photographed off a pack (needs text recognition) |

## Redesign and training (0.11, owner request 2026-10-22)

Design: `docs/superpowers/specs/2026-10-22-redesign-coaching-health-design.md`; mockups on the RepFuel Redesign canvas.

- Done (0.11): Summary (was Today) with floating Log food / Log workout pills, This week, the planned meal one tap away;
  Log food led by "What are you having?" with a scan button, shop results with pictures, macros per serving and +;
  live scanning with torch, photo and typing as fallbacks; product page with big numbers and a favourite star;
  Log workout for weight × reps, reps only (ab wheel, push-ups), timed (plank, with a timer) and classes (Hyrox, spin…
  with 1–10 effort and notes); Strava-style Workouts feed; longest-hold records; back up to a file and restore.
- Done (0.11.1): How many (3 handfuls, 2 cans) and search results as Suggested, Best match, More results.
- Done (0.12): Log food v2 (`docs/superpowers/specs/2026-10-22-log-food-v2-drinks-design.md`): Scan barcode first,
  Search food and Saved meals as their own screens, the 3 most recent, Favourites, Snacks and Drinks tiles, More ways
  to add. Drink is its own meal (Drinks on Summary, counted in the day), sized by the can, glass or bottle.
- Done (0.13): scan ingredients into a meal (`docs/superpowers/specs/2026-10-22-scan-ingredients-design.md`): Scan in
  Build a meal and saved meals, how much of each like logging a food (servings, grams, 1 pack, "250 g of a 500 g
  pack"), built-in foods for loose veg, tap an ingredient to change it, Makes N portions in Build a meal, hold a saved
  meal to edit it. Scanned products remember their pack size.
- Done (0.14): first-run tour and helpful tips (`docs/superpowers/specs/2026-10-22-tour-and-tips-design.md`): 8 stops
  spotlighting the real buttons (Summary, Log food, a product, Log workout, Settings), shown once and from Settings ›
  Show the tour again; tips for things not used lately, at most one every 3 days, each once; Helpful tips switch.
- Done (0.14.1): creatine amounts (`docs/superpowers/specs/2026-10-23-creatine-amounts-design.md`): daily amount and
  scoop size in Settings, Taken tops up to the daily amount, 2.5 / 5 / 10 g from Summary, doses add up.
- Done (0.14.3): effort as a slider (drag or tap), green 1 to red 10, haptic ticks and a shake that grow with effort.
- Done (0.15): spotter-helped reps (`docs/superpowers/specs/2026-10-23-spotter-reps-design.md`): Spotter helped on
  each set with how many of the last reps; solo PRs count only reps done alone; Spotter PRs for helped sets that beat
  everything with every rep counted; Spotted best on Progress.
- Done (0.16): exercise how-to (`docs/superpowers/specs/2026-10-23-exercise-how-to-design.md`): How to from Log
  workout and Progress; start and end photos and steps from Free Exercise DB for 81 of the 89 built-in exercises;
  your own YouTube video per exercise, played in the app.
- Done (0.17): recipe book (`docs/superpowers/specs/2026-10-23-meal-browser-design.md`, part 1): 40 recipes with
  ingredients, times and Gousto-style steps (ingredients highlighted), a recipe screen (your own photo, macros per
  portion, ingredients for the portions, storage), Cook mode, and Recipes to browse. Tap a planned meal for its recipe.
- Done (0.18): the prep plan (part 2): choose how many days (1–7), from today or tomorrow, and which meals; one dish
  per meal for every prep day, sized to the targets; Shuffle or Browse each meal (your own meals too); macros per
  meal, per day against the targets, and for the whole prep; the prep session makes each batch recipe in one go.
- Done (0.19): TheMealDB (part 3): Recipes › Search online by name or category; a result shows its photo (until
  you add yours), ingredients as written, its method as steps, ≈ macros a portion from matched ingredients with a
  Not counted list, and Save to my meals (matched ingredients carry over, then Edit recipe).
- Done (0.20): shared as a public repo (`AidenHRH/repfuel-pub`) with the signing key in Actions secrets; a welcome
  setup on a new install (age, height, weight, goal; BMI; realistic suggested targets,
  `docs/superpowers/specs/2026-10-23-welcome-setup-design.md`).
- Done (0.21): cloud backup with Supabase (`docs/superpowers/specs/2026-10-23-cloud-backup-design.md`): sign in
  with an emailed code; data and recipe photos back up to your own private folder when the app opens online and with
  Sync now; 14 days kept; Restore from cloud (offered on a new phone). Setup: `docs/cloud-backup-setup.md`.
- Next: Health Connect with a Health screen
  (smart scales, fitness trackers, running apps), then plans and coaching inside your training split.
- Owner request (2026-10-22), being designed: meal prep as a recipe browser, "like Gousto but our own": browse
  meals that fit the goal, open one for a picture, ingredients, full macros, method and prep time, and choose
  which to make instead of RepFuel picking them.

## Next: connectors (decided, not started)

A **Connectors** section in Settings to link wearables.

1. **Android Health Connect first.** WHOOP, Fitbit, Samsung Health and others sync into it, so one connection
   covers most devices with no server, no developer accounts and no cost, and data stays on the phone.
   Needs a native module and a development build (Continuous Native Generation, config plugin).
2. **WHOOP direct, via a free Cloudflare Worker, only if needed.** Reports suggest WHOOP's own Recovery % may not
   reach Health Connect (only HRV, resting heart rate, sleep). If so, a Cloudflare Worker (free tier) holds the
   WHOOP client secret, does the OAuth token exchange and refresh, and the app talks to it. Superseded by
   Supabase (cloud backup design, 2026-10-23), which can hold the secret in a server function. Needs a WHOOP developer account and a
   Cloudflare account. WHOOP's developer docs could not be read from the build environment; verify them first.

Still to decide with the owner: which data to show and where (e.g. recovery and sleep on Today, calories burned).

## Later: gym partnerships (exploring)

The owner is exploring partnerships with gyms, including recommending their personal trainers. Pitch:
[RepFuel — Gym Partner Pitch](https://claude.ai/artifact/HXbRkeNz7cCPTFpjtMTBaB).

- **USP for members:** the fastest logging for people who eat the same meals, training and food in one calm app,
  honest numbers (unknown ≠ 0, estimates marked ≈, PRs computed from history).
- **Value for gyms:** retention (members see progress), trainer referrals at the right moment (a stalled lift,
  protein under target, a new member, a milestone), a branded app without building one.
- **What it would take:** member accounts, a Play Store listing, a backend, gym branding, anonymous usage reports,
  and consent controls. UK GDPR treats health data as special category data: every share needs explicit,
  withdrawable consent. This is a change from "local-first, one person, no server", so design for it before
  building partner features.
- **Validate first:** talk to two or three local independent gyms or trainers, then run a free ~12-week pilot
  with one gym (measures: retention, app use, trainer bookings).

## Keep in mind now

Choices made in the personal app that should survive the move to many users: data kept behind repositories on the
`Db` interface (a sync layer can sit underneath), records computed rather than stored, no personal data leaving
the phone without a clear, deliberate step.
