# RepFuel — Product Requirements Document

**Version:** 1.0  
**Platform:** Android  
**Tagline:** Your Personal Performance Assistant  
**Initial approach:** Single-user, local-first app  
**Built with:** Claude Code

## 1. Product vision

RepFuel makes it easy to track nutrition and training without repetitive manual work. The first release is for personal use on Android. It must store data locally, work offline for saved foods and workouts, and avoid paid cloud infrastructure.

### MVP goals
- Scan food barcodes and save product nutrition details.
- Log servings and automatically calculate calories, protein, carbohydrates and fat.
- Show daily totals against configurable targets.
- Send configurable protein reminders based on actual logged intake.
- Record gym workouts, exercises, sets, reps and weights.
- Detect personal records.
- Record body weight and show basic trends.

### Out of scope for MVP
Cloud sync, public accounts, subscriptions, GPS running, social features and AI coaching. Keep the architecture extensible for later additions.

## 2. Initial profile

Each person enters their own details in the welcome setup on first open (age, height, weight, optional body fat,
goal), and RepFuel suggests realistic starting targets from them
(`docs/superpowers/specs/2026-10-23-welcome-setup-design.md`). Everything stays editable.

Never automatically change the user's targets. Label body-fat readings as estimates when appropriate.

## 3. Navigation and design

Use five bottom-navigation sections:
1. Today
2. Nutrition
3. Workouts
4. Progress
5. Settings

Use a clean, understated fitness aesthetic, dark theme by default, clear progress indicators, accessible contrast and large touch targets. Avoid clutter.

### Today dashboard
Show calories and protein consumed, target and remaining; carbohydrate and fat totals; today's food entries; workout status; latest weight; and quick actions for Scan Barcode, Log Food, Log Shake, Start Workout and Record Weight.

Dashboard totals must come from persisted data, never hard-coded mock values.

## 4. Barcode scanning and saved foods (P0)

### Scan flow
1. User taps Scan Barcode.
2. Request camera permission when needed and explain why.
3. Scan common retail formats such as EAN-13 and UPC.
4. Look up the barcode through a provider service, initially Open Food Facts.
5. Show the matched product and available nutrition data.
6. Let the user confirm, correct or complete the values.
7. Save the product to My Foods.
8. Ask how much they are consuming and show calculated values before confirming.

Put external lookup behind a service interface. Cache successful results locally. Handle no network, timeouts, missing results and API errors gracefully. During implementation, verify the provider's current API terms, attribution and usage guidance.

### Product fields
Store product name, brand, barcode, serving size and unit, nutrition per 100 g or 100 ml where available, optional fibre, data source and last-verified timestamp. Unknown nutrient values must remain unknown—not be silently treated as zero. Never invent nutrition values for an unknown barcode.

If a product cannot be found or the data is incomplete, allow manual entry and clearly identify user-supplied values.

### Serving calculations
Offer half a serving, one serving, one and a half servings, two servings and a custom amount.

For per-serving data:

`logged nutrient = nutrient per serving × number of servings`

For per-100-g or per-100-ml data:

`logged nutrient = nutrient per 100 g/ml × logged amount ÷ 100`

Example only: if a product has 24 g protein per 30 g serving, logging 45 g gives 36 g protein. Use actual product data in the app.

Use adequate internal precision and round only for display. Recalculate daily totals from stored entry values rather than adding rounded display values.

### My Foods
Users can search, favourite, edit and delete saved products, and quickly log recent foods. Deleting a product must not delete historical logs. Each food log must preserve a snapshot of its nutrition values so later product edits do not rewrite history.

### Manual entry
Allow name, serving amount/unit, calories, protein, carbohydrates, fat, optional fibre and notes. Allow saving manual foods for reuse.

## 5. Daily nutrition (P0)

Calculate totals for the selected local calendar day. Show calories and protein consumed, target and remaining, plus carbohydrate and fat totals. Editing or deleting a food entry must update totals immediately. New days must not delete history. Handle timezone and daylight-saving changes safely.

If any nutrient value is unknown, do not silently count it as zero. Indicate when a total is incomplete. Keep historical food entries when targets change.

## 6. Protein reminders (P0)

Use local Android notifications. Allow reminders to be enabled or disabled, set start/end times, quiet hours, minimum interval and protein target.

Use deterministic rules, not an LLM, for totals and reminder eligibility. A reminder may be sent when logged protein is meaningfully behind expected progress for that time of day.

