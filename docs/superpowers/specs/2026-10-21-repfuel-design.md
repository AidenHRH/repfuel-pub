# RepFuel — Design

**Date:** 2026-10-21
**Status:** Approved by owner 2026-10-21
**Mockup:** https://claude.ai/artifact/K5wSgb5KXdAsuWCK9xhVCv (Today + food logging, approved look and feel)
**Base spec:** [`docs/RepFuel_PRD.md`](../../RepFuel_PRD.md) (the PRD). This design
adopts the PRD in full and records what the brainstorming conversation added,
changed or settled. Where the two conflict, this document wins.

Decisions marked **(builder's call)** were made by Claude, not by the owner,
and can be challenged.

---

## 1. Intent

RepFuel is an Android app for someone who lifts regularly and wants to
manage body fat while keeping muscle, and who mostly eats the same few
home-cooked meals, meal kits and packaged items like protein shakes.

The point of the app is **less repetitive manual logging**. Every design choice
below should be judged against: "does this make the daily log faster without
making the numbers dishonest?"

## 2. Goals

Everything in PRD §1 "MVP goals", plus:

1. **Workout templates with A/B rotation.** e.g. Push A, Pull A, Legs A,
   Push B, Pull B, Legs B. Starting a templated session is one tap,
   and the app suggests which template is next.
2. **Ad-hoc single-muscle sessions.** Some days you train one muscle
   group instead of the split. Starting an empty workout and building it from
   a muscle-group-filtered library must be quick.
3. **Saved meals (recipes).** Build a meal once from ingredients; log it by
   portion in one tap.
4. **Quick approximate meals.** Enter rough totals (e.g. a Gousto card's
   per-serving numbers) without ingredients, clearly marked approximate.
5. **Explore (phase 2).** Help the owner get **variety** and **learn new
   exercises**: an exercise guide with descriptions, muscles, form tips and a
   YouTube link; "swap for an alternative" inside a workout; and a small set
   of alternative programmes they can turn into templates.

## 3. Non-goals

- Everything in PRD §1 "Out of scope" and §10 (cloud sync, accounts, social,
  GPS running, AI coaching/chat, subscriptions).
- Embedded video playback, video hosting, or scraping video sites.
- Scraping Gousto or any recipe site.
- Fetching whole training programmes from arbitrary websites at runtime.
- iOS. Play Store distribution.
- Precision nutrition. "Approximately right" is acceptable to the owner, **as
  long as it is labelled**.

## 4. Anti-goals (would make this a failure even if it "works")

- Numbers that look precise but are guessed. The PRD's "never invent
  nutrition data" stands: approximate values are the owner's own estimates,
  labelled as such, never app-generated.
- Invented workout history, invented "last session" numbers, invented tips.
- Losing data on app update, or losing an in-progress workout.
- An app that needs the laptop or the internet to be usable at the gym or in
  the kitchen.
- Logging taking more taps than the owner's current habit tolerates — if a
  repeat meal or a repeat workout takes more than ~2 taps to start, that is a
  bug.

## 5. Constraints

- **Platform:** Android phone only. A computer must not be required for
  daily use.
- **Stack (from PRD §11, unchanged):** Expo + React Native + TypeScript, Expo
  Router, SQLite via a maintained Expo-compatible library, Expo Notifications,
  a maintained charting library. Verify versions against the chosen Expo SDK.
- **Cost:** free. No paid services, no API keys embedded in the app.
- **Repository:** on GitHub; development happens on feature branches.
- **Offline:** as PRD §11 "Offline requirements", extended to saved meals,
  templates and any Explore content already downloaded.
- **Development environment:** Claude works in a cloud container with no
  physical device. On-device verification is done by the owner; anything not
  verifiable in CI must be called out explicitly in each stage report.

## 6. Approaches considered — distribution and updates

| | Approach | Trade-off |
|---|---|---|
| **A (chosen)** | **GitHub Actions builds a signed APK; owner installs from the repo's Releases page on the phone.** | Free, no extra accounts, everything stays in the owner's repo. Each update is a manual download + install (~1 min). First install requires allowing "install unknown apps" for the browser. |
| B | Expo EAS cloud builds + EAS Update over-the-air | Smoother updates, but needs an Expo account, free tier caps builds, and adds a third party — at odds with the PRD's no-paid-cloud, no-third-party lean. |
| C (rejected) | Expo Go served from the laptop | App only runs while the laptop serves it. Unusable as a daily gym app. Still fine for quick previews during development. |

The owner picked **A**.

### Consequences of A

- A GitHub Actions workflow runs `expo prebuild` + Gradle `assembleRelease`
  and attaches the APK to a GitHub Release.
- **When a release is cut (builder's call):** on push of a version tag
  (`v*`). Feature-branch pushes run lint/typecheck/tests only. This keeps the
  Releases page to deliberate, installable versions. Version name comes from
  the tag; `versionCode` must increase monotonically (e.g. derive from the
  run number or tag).
- **Stable signing key is mandatory**, otherwise an update cannot install
  over the previous version and the owner would have to uninstall (losing
  data). **(builder's call):** generate one dedicated release keystore and
  commit it to the private repo, with its passwords in a committed config
  used only by the workflow. Reasons: Claude cannot set GitHub secrets, a
  secret cannot be read back if lost, and the repo itself becomes the
  backup, so the owner has no setup steps. Trade-off, documented in the
  README: anyone with read access to the repo could sign an update. If the
  repo is ever made public, move the key to Actions secrets first.
- **Package name fixed from day one:** `com.aidenhrh.repfuel`. Changing it
  later means a separate app and a data migration via export/import.
- **Android developer verification (risk, not a blocker today):** Google is
  rolling out a requirement that apps on certified Android devices come from
  verified developers. As of October 2026 it is enforced only in Brazil,
  Indonesia, Singapore and Thailand, with global rollout planned for 2027.
  The UK is not affected yet. When it
  arrives, the options are: register the package and key under Google's free
  hobbyist developer account; use Android's one-time "advanced flow" for
  unverified apps; or install via ADB from a computer (exempt).
  Nothing in this design needs to change now; the README gets a short
  section on it.
- **Release workflow (builder's call):** Claude develops on a feature branch
  and, at each stage checkpoint, pushes a pre-release tag
  (`v0.N.0-stageN`) from that branch so the owner can install and test on
  the phone before anything merges. Merging to `main` and tagging final
  releases is the owner's decision. About 10 release builds over the project
  fit well inside the free Actions minutes.
- The repo is private, so the owner must be signed into GitHub in the phone
  browser (or GitHub app) to download Release assets. README must say so.
- GitHub Actions minutes on a private repo are limited on the free plan
  (2,000 min/month at time of writing); an Android release build is roughly
  10–20 min, so release on tags, not every push.
- **Data safety across updates:** in addition to PRD's export, add **import**
  of the export file (builder's call), so a forced reinstall never means lost
  history.

## 7. Workouts — additions to PRD §7–8

### Templates

- **WorkoutTemplate:** id, name (e.g. "Push A"), notes, rotationPosition
  (nullable), archived, createdAt, updatedAt.
- **TemplateExercise:** id, templateId, exerciseId, sortOrder, targetSets
  (nullable), targetRepRange (nullable text such as "6–8"), notes.
- A template is a plan, not history. Starting a session copies the template's
  exercises into a new Workout; the Workout records `sourceTemplateId`.
- During a session the owner can add, remove, swap and reorder exercises.
  These edits change **today's workout only**. Updating the template is an
  explicit separate action ("Save changes to template" / "Save as new
  template").
- Any completed workout (including an ad-hoc one) can be saved as a new
  template.

### Starter exercise library (owner request)

Ship a broad, bundled library so the owner can log from day one without
creating exercises. Each entry: name, muscle group, equipment (barbell,
dumbbell, cable, machine, EZ bar, bodyweight, kettlebell, band, other),
and whether it is bodyweight. Aim for roughly 8–15 per group, covering the
common variants, for example:

- **Chest:** barbell bench press, incline barbell bench, dumbbell bench,
  incline dumbbell press, cable fly (high-to-low, low-to-high), pec deck,
  machine chest press, dips, push-ups.
- **Biceps:** barbell curl, EZ-bar curl, dumbbell curl, hammer curl,
  incline dumbbell curl, preacher curl, cable curl, concentration curl.
- Equivalent coverage for back, shoulders, triceps, legs, core and full
  body. The exact list is the builder's call; custom exercises cover gaps.

### Per-set exhaustion rating (owner request)

The owner wants to track progress, reps **and how exhausting each set
was**. Each WorkoutSet gains an optional `effort` integer, **1–10** (owner
confirmed), where 10 = could not do another rep and 7 ≈ three reps left.
Entered with one tap on a compact 1–10 picker; the label explains the
scale the first few times. Optional so logging stays fast; it feeds the
session review and "last session" display (e.g. "75 kg × 6 @ 8"), never
record calculations.

### First run

The owner has no prior logs (they track mentally) and will create their
six templates on the phone later. So: no history import, no pre-loaded
templates. The Workouts tab's empty state guides template creation
("Create your first template"), and "last session" / records simply show
nothing until real sessions exist. Export/import remains as a backup
format only.

### Rotation suggestion (builder's call on the rule)

- Templates with a non-null `rotationPosition` form an ordered cycle that the
  owner arranges (default order: Push A, Pull A, Legs A, Push B, Pull B,
  Legs B).
- **Suggested next** = the template after the one used by the most recent
  *completed* workout that came from a rotation template. Ad-hoc and
  non-rotation sessions do not advance the rotation. If there is no history,
  suggest position 1.
- Start Workout shows: the suggested template prominently, the other
  templates, and "Empty workout". Choosing a different template is always
  allowed and simply moves the rotation on from whatever was actually done.

### Ad-hoc sessions

- "Empty workout" → add exercises from the library filtered by muscle group
  and equipment, with recently used exercises for that group listed first.

### Pre-filling sets (builder's call)

- When an exercise is added (from a template or manually), show the most recent
  comparable session (PRD §7). Offer a one-tap "repeat last session" for that
  exercise's sets that pre-fills weight and reps as **uncompleted** sets, so
  the owner ticks or edits each one. Nothing is marked completed
  automatically, and nothing is pre-filled if there is no history.

### Running

PRD keeps GPS running out of scope. Not added.

## 8. Nutrition — additions to PRD §4–5

### Saved meals (recipes)

- **Recipe:** id, name, portionsMade (number), notes, isFavourite,
  createdAt, updatedAt.
- **RecipeIngredient:** id, recipeId, foodProductId, amount, unit (g, ml or
  servings).
- Ingredients come from My Foods (scanned, manual, or approximate).
- Recipe nutrition per portion = sum of ingredient nutrients ÷ portionsMade,
  using the PRD's per-serving / per-100 formulas for each ingredient.
- If any ingredient has an unknown nutrient, the recipe's value for that
  nutrient is **incomplete** and is shown as such (PRD's unknown-is-not-zero
  rule).
- Logging: ½, 1, 1½, 2 portions or custom. The FoodLogEntry stores a nutrient
  **snapshot** at log time and an optional `recipeId`. Editing the recipe or
  its ingredients never changes past entries (same rule as products).
- Deleting a recipe does not delete history.

### Batch recipes inside meals (owner request, 2026-10-21)

The owner makes batches (e.g. a pico salad) and eats part of one with a meal
("Beef & sweet potato" = sweet potato + lean beef mince + some pico).

- A recipe ingredient is **either** a food (amount in g/ml/servings) **or**
  another recipe (amount in **portions** of it). Exactly one of the two.
- A batch recipe's `portionsMade` is the owner's estimate of how many shares
  the bowl gives ("this bowl is about 4 portions"). A meal takes a share by
  portions (1, ½, ¼…). **No weighing** — owner chose "share of the bowl,
  keep it simple".
- Nutrition flows through: sub-recipe per-portion nutrients × portions used.
  Unknown values propagate as incomplete; approximate ingredients make the
  meal approximate.
- A recipe can't contain itself, directly or indirectly (rejected on save).
- Editing the pico later never changes already-logged dinners (snapshots).
- Requires migration 002: `recipe_ingredient.food_product_id` becomes
  nullable, add `sub_recipe_id` (FK recipe) with a CHECK that exactly one is
  set, and allow unit `portion`.

### Quick approximate meals

- Created from "Log Food → Quick meal": name, calories, protein, optional
  carbs/fat/fibre, per serving. Saved to My Foods so it can be logged again
  in one tap.
- Stored as a FoodProduct with per-serving basis and
  `dataSource = 'user_approximate'`.
- Gousto (MVP): owner types the per-serving numbers from the recipe card/app.
  No integration. Phase 2 adds card scanning (§8a).

### Two different "not exact" signals (must stay distinct)

- **Incomplete** — a nutrient value is *unknown* for some entry. The total
  understates reality by an unknown amount.
- **Approximate** — every value is known, but some came from an owner
  estimate (`user_approximate`). The total is a reasonable estimate.
- FoodLogEntry snapshots carry `isApproximate`. Daily totals show an
  "approx" marker if any contributing entry is approximate, and an
  "incomplete" marker if any contributing nutrient is unknown. Both can show
  at once.

### "Track once, reuse forever" — the core nutrition principle

The owner's words: meal tracking must be as quick and effortless as
possible. Save a meal once (e.g. overnight oats), then just tap to log it
again with no ingredient re-entry. This overrides the PRD's confirm-before-
logging step **for already-saved meals and foods** (the confirm step stays
for first-time scans and new entries):

- **One tap logs.** The Today dashboard shows a "My meals" row of saved
  meals and foods (favourites first, then most-logged). Tapping one logs
  1 portion immediately, at the current time, and shows a snackbar with
  **Undo** and **Adjust** (portion, time, meal category). No confirm screen.
- **Long-press** opens the portion picker (½, 1, 1½, 2, custom) for the
  times it isn't one portion.
- **Meal category** (breakfast/lunch/dinner/snack) is set automatically
  from the time of day (builder's call on boundaries); editable via Adjust.
- **Save from anywhere:** any logged entry, including a one-off, offers
  "Save as meal" so the next log is one tap.
- **No ingredient re-entry, ever.** Recipes are built once; after that the
  owner only picks portions.

### Log Food screen ordering (builder's call)

Recent (last 14 days, most-logged first) → Favourites → search across My
Foods and Recipes → actions: Scan, Quick meal, Manual food, New recipe.
"Log Shake" on the Today dashboard is a shortcut to the owner's favourite
shake product; if none is marked, it opens Log Food filtered to favourites.

## 8a. Scan a meal card (Gousto) — phase 2

Requested by the owner: Gousto recipe cards print per-serving nutrition and
an ingredients list, so photographing the card should fill in a quick meal.

- **Flow:** Log Food → "Scan meal card" → take a photo (or pick a screenshot
  of the Gousto app from the gallery) → on-device text recognition → review
  screen → save to My Foods as a per-serving meal → log portions as usual.
- **Text recognition (builder's call):** on-device OCR with Google ML Kit text
  recognition through a maintained React Native wrapper that works with Expo
  native builds. It's free, needs no key, works offline, and the photo never
  leaves the phone. Verify library maintenance and Expo SDK compatibility
  before adopting. If no suitable library exists, say so and keep manual
  quick-meal entry as the fallback.
- **Parsing:** deterministic rules (no LLM) that look for the recipe name,
  energy (kcal — not kJ), protein, carbohydrate, fat, fibre and the
  per-serving column, plus the ingredients list as plain text.
- **Review is mandatory:** every parsed value is shown editable next to the
  photo. Anything the parser could not read confidently stays **blank
  (unknown)**, never zero and never guessed. Nothing is saved without the
  owner confirming.
- **Storage:** `dataSource = 'card_scan'`, per-serving basis, ingredients
  stored as text on the product (not linked FoodProducts — the card does not
  give per-ingredient nutrition). The photo is not kept unless the owner
  opts in (builder's call, keeps storage small).
- **Accuracy label:** values are as printed on the card, so they count as
  known (not "approx") once confirmed; the source shows as "From meal card".
- **Tests:** parser unit tests against transcribed sample card text,
  including kJ/kcal confusion, per-100 g vs per-serving columns, and missing
  fields.

## 9. Protein reminders — scheduling approach (builder's call)

The PRD requires deterministic eligibility from logged intake, and warns
that Android restricts background timing. Design:

- Logged protein can only change when the owner uses the app. So **whenever
  the app foregrounds, a food entry changes, or reminder settings change**,
  the app cancels today's pending reminders and schedules the remainder of
  today's reminders as local notifications with content computed **now**.
- Expected progress at time *t* = target × (t − windowStart) / (windowEnd −
  windowStart), clamped to [0, target]. A reminder is scheduled at *t* only
  if current logged protein is behind expected-at-*t* by more than a
  threshold (default 15% of target; editable), *t* is outside quiet hours,
  and *t* is at least the minimum interval after the previous scheduled or
  delivered reminder.
- Message text uses the logged total at scheduling time, which is still
  correct at delivery because nothing can change it without reopening the
  app (which reschedules).
- If logged protein ≥ target, cancel all of today's reminders.
- Tomorrow's first reminder is scheduled from the target alone (0 g logged).
- Use inexact scheduling; do not request exact-alarm permission. UI states
  that timing may drift by a few minutes.
- This logic is a pure function `planReminders(settings, loggedProtein, now,
  deliveredToday) → times[]`, which makes it easy to unit-test.

## 10. Explore — phase 2

Built after the MVP core passes its acceptance tests (PRD §13–14).

### Purpose

Variety and learning new exercises, not periodised programming.

### Content source

- **Exercise guide content:** the wger public API (wger.de), which is
  open-source and needs no key for read access. Pull exercise names,
  descriptions, primary/secondary muscles, equipment and images where
  available. **Before building, verify** the current API shape, rate/usage
  guidance and content licence (believed to be CC-BY-SA), and show
  attribution in-app as the licence requires.
- Cache fetched content in SQLite. Offline shows cached content; uncached
  items show a clear "not downloaded yet" state. Never fabricate tips or
  descriptions.
- **Mapping:** the bundled starter library (PRD §7) stays the source of truth
  for logging. Explore content links to it by an optional `wgerExerciseId`.
  Logging never depends on wger being reachable.
- **Videos:** a "Watch on YouTube" button opening
  `https://www.youtube.com/results?search_query=<exercise name> form` via
  the system intent (opens the YouTube app if installed). No embedding, no
  API key.

### Features

1. **Exercise browser:** filter by muscle group and equipment. "New to you"
   badge on exercises with no logged sets.
2. **Swap suggestions in a workout:** tap an exercise → alternatives sharing
   the same primary muscle group (and, where known, similar movement),
   ranked to favour exercises the owner hasn't done recently. Swap applies
   to today only, with an option to update the template.
3. **Programme ideas:** a small bundled set (builder's call: Upper/Lower,
   Arnold split, Full Body 3×, Bro split, PPL variant) authored in the app
   as static data, each with a two-line "who it suits" note. "Use this
   programme" creates templates and optionally a new rotation (existing
   templates are archived, not deleted).

## 10a. Look and feel (owner request)

The owner's brief: a premium, Apple-inspired look and feel — minimal,
uncluttered, calm and effortless. "Apple Health meets a thoughtfully
designed personal fitness assistant." Polished and intentional, not a
generic template. Clean typography, generous spacing, a restrained
palette, simple progress indicators, quick actions for adding food. The
home screen is the priority; food logging must be frictionless;
transitions smooth but fast. **One cohesive product, not separately
styled screens.**

What that means for the build:

- **Design system first.** A single token set (colour, type scale,
  spacing, radii, elevation, motion durations) and a small library of
  shared components (screen scaffold with large title, grouped inset
  card/list, list row, primary/secondary buttons, progress ring, bar,
  bottom sheet, number stepper, snackbar, empty state). Screens compose
  these; screens do not define their own colours, font sizes or spacing.
  This is what keeps it one product.
- **Restrained palette:** neutral greys plus **one** accent colour, with
  semantic colours used sparingly (protein, calories, success, warning).
  Dark theme default (PRD), light theme available; both must meet
  accessible contrast.
- **Typography:** one typeface with a clear scale (large title, title,
  headline, body, caption, and tabular numerals for figures). SF Pro is
  licensed for Apple platforms only, so use a free, similar typeface such
  as Inter (builder's call).
- **Progress indicators:** simple rings or bars for calories and protein
  on Today, and nothing busier than that.
- **Home screen (Today) is the hero:** calorie and protein progress at the
  top, the "My meals" one-tap row, then today's entries, workout status
  and latest weight. Generous spacing; nothing that isn't used daily.
- **Logging in sheets:** adding food happens in bottom sheets over the
  current screen rather than navigating away, so logging feels quick and
  you never lose your place.
- **Motion:** short, consistent transitions (≈150–250 ms), native-feeling
  sheets and press feedback, light haptics on log/undo. Never block input
  on animation.
- **Polish bar:** every screen has designed empty, loading and error states
  in the same visual language (PRD §14), not placeholder text.

## 11. Navigation

PRD's five tabs stand: Today, Nutrition, Workouts, Progress, Settings.
**(builder's call):** Explore lives inside the Workouts tab (a segmented
control or a top-level entry on the Workouts screen) rather than a sixth
tab, to keep the bottom bar uncluttered as the PRD asks.

## 12. Data model additions (summary)

On top of PRD §12:

- `WorkoutTemplate`, `TemplateExercise` (§7)
- `Workout.sourceTemplateId` (nullable)
- `Recipe`, `RecipeIngredient` (§8)
- `FoodLogEntry.recipeId` (nullable), `FoodLogEntry.isApproximate`
- `FoodProduct.dataSource` gains `user_approximate`
- `FoodProduct.isFavourite`
- `Exercise.wgerExerciseId` (nullable, phase 2)
- `ExploreCache` table(s) for wger content (phase 2)
- `AppSettings` gains reminder threshold and rotation order

All schema changes go through numbered migrations.

## 13. Phasing

1. **MVP core:** PRD implementation order §15 steps 1–14, with templates and
   rotation folded into step 8 (workouts), and recipes plus quick meals
   folded into step 5 (manual entry and saved foods).
2. **Distribution:** GitHub Actions CI (typecheck, lint, tests) on every
   push; tagged release workflow producing a signed APK. This lands early,
   right after scaffolding, so the owner can install and try each stage on
   the phone.
3. **Phase 2:** Explore (§10) and meal-card scanning (§8a).

Each stage ends at a review checkpoint with a report: files changed, what
works, tests run, what could not be verified on a device.

## 14. Acceptance additions

On top of PRD §13:

- Tapping a saved meal on Today logs 1 portion with no further screens;
  Undo removes it; totals update immediately.
- Starting from a template copies its exercises; editing the session does not
  alter the template.
- Rotation suggestion: correct next template after A/B sequences, ad-hoc
  sessions don't advance it, no history → first template.
- Recipe per-portion maths, including incomplete ingredients.
- Editing a recipe does not change past entries.
- Approximate entries mark daily totals "approx"; unknown values mark them
  "incomplete"; both can appear together.
- `planReminders` unit tests: behind/ahead of pace, quiet hours, min
  interval, target reached, settings change.
- Installing release N+1 over release N keeps all data (manual check on the
  owner's phone).
- Export → wipe → import restores all data.
- Phase 2: Explore works offline for cached items and degrades cleanly for
  uncached items; wger attribution is visible.

## 15. Left to the builder

- Exact library choices and versions (within PRD §11's constraints, verified
  against the Expo SDK at build time).
- Visual design within the PRD's guidance (dark, understated, large targets).
- Starter exercise list contents and the bundled programme definitions.
- Internal structure beyond PRD §11's suggested layout.
- Precise CI workflow layout and versionCode scheme.

## 16. Owner requests, 2026-10-22 (Stage 4)

- **Meal sections on Today.** Today's food is grouped Breakfast → Lunch → Dinner → Snacks, each with a kcal / protein subtotal; empty sections hidden. Category still comes from time of day and is editable per entry.
- **Quick meal → saved meal.** The Quick meal form has "Save to My meals" (on by default). When on, RepFuel saves the quick food plus a one-portion starred meal (recipe) wrapping it, so it appears under Nutrition → Meals and in My meals. Any logged entry also offers "Save as a meal", which stars its source (the food or meal).
- **Quick "Log a lift".** One exercise, one or more sets (weight kg, optional for bodyweight; reps; effort 1–10 optional), defaulting to now. Saved as a real workout (workout → workout_exercise → workout_set) so later full-session logging builds on the same history. "Last session" shown when the exercise is picked; "Add set" copies the previous set.
- **Starter exercise library** seeded by migration (≈8–15 per group: chest, back, shoulders, biceps, triceps, legs, core, full body), plus custom exercises.
- **Personal records** are computed from history on demand (never maintained by hand): heaviest weight; most reps at a given weight; estimated 1RM (Epley, only from sets of 1–12 reps, always labelled "estimate"); most reps for bodyweight exercises. A new lift is announced as a PR only when it strictly beats every earlier set (ties and a first-ever log are not PRs). Editing or deleting a lift changes the records automatically.
- **Motivation card on Today.** A short line that changes daily from a bundled list of original lines (no attributions, so nothing is misquoted). Hideable in Settings.
- **Future: WHOOP.** WHOOP's API uses OAuth with a client secret, which needs a small server to exchange tokens; that conflicts with "no cloud" and is out of scope until the owner decides on a backend.
