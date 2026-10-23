# Progress charts — design

Status: approved (2026-10-23, from the mockup: https://claude.ai/artifact/UrBJ76xxAZEhbMiM25XbXf).

## Why

"When I check my previous workouts, I want to be able to see the effort level I put on them … a graph of effort to
see how I'm progressing … graphs and charts", "a description on what each chart means but very concise", and
"search … say I want to see my chest progress over time: the workouts I've done, my current PRs".

Effort (1–10) is already saved on every set and class, but nothing shows it after logging except a class's strip.
Progress only lists record tiles.

## What gets built

1. **Progress tab** with Overview · Lifts · Records and a search ("Search a lift or muscle", with muscle chips).
   - Overview, for 4 weeks / 12 weeks / 1 year: Workouts, Weight lifted, Average effort, New PRs (each against the
     period before where it makes sense); **Effort** line (weekly average) with a one-line takeaway; **Weight
     lifted** bars (tonnes a week); **Sets per muscle**; **Your lifts** with a sparkline each.
   - Lifts: every lift you've logged with its trend. Records: today's record cards.
   - Every chart has one short line saying what it shows.
2. **A lift's page** (tap a lift): estimated 1-rep max line with each session's dot coloured by effort
   (switch: 1RM / Heaviest / Volume / Effort); **Same weight, getting easier** (effort on your most repeated
   weight × reps); records; sessions with an effort chip per set.
3. **A muscle's page** (chip or search): hard sets a week, average effort, PRs in the period; **strength** (the
   muscle's lifts' 1RM estimates against where each started, averaged, as %); **sets and effort** per week; current
   PRs per lift; its lifts with trends; its workouts (day, lifts, effort, PRs).
4. **Workouts history**: each lift shows its sets' effort as coloured bars ("effort 7 → 9"); each day shows the
   session's average effort; a lift whose sets were all 6 or under says "felt easy: try a bit more next time".

## Rules (builder's calls, marked)

- Weeks start on Monday, in local time. Weight lifted = weight × all reps of weighted sets (helped reps count: the
  weight moved). A week with no lifting is 0 t; a week with no effort recorded has no point (unknown, not 0).
- Hard sets = sets with effort 7+, or no effort recorded (a logged working set). (call)
- New PRs = lifts in the period that set any record, replayed in order with the existing record rules.
- Same weight = the weight × reps done in the most sessions (3+ sessions needed), effort averaged per session.
- Muscle strength = for each lift with 2+ sessions, its best 1RM estimate per week ÷ its first in the period; the
  muscle's line is their average, in %. (call)
- Charts are drawn with react-native-svg (already in the app); no new library.
- Takeaway lines are plain rules (e.g. effort fell by 0.5+ while weight lifted rose), never invented.

## Approaches

1. **Draw the charts ourselves with react-native-svg (chosen).** Already installed, matches the tokens exactly,
   small, testable; costs writing three chart components.
2. A chart library (Victory Native needs Skia, a big new native module; gifted-charts adds a dependency). More
   chart types for free, but heavier and harder to make match the design.