Example wording: “You've logged 65 g of protein today. Your target is 145 g, leaving 80 g to go. Consider including a protein-rich meal or shake.” This is illustrative; messages must use actual logged data.

Respect quiet hours and permissions, avoid duplicate notifications, stop reminders after the target is reached, and explain when notifications are unavailable. Do not promise exact background timing where Android restricts it.

## 7. Workout tracking (P0)

Provide a starter exercise library for chest, back, shoulders, biceps, triceps, legs, core, full body and other. Allow custom exercises.

A workout contains date/time, exercises, sets, reps, weights in kg and optional notes. Support bodyweight exercises where weight is not applicable. Let users add, edit, reorder and delete exercises and sets. Protect in-progress workouts from accidental loss.

When an exercise is added, show the most recent comparable session if available—for example, “Last session: 75 kg × 6 reps.” Never show invented history.

Users must be able to save, reopen, edit and review previous workouts.

## 8. Personal records (P0)

Track:
- Heaviest recorded weight for an exercise.
- Highest reps at a specified weight.
- Estimated one-repetition maximum when suitable data exists.

Support suitable records for time-based or bodyweight exercises where implemented. Label estimated one-repetition maximum as an estimate, never as a tested maximum.

Recalculate records from workout history after relevant edits. Show record type, value, unit, date and source workout. Do not announce unsupported or duplicate records.

## 9. Body-weight tracking (P1)

Allow manual entries for weight, date/time, optional body-fat percentage, source and notes. Show 7-day, 30-day, 90-day and all-time ranges. Only show rolling averages when enough measurements exist. Do not interpret daily fluctuations as direct fat gain or loss. Label consumer smart-scale body-fat readings as estimates.

## 10. Future features—not MVP

Later additions may include running distance/duration/pace, supported integrations such as Strava, natural-language food logging, meal suggestions, an AI assistant and cloud synchronisation.

An AI assistant must retrieve actual records through application services. Nutrition arithmetic and personal records must remain deterministic application logic. Never embed an LLM API key in the mobile app. Natural-language food logging must ask for clarification when food or serving size is ambiguous.

## 11. Technical architecture

Use:
- React Native with Expo and TypeScript.
- Expo Router.
- SQLite local persistence with a maintained Expo-compatible library.
- Repository/service layer separating UI, domain logic and storage.
- Android-compatible barcode scanning.
- Open Food Facts behind a provider interface.
- Expo Notifications or a maintained compatible alternative.
- A maintained charting library for progress views.
- Git and automated tests.

Verify package compatibility with the selected Expo SDK before installing dependencies; avoid deprecated or incompatible packages.

### Offline requirements
These must work offline: dashboard, saved foods, manual logging, nutrition calculations, workout logging/history, personal records and weight logging. Barcode lookup requires internet, but a lookup failure must preserve the barcode and offer retry/manual entry.

### Suggested project structure
- `app/` — routes and screens
- `components/` — reusable UI
- `features/nutrition/`
- `features/workouts/`
- `features/progress/`
- `services/` — barcode lookup and notifications
- `database/` — schema, migrations and repositories
- `domain/` — types and calculations
- `tests/` — automated tests

Use stable IDs, constraints, migrations and transactions where needed. Store timestamps consistently and use the device's local calendar day for daily nutrition.

### Privacy
Keep fitness data local in MVP. Do not send nutrition/workout data to third parties without user action. Do not log sensitive records unnecessarily. Never hard-code private API keys. Request permissions only when needed. Provide export and delete-data options.

## 12. Data model

Implement and refine these entities:

- **UserProfile:** id, age, heightCm, currentWeightKg, bodyFatPercentage, primaryGoal, createdAt, updatedAt.
- **NutritionTargets:** id, caloriesKcal, proteinGrams, carbohydratesGrams, fatGrams, effectiveFrom, updatedAt.
- **FoodProduct:** id, name, brand, barcode, servingSize, servingUnit, nutrition fields per 100 g/ml where available, optional fibre, dataSource, lastVerifiedAt, createdAt, updatedAt. Include a basis/unit field to prevent confusing per-serving and per-100-g/ml data.
- **FoodLogEntry:** id, optional foodProductId, foodNameSnapshot, servingAmount, servingUnit, nutrient snapshots, loggedAt, mealCategory, notes.
- **Exercise:** id, name, muscleGroup, equipment, isCustom, createdAt.
- **Workout:** id, name, startedAt, completedAt, notes.
- **WorkoutExercise:** id, workoutId, exerciseId, sortOrder, notes.
- **WorkoutSet:** id, workoutExerciseId, setNumber, weightKg, repetitions, isCompleted, notes.
- **PersonalRecord:** id, exerciseId, recordType, value, unit, achievedAt, sourceWorkoutId.
- **BodyMeasurement:** id, measuredAt, weightKg, bodyFatPercentage, source, notes.
- **AppSettings:** theme, units, reminder preferences, quiet hours and other user preferences.

