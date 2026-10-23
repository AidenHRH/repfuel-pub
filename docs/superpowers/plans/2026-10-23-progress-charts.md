# Progress charts implementation plan

**Spec:** docs/superpowers/specs/2026-10-23-progress-charts-design.md · Execute natively (owner: "Proceed").

1. **Stats (pure):** `src/domain/progressStats.ts` — `weekStarts(range, now)`, `overview(sets, classes, range, now)`,
   `weeklyEffort`, `weeklyTonnage`, `hardSetsPerMuscle`, `liftSeries(sets, exerciseId, metric, weeks)`,
   `sameWeightEffort(sets)`, `muscleProgress(sets, muscle, range, now)`, `effortTakeaway`. Repository
   `progressRepository.ts`: `allLiftSets(db)` (sets joined to exercise name, muscle, tracking) and
   `classEfforts(db)`. Tests: `tests/domain/progressStats.test.ts`, empty data and unknown effort included.
2. **Charts:** `src/components/charts/` LineChart (points with optional colour, y gridlines, x labels, a11y
   label), BarChart, Sparkline, MeterRow. Tests render with labels.
3. **Progress tab:** search + chips, Overview/Lifts/Records, range. `tests/app/progressCharts.test.tsx`.
4. **Lift page** `src/app/lift-progress/[id].tsx` and **muscle page** `src/app/muscle/[group].tsx`. Tests.
5. **History effort** in FeedCard and day headers. Tests. Release 0.22.0.
