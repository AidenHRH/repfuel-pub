# RepFuel: exercise how-to

Status: draft for the owner's approval · 2026-10-23

## Why

The owner wants to open an exercise and see how to do it: photos to judge their own form against, and a video to
see how it looks. RepFuel is personal for now (no commercial use), so free content is fine to use.

## Approach (owner chose)

Steps and photos for every exercise from Free Exercise DB, plus a video player the owner fills: they pick a video
(from a gym, coach or any channel they trust), paste its link once, and it plays inside RepFuel on that exercise from then on.

Considered and not chosen: RepFuel picking the videos (can't be checked from the build environment, so some could be
wrong or gone); a YouTube search button only (not embedded).

## What changes

- **How to** button next to the exercise's name in Log workout, and on each exercise's card in Progress. It opens a
  **How to** screen:
  - Two photos side by side (start and end position), tap to see one full screen.
  - Numbered steps, and the muscles it works.
  - **Video**: once a link is saved, an embedded YouTube player (plays in the app). Before that: **Find a video**
    (opens a YouTube search for "how to <exercise>") and **Add a video** (paste a YouTube link; checked to be a
    YouTube video). Change or remove it any time.
- **Where the content comes from**: Free Exercise DB (876 exercises, Unlicense). RepFuel's 89 built-in exercises are
  matched to its entries by hand (only 26 share an exact name); the steps for those are built into the app (works
  offline). Photos load from the Free Exercise DB site the first time and are kept on the phone (no large download
  up front). An exercise with no good match, or one the owner added, shows "No guide for this one yet" with Find a
  video and Add a video.
- **Credit**: "Steps and photos: Free Exercise DB" under the photos.
- **Storage**: the matched steps as a data file in `src/data/`; the owner's video links in a new
  `exercise.video_url` column (migration 016).
- **New library**: `react-native-webview` (an Expo-supported module) for the embedded player; it needs the next APK
  build, which the release does anyway.

## About the photos

Free Exercise DB's photos are clear start and end shots of a person doing each exercise, good for checking form.
The project doesn't say who took them, and they aren't from a certification body (NASM, ACE). Fine for personal use;
revisit before RepFuel goes to gyms.

## Calls made without asking

- The video is per exercise, not per set or workout.
- Matching is by hand, not by fuzzy name search, so an exercise never shows the wrong guide.

## Left to the builder

Screen layout within the tokens, the matching table, link checking, tests.