Nutrition fields must support unknown values. Personal records should be recalculable from workout history, not just maintained as manual counters.

## 13. Testing and acceptance criteria

Write automated tests for calculations, storage and record logic.

### Nutrition
- One serving logs expected values.
- Two servings doubles values.
- Half and one-and-a-half servings calculate correctly.
- Custom gram and millilitre amounts calculate correctly.
- Unknown values remain unknown.
- Editing/deleting an entry updates totals.
- Editing a product does not change historical snapshots.
- Data persists after restart.
- Local-day boundaries and daylight-saving transitions are handled safely.

### Barcode
- Successful lookup.
- Unknown barcode.
- Incomplete database result.
- Manual product creation.
- Cached lookup while offline.
- API failure still permits manual logging.

### Workouts and records
- Create, save, reopen, edit and delete workouts.
- Multiple exercises and sets persist.
- Previous performance is correct.
- Records recalculate after workout edits.
- Estimates are labelled.
- No duplicate or unsupported personal-best alerts.

### Notifications
- Enable/disable, quiet hours, target reached, interval enforcement, missing permission and rescheduling after settings changes.

### End-to-end test
1. Scan a protein product.
2. Confirm or enter actual nutrition.
3. Save product and log one serving.
4. Verify daily totals.
5. Restart app and verify persistence.
6. Log a second serving and verify totals.
7. Create and save a workout with multiple sets.
8. Reopen it and verify data.
9. Verify previous performance and personal-record logic.

The app is not complete if only the UI works.

## 14. Definition of done

MVP is complete when:
- It installs and runs on a physical Android phone.
- Main navigation works.
- Nutrition and workout data persist locally.
- Barcode lookup works for products in the selected database.
- Unknown products can be added manually.
- Serving calculations pass automated tests.
- Food entries can be edited and deleted.
- Reminders respect preferences and permissions.
- Workouts and records work end to end.
- Empty, loading, permission-denied and error states exist.
- No fake totals are presented as real user data.
- README explains prerequisites, install/run commands, tests and Android build instructions.

## 15. Instructions for Claude Code

Work in small, verifiable stages. Do not generate the entire app in one unreviewed pass.

### Start by
1. Inspecting the repository and reporting its current state.
2. Proposing a short architecture and implementation plan.
3. Identifying only uncertainties that genuinely block progress.
4. If the repository is empty, scaffolding the app with the selected stack.

Do not ask the user to decide things that can safely use sensible defaults.

### Implementation order
1. Scaffold Expo/React Native TypeScript app and navigation.
2. Set up SQLite, schema, migrations and repositories.
3. Implement nutrition calculation functions and tests.
4. Implement dashboard from real local data.
5. Implement manual food entry and saved foods.
6. Implement barcode scanning and food-provider service.
7. Implement reminder settings and notifications.
8. Implement exercise library and workout logging.
9. Implement personal-record calculations and tests.
10. Add weight tracking if it fits the MVP.
11. Add empty/loading/error/permission-denied states.
12. Run type checks, linting if configured, and tests.
13. Test on Android and document anything that could not be verified.
14. Write a README with setup, run, test and Android build instructions.

### Engineering rules
- Do not leave core features as TODOs or non-functional buttons.
- Do not claim a feature works unless implemented and tested.
- Keep business logic out of UI components.
- Never invent nutrition data.
- Never expose API secrets.
- Add tests for calculations and persistence.
- If a dependency/API is unavailable, explain the limitation and implement a sensible fallback.
- At each stage, report files changed, functionality completed, tests run and remaining issues.
- Stop at natural review checkpoints; avoid broad destructive changes.
- Do not implement AI chat, cloud sync, subscriptions or GPS tracking in MVP unless explicitly requested.

**Begin by inspecting the repository and presenting a short plan. Then implement Phase 1 and verify that the app starts before proceeding.**
