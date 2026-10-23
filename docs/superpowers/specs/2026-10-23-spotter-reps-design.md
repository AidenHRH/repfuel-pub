# RepFuel: spotter-helped reps

Status: agreed with the owner 2026-10-23 · small change

## Why

A spotter often helps with the last rep or two of a heavy set. The owner: they're still reps, and it can still be a
PR, "just a spotter PR, not a sole PR".

## What changes

- **Each rep set** (not timed sets) gets a **Spotter helped** switch. On, it asks **Last how many reps?** (1 to the
  set's reps, starting at 1) and sets the effort to 10 (it can be changed back).
- **Shown as** "100 kg × 6 (last 2 helped) @ 10"; a lift with any helped set lists each set rather than "× 8, 8, 7".
- **Solo records** (heaviest, most reps at a weight, estimated 1RM, most reps) count only the reps done alone
  (6 − 2 = 4); a set with no solo reps never sets one.
- **Spotter PR**: a helped set whose estimate with every rep counted beats the best estimate of every earlier set
  (solo or spotted). Its own badge line: "Spotter PR: 100 kg × 6 (last 2 helped)". Progress shows "Spotted best".
- Helped reps count in the set's reps (the work was done).
- Storage: `workout_set.assisted_reps` (migration 015), NULL when none.
