# RepFuel: redesign, workout types, exercise how-to, health data and coaching

Status: draft for the owner's approval · 2026-10-22
Mockups: [RepFuel Redesign canvas](https://claude.ai/artifact/QmPBzbg1RfYz53VEGLdWAW) (8 phone screens, agreed after two rounds)

## Why

RepFuel works and the owner uses it daily (Android, UK, local-first, signed APKs from GitHub releases). Three
things now hold it back:

1. **The everyday jobs take too many steps.** The owner opens RepFuel to do one of three things: log food they
   are about to eat (search "kitkat", pick the right one by its picture and macros, choose how much), scan
   ingredients for a meal, or log a workout/PR ("bench 90 kg × 1, effort 8, new PR"). Search with pictures and
   the product screen already exist but are buried and busy.
2. **Training is more than weight × reps.** Ab roller is reps only, plank is a time, and Hyrox and
   other classes are where what matters is how long and how hard it felt.
3. **RepFuel knows a lot but doesn't help with it.** It has your PRs, food, bodyweight and (via Health
   Connect) smart-scale, fitness-tracker and running-app data, but gives no guidance. Someone training a
   body-part split (back & biceps, chest & triceps, legs, shoulders, …) plus classes wants to be pushed when
   ready and told what to change when a lift stalls.

The USP the owner liked: **coaching that explains a plateau from your own food, body and recovery data**
("bench has stalled 4 weeks; protein averaged 112 g vs 145 g on training days").

## Goals

- Apple-like, minimal, professional: neutral greys, one accent (RepFuel blue `#6CB4FF`) used only on main
  actions; amber for calories, gold for PRs; big numbers, quiet labels; smooth motion. Dark by default, light
  supported (as today).
- The two main actions, **Log food** and **Log workout**, are floating pills at the bottom of Summary, where the
  thumbs are (owner preference over buttons at the top).
- Workouts support four kinds of exercise entry: weight × reps, reps only, time, and classes.
- Every exercise has how-to steps and photos offline, plus a YouTube video where a good one exists.
- One Health Connect connection brings in smart scales, fitness trackers and running apps (whatever you allow); a
  Health screen pulls body, recovery, training and fuel together.
- Strength plans that slot into your split, and coaching (progress nudges, plateau detection with
  reasons from your own data).

## Non-goals (for this project)

- No AI/LLM coach (decided: rules now; an optional "Ask about this" may come later).
- No copying third-party programmes or videos (Muscle & Fitness plans are their copyright; RepFuel can link to
  them, not reproduce them).
- No accounts, server or cloud sync; no gym-partner features (see `docs/product-direction.md`).
- No WHOOP direct API (only what WHOOP writes to Health Connect; the Cloudflare route stays "only if needed").
- No meal photos, AI plate scan, or voice logging.

## Anti-goals (a failure even if it works)

- **Made-up advice.** Every number in a plan or tip must come from a published method applied to the owner's
  logged data, and each tip shows why. If there isn't enough data, RepFuel says so and asks for a test set; it
  never guesses.
- **Unachievable plans.** Small steps (2.5 kg upper body, 5 kg lower body), planned deloads, and starting
  below the current max.
- **Overstated causes.** e.g. missing a few creatine days is not a plateau cause (stores last weeks); only a
  multi-week lapse may be mentioned. Correlation is phrased as "may be", never "is".
- **Busy screens.** Each screen does one job; no dashboards of everything.
- **Losing data.** New migrations only add; nothing existing is dropped or reinterpreted.

## Constraints

- Expo SDK 58, React Native 0.88, Expo Router (`src/app`), TypeScript, expo-sqlite behind `Db`, migrations
  only add (next is 011). Design tokens only in `src/theme/tokens.ts`; logic in `src/domain` (pure) and
  `src/database` (repositories); unknown values are `null`, never 0. `npm run check` must pass.
- No hand-edited `android/`; native config via config plugins in `app.json` (Continuous Native Generation).
  Health Connect needs a native module, which is fine: releases are already full native builds in CI.
