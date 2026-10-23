# RepFuel: creatine amounts

Status: owner request 2026-10-23 · small change

## Why

The owner: "we should be able to say how much we had, commonly 2.5 g, 5 g or more. A scoop can be either 2.5 g or
5 g." Some people take 10 g a day. Today the reminder only records taken / not taken.

## What changes

- **Settings › Reminders** (when the creatine reminder is on): **Daily amount** (− / +, 2.5 g steps, 2.5–25 g,
  default 5 g) and **Scoop** (2.5 g or 5 g, default 5 g).
- **Summary row:** "10 g today", or "5 of 10 g today" part way, with the streak. **Taken** logs what's left of the
  daily amount (all of it if nothing yet); once the daily amount is reached it shows **Taken ✓** and tapping it
  clears today (as now). Tapping the row's text opens **How much creatine?**: 2.5 g, 5 g and 10 g (each also
  shown in scoops), adding to today; and **Clear today**.
- **Notification Taken** logs the daily amount.
- **Streak:** any day with some creatine. Days ticked before amounts existed count, amount unknown (null).
- Storage: `reminder_done.amount_g` (migration 014), the day's total; settings in `app_settings` key `creatine`.

## Calls made without asking

Taken tops up to the daily amount rather than adding a fixed dose; part-way days still skip that day's notification.
