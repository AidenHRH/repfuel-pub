# RepFuel: first-run tour and helpful tips

Status: draft for the owner's approval · 2026-10-22

## Why

The owner liked MyFitnessPal's first-use walkthrough: it highlights the real buttons, dims everything else, and says
what each one does and where values go. RepFuel has grown (search, scanning, How many, classes, effort, plans,
backup), and people forget features they don't use often. So: a tour the first time, short tips now and then for
things not used lately, and a way to see the tour again.

## Goals

- A **first-run tour** that spotlights real on-screen elements one at a time, with a short note, Next and Skip.
- **Occasional tips**: one spotlight tip at a time, on the screen it's about, only for features not used lately.
- **Settings**: "Show the tour again" and a "Helpful tips" switch.
- Looks like RepFuel (Apple-like, calm), works offline, respects Reduce Motion, usable with a screen reader.

## Non-goals

- No videos, no analytics, no server, no account. Nothing leaves the phone.
- No tour for every screen; Health, plans and coaching get tips later when they exist.

## Anti-goals (failure even if it works)

- Nagging: tips more than about once every few days, or the same tip twice.
- Blocking: a tour that can't be skipped, or a tip that hides the thing it describes.
- Lying about the app: a stop pointing at an element that isn't there (the stop is skipped instead).
- Changing data: the tour never logs or saves anything.

## Approaches considered (owner chose 1)

1. **RepFuel's own spotlight overlay** (chosen): elements are tagged; the overlay measures them, dims the rest with
   a rounded cut-out, and shows a note card. No new libraries, RepFuel's style, offline.
2. A tour library (e.g. react-native-copilot): quicker to start, but lags new React Native versions, generic look,
   hard to fit the "only for features not used lately" rule.
3. Intro slides with pictures: simplest, but doesn't point at the real buttons, which is the part the owner liked.

## The tour (first launch, and "Show the tour again")

Shown once, on the first open of a version that has it (existing installs included), after the app has loaded.
Each stop: dimmed screen, a rounded bright window over the target, a card with a title, one or two sentences,
"n of 8", **Next** (blue) and **Skip tour**. Tapping the highlighted area also goes next. The window glides between
stops (fades when Reduce Motion is on).

| # | Screen | Target | Card |
|---|--------|--------|------|
| 1 | Summary | Rings card | **Your day at a glance** · The outer ring is calories, the inner one protein. They fill as you log. |
| 2 | Summary | Log food pill | **Log food** · Tap here whenever you eat or drink something. |
| 3 | Log food | Meal picker | **Which meal** · RepFuel picks it from the time of day. Tap another to change it. |
| 4 | Log food | Search field and scan button | **What are you having?** · Type a food or a brand, or tap the blue button to scan a barcode. |
| 5 | Product (a banana, typical values) | How many row | **How much you had** · Tap + or type a number: 3 handfuls, 2 servings. The numbers above update. |
| 6 | Product | Log button | **Log it** · Adds it to your day. Nothing is saved until you tap this. (The tour then closes these screens.) |
| 7 | Summary | Log workout pill | **Log workout** · Weights, reps only, a timed hold, or a class like Hyrox with how hard it felt. |
| 8 | Settings tab | Tab button | **You're all set** · Show this tour again any time from Settings. |

The tour opens Log food and the product screen itself, and closes them at the end or on Skip. Nothing is logged.
If a target isn't on screen within 2 seconds, that stop is skipped.

## Helpful tips

One tip at a time, shown when its screen opens and its condition holds; "Got it" dismisses it for good.

| Tip | Screen | Shown when |
|-----|--------|-----------|
| Scan a barcode | Log food (scan button) | No barcode scanned in the last 14 days |
| How many | Product (How many row) | How many − / + or its box never used |
| Snacks & drinks tiles | Log food (top) | No snack tiles yet: "Turn on Add to Snacks & drinks when logging a snack to get a one-tap tile" |
| Classes | Log workout (Class switch) | No class ever logged |
| Effort | Log workout (effort row) | Fewer than 3 sets ever logged with an effort |
| Creatine reminder | Summary (reminder row, or Settings › Reminders) | Reminder off and not dismissed |
| Meal plan | Nutrition (Plan segment) | No plan ever made |
| Back up | Settings (Back up to a file) | No backup in 30 days and at least 30 days of use |

Rules: at most **one tip every 3 days**; none in the first 24 hours after the tour; none during the tour; each tip
at most once (Show the tour again doesn't reset tips; turning tips off and on does). "Helpful tips" switch in
Settings (on by default).

## How it's built (decided)

- `TourProvider` at the app root holds the tour/tip state and renders the overlay above everything.
- `useTourTarget(id)` on a target view registers it and reports its position (`measureInWindow`, re-measured on
  layout and scroll).
- Overlay: a full-screen layer with a dark scrim and a rounded cut-out (react-native-svg mask), a note card placed
  above or below the target, Reanimated for the glide. The card is a modal for screen readers and reads the target's
  name in its text.
- Steps and tips are data in `src/features/tour/` (copy, screen route, target id, condition); conditions are pure
  functions in `src/domain/tips.ts` over a small usage record.
- Usage record: feature-use timestamps (scan, how-many, class, effort sets, backup) and tip state (shown ids, last tip
  time, tour done, tips on) in `app_settings`, written by the screens when those things happen.
- Tests: domain tests for tip conditions and pacing; app tests for running the tour end to end, Skip, a missing
  target being skipped, a tip showing once, the Settings controls.

## Calls for the owner to check

- The 8 tour stops and their wording above.
- Tips list and conditions above; once every 3 days at most.
- The tour shows once to existing users too, on the first open of the version that adds it.

## Left to the builder

Exact card placement, animation timings, colours within the tokens, how targets are tagged, storage key names.