- `api.expo.dev`, Open Food Facts and USDA are blocked in the build environment; npm works.
- Health Connect: Android only; the owner grants each data type; RepFuel reads, never writes, in this project.

## Approaches considered (owner chose the recommended one each time)

1. **Design medium.** (a) Claude Design mockups first, **chosen**: cheap to change; (b) build straight into the
   app: real motion but each round costs a ~25 min build; (c) clickable HTML prototype: rebuilt anyway.
2. **Coaching engine.** (a) **Rules in the app, chosen**: published formulas, explainable, offline, private;
   (b) AI coach: flexible but needs a server/key, costs per use, sends data off the phone, can be confidently
   wrong; (c) rules now, AI later.
3. **How-to content.** (a) **Bundled Free Exercise DB steps/photos for the library's exercises, chosen**: works
   with no signal; YouTube needs internet either way; (b) download on first open: smaller app, blank offline.
4. **Order.** (a) **Redesign with the new workout types → how-to → Health Connect + Health screen → plans and
   coaching, chosen**: coaching needs the health data to explain plateaus; (b) Health Connect first.

## The work, in order

Each part is released on its own (version bump, APK) so the owner can use it before the next starts.

### Part 1: Redesign + new workout types (0.11)

Screens as on the canvas:

- **Summary** (renamed from Today; tab label too). Date overline, "Summary" large title. Rings card (calories
  outer amber, protein inner blue) with "860 left / 33 g to go". Creatine row (tick/Undo, streak). "Food today"
  list by meal with the planned meal's one-tap Log. "This week" (latest sessions, PR badge, class effort) with
  See all. **Floating pills** Log food / Log workout above the tab bar.
- **Log food** (sheet). Meal chips (default from the clock, as now: 05–11 breakfast, 11–15 lunch, 15–17 snack,
  17–21 dinner, else snack; one tap to change). Search field "What are you having?" with a blue scan button
  beside it. Results: "You've had" first, then "In the shops" (Open Food Facts), each row: picture, name,
  brand · size, then a macro footer (kcal in amber · P · C · F per serving), Nutri-Score letter; row tap opens the
  product, "+" logs one serving straight away. The existing Scan / Quick meal / Build a meal / New food tiles
  move below the results (empty-query state keeps them).
- **Scan.** Live scanning only by default (owner: it now scans straight away). Close and torch buttons, corner
  viewfinder, "Point at the barcode · It scans by itself". On a hit, a card slides up with picture/name/size and
  opens the product. "Take a photo instead" (the ZXing photo path) and "Type the number" are small text
  buttons at the bottom; the big shutter goes.
- **Product.** Large pack photo, back and favourite star on it. Name, brand, "1 bar = 41.5 g", verdict pill.
  Four big numbers (kcal, protein, carbs, fat) that update with the portion. Portion segmented ¼ ½ ¾ 1 1½ 2,
  "Or weigh it" grams field. Health card (Nutri-Score scale + reasons). Pinned bottom: "Adding to Snack ·
  change" and one big "Log ½ bar · 107 kcal".
- **Log workout** (sheet). Exercise | Class switch. Exercise: recent exercises as chips + Search all; header
  with last time; set cards whose fields depend on the exercise's **kind**; effort 1–10 row; "+ Add a set";
  a gold "New PR" card appears live before saving; pinned "Save <exercise>".
- **Exercise kinds** (new `tracking` on exercise: `weight_reps` | `reps` | `time`):
  - `weight_reps`: weight + reps (today's behaviour).
  - `reps`: reps only, "Add weight (vest, plate)" optional. Ab wheel rollout, push-ups, pull-ups, dips, etc.
  - `time`: a big mm:ss with Start timer / Type a time. Plank, side plank, wall sit, dead hang.
  - Records per kind: weight_reps as today (heaviest, e1RM, reps at weight); reps → most reps in a set;
    time → longest hold.
  - Seeded exercises get their kind in the migration; custom exercises choose it when created.
  - Storage: `workout_set.duration_seconds` already exists; reps-only sets store `weight_kg` null.
  - Sets logged before the change keep their values and show as logged (e.g. an ab-roller set with a weight
    still shows it); only new sets follow the kind.
- **Class** (new). Class type chips: built-in Hyrox, Spin, HIIT, Run; "+ New class" adds the owner's own.
  When (default now), How long (± 5 min, default 60), **How hard** 1–10 with bars growing in height and a
  label per level (owner's "how strenuous it was"), Notes. A dashed card marks where Health Connect heart rate
  and strain will show (Part 3). Save.
  - Storage: a `class_session` table (id, class_type_id, started_at, duration_min, effort 1–10, notes) and
    `class_type` (id, name, is_custom). Kept apart from lifts so records logic stays simple.
  - Effort labels (session RPE, the CR-10 scale): 1 very easy … 5 hard … 7 very hard … 9 very, very hard …
    10 maximal. Exact wording is the builder's, matching the canvas.
- **Workouts** feed. Large title + "Log" pill. Week card: sessions, training time, PRs; a 7-day strip coloured
  strength (blue) / class (orange); legend. Then days with session cards: lifts list their sets ("90 kg × 1 ·
  80 kg × 5"), reps-only ("15 · 12 · 12 reps"), timed ("1:30 · 1:15"), classes ("9/10 · very, very hard",
  duration, note).
- **Unchanged screens restyled to match:** Nutrition (Meals/Foods/Plan), shopping list, meal prep, Progress,
  Settings, entry/food/recipe editors; same tokens and components.
- **Motion:** sheets slide up (existing), rings animate to new values on log, a short PR celebration (scale +
  haptic) when a record is set. Respect the system "reduce motion" setting.
- **Back up to a file** in Settings (export the SQLite data as a file to share/save, and restore from one),
  as a safety net besides installing updates over the top.

### Part 2: Exercise how-to (0.12)

- Tapping an exercise (in Log workout's header, the Workouts feed, or Progress) opens **How to**: start/end
  photos, numbered steps, primary/secondary muscles, then "Watch on YouTube" when a video is set.
- Content: [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) (listed as the Unlicense; **verify the
  repo's LICENSE covers the images before shipping**). Match its exercises to RepFuel's 89 library exercises by
  name (a reviewed mapping file in `src/domain`), bundle only those images (resized, ~60–80 KB each), and keep
  attribution in Settings › About.
- YouTube: one hand-picked video id per exercise where a reputable coaching channel has a clear demo; shown in
  the app with a YouTube embed (needs `react-native-webview` or a YouTube iframe component; internet needed).
  Missing video → no button, never a search guess. The owner can review/replace picks.
- Custom exercises: no photos; the owner can paste a YouTube link.

### Part 3: Health Connect + Health screen (0.13)

- **Connectors** in Settings: "Health Connect" with a clear permission request per data type, and a "What
  RepFuel found" list after connecting (sources and latest values) before anything is shown elsewhere.
- Library: `react-native-health-connect` (4.x, ships a config plugin). Read only.
- Data read (owner allows each): weight, body fat %, lean body mass, bone mass, body water mass, basal metabolic
  rate (smart scales); sleep sessions, resting heart rate, heart-rate variability, heart rate during sessions (WHOOP);
  exercise sessions, distance, active calories (trackers, running apps); steps. BMI = weight / height² from the
  profile. Whatever a source doesn't write simply doesn't appear (e.g. a scale's visceral fat and metabolic age
  have no Health Connect type; WHOOP's Recovery % may not be shared).
- Imported readings are cached locally with their source and time, refreshed on open and pull-to-refresh;
  RepFuel's own bodyweight log merges with scale weigh-ins (same-day duplicates resolved to the scale).
- **Health** screen (new tab or a card on Summary opening it; builder's call with the owner): four sections,
  each a headline number + a small trend:
  - Body: weight with a smoothed 7-day trend (water swings shouldn't mislead), body fat, lean mass.
  - Recovery: sleep last night and 7-day average, resting heart rate, HRV.
  - Training: sessions this week, effort, PRs (RepFuel) + tracker and running-app activities.
  - Fuel: 7-day average calories and protein vs targets.
- Classes and lifts are matched to Health Connect exercise sessions by overlapping time to show heart rate and
  calories on the session card (the dashed placeholder from Part 1).

### Part 4: Plans and coaching (0.14)

- **Plans fit your split.** You pick which day is which (back & biceps, chest & triceps, legs,
  shoulders, …). Each day may have one **main lift** with a plan: bench (chest), squat (legs), overhead press
  (shoulders), a row or pull-up (back), deadlift if wanted. Accessories use double progression.
- **Starting point from logs only.** e1RM from the best recent set (Epley, as today, for 1–12 reps; with an
  effort score use an RPE-to-percentage table, e.g. 1 rep @ 8 ≈ 92%). Training max = 90% of e1RM. No recent
  set (6 weeks) → "Do a test set first" (a guided top set), never a guess.
- **Progression method (published, simple):** weekly sets × reps at a % of training max (e.g. weeks 1–3:
  4 × 5 @ 75/77.5/80%; adjust per method chosen), +2.5 kg (upper) / +5 kg (lower) to the training max after a
  successful cycle; repeat a session's weight after a miss; two misses in a row → deload 10% and build back;
  final week: test a new max. Rounded to 2.5 kg (plates). Each plan cites its method in-app.
- **On the day:** Summary shows "Today: Bench press 4 × 5 at 72.5 kg"; tapping it opens Log workout pre-filled.
  After logging, the plan adjusts.
- **Nudges ("push when ready"):** if the last session's sets were at effort ≤ 7 and all reps were hit, suggest
  +2.5 kg next time. Accessories: at the top of the rep range for all sets → suggest a small weight increase.
- **Plateau detection:** a lift with no e1RM improvement over ~4 weeks of regular training. RepFuel says so and
  gives likely factors **from the owner's data**, each with its numbers:
  - protein on training days vs target; total calories vs target with bodyweight trend (deficit);
  - missed sessions for that day; effort creeping up at the same weights;
  - recovery when available (sleep, resting HR) on the days before that lift;
  - classes the day before (e.g. Hyrox before chest day).
  - Creatine only after a multi-week lapse.
  Then one standard fix at a time: change rep range for 3–4 weeks, add a set or a supporting lift (close-grip
  bench, paused squat, …), or a deload week. Tips are phrased "may be", never "is".
- All rules live in `src/domain` with unit tests over realistic histories, including "not enough data".

## Decided by the owner

- Floating pills at the bottom; first tab is "Summary".
- Both YouTube videos and Free Exercise DB.
- Plans must be accurate and achievable, from established methods and the owner's data only.
- Coaching should push when ready and explain plateaus using intake, body and recovery data.
- Plans fit inside the split you already train.
- Health Connect for smart scales, fitness trackers and running apps; one Health screen.
- Rules engine (no AI), bundled how-to, order: redesign → how-to → Health Connect → plans.

## Calls made for the owner to check (not yet agreed explicitly)

- Meal-time windows unchanged (05–11 / 11–15 / 15–17 snack / 17–21 / late snack); labels stay
  Breakfast/Lunch/Dinner/Snack.
- Class effort uses the 1–10 session-RPE scale with a short label per level.
- Default class length 60 min; built-in class types Hyrox, Spin, HIIT, Run.
- "Back up to a file" in Settings is part of Part 1.
- Health screen placement (tab vs a Summary card) is decided with the owner in Part 3.
- YouTube videos are hand-picked and reviewed; none for an exercise rather than a poor one.

## Left to the builder

Component structure, migration details, effort label wording, animation timings, image sizes, the exact
progression tables (from a cited source), and plateau thresholds, all within the rules above and covered by
tests. Each part gets its own implementation plan in `docs/superpowers/plans/`.
