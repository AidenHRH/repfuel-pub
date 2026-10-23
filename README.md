# RepFuel

Your personal performance assistant: a calm, offline-first Android app for tracking nutrition and training. Built for one person, with all data stored on the phone.

- **Spec:** [`docs/RepFuel_PRD.md`](docs/RepFuel_PRD.md) and [`docs/superpowers/specs/2026-10-21-repfuel-design.md`](docs/superpowers/specs/2026-10-21-repfuel-design.md) (the design wins where they differ)
- **Approved look:** [interactive mockup](https://claude.ai/artifact/K5wSgb5KXdAsuWCK9xhVCv)

## What's in this version (Stage 1: foundation)

- The five tabs (Today, Nutrition, Workouts, Progress, Settings), built in the approved design: dark by default, Inter type, calm cards.
- An on-phone SQLite database that's set up automatically on first launch, and a welcome setup on first open: your age, height, weight and goal, and realistic suggested calorie and protein targets.
- Settings shows your saved targets and lets you switch Dark/Light (remembered between launches).
- Tested nutrition maths (servings, per-100 g/ml, unknown values stay unknown, local-day boundaries across clock changes), ready for food logging in Stage 2.

Food logging, barcode scanning, reminders and workouts arrive in the next stages. Screens for them show an honest "coming next" state, not fake numbers.

## Install on your phone

1. On your phone, sign in to GitHub in the browser (the repo is private, so downloads need you signed in).
2. Open **https://github.com/AidenHRH/repfuel-pub/releases** and tap the newest release (test builds are marked *Pre-release*).
3. Under **Assets**, download `RepFuel-<version>.apk`.
4. Open the downloaded file. The first time, Android asks you to allow your browser to install apps: allow it, go back, and tap **Install**.

**Updates** install over the top and keep your data. Download the newer APK and install it the same way: Android offers **Update**. Don't uninstall first: uninstalling deletes everything RepFuel has stored. For a new phone, or just in case, use **Settings › Your data › Back up to a file**, then **Restore from a file**.

Troubleshooting:
- **"App not installed" / blocked:** some Samsung phones have *Auto Blocker* (Settings → Security and privacy → Auto Blocker). Turn it off while installing, then back on.
- **Play Protect warning:** tap *More details → Install anyway*. It warns because the app isn't from the Play Store.
- The APK is built for 64-bit phones (arm64), which covers virtually every phone from the last several years.

### Android developer verification (heads-up)

Google is introducing a rule that apps on certified Android phones must come from registered developers, including apps installed from files like this one. As of October 2026 it's enforced only in Brazil, Indonesia, Singapore and Thailand, with the rest of the world planned for 2027. If it reaches you, there are free options: register under Google's free hobbyist developer account, use Android's one-time "advanced" setting for unverified apps, or install from your laptop with ADB (exempt).

## Develop

Prerequisites: Node 22 and Git. A JDK 17 and the Android SDK are only needed to build the APK locally; GitHub builds it for you.

```bash
npm ci              # install dependencies
npm run check       # typecheck + lint + all tests
npm test            # tests only
npx expo start      # dev server (preview in a development build)
```

Expo Go is fine for quick UI previews, but not for daily use: the app only runs while the dev server is running.

Project layout:

```
src/app/          screens and navigation (Expo Router)
src/components/   shared UI: Screen, Card, Button, ProgressRing, ListGroup, Segmented…
src/theme/        design tokens (colours, type, spacing, motion); the only place styles are defined
src/database/     SQLite adapter, migrations, repositories
src/domain/       pure logic: nutrition maths, dates, types
tests/            Jest tests (database tests run on an in-memory SQLite)
plugins/          Expo config plugin for release signing
android-signing/  RepFuel's release key, written by CI from secrets (never committed)
```

## Release a new version

GitHub Actions does the build:

- **Every push** runs typecheck, lint, tests and an Android bundle build (`.github/workflows/ci.yml`).
- **Changing the app version** in `app.json` and pushing builds a signed APK and publishes it as release `v<version>` (`.github/workflows/release.yml`). Versions that already have a release are skipped. This happens on any branch: builds from branches other than `main`, and versions with a suffix like `0.1.0-stage1`, are published as **pre-releases** for testing. A plain version (like `0.2.0`) pushed to `main` becomes the "Latest" release.
- Pushing a `v*` tag also works, but the tag must match the `app.json` version (the build stops otherwise), so the version shown in the app always matches the release.

The Android `versionCode` is `100 + the release workflow's run number`, so every build installs over the previous one. Don't rename `release.yml`: a renamed workflow restarts its run numbers, and Android would refuse the next update.

### Signing key

RepFuel's release key is kept in the repo's **GitHub Actions secrets**, never in the code: `REPFUEL_KEYSTORE_BASE64` (the keystore file, base64), `REPFUEL_STORE_PASSWORD` and `REPFUEL_KEY_PASSWORD` (alias `repfuel`). The release workflow writes them to `android-signing/` (git-ignored) just before building. The key must never change, or new versions can't install over old ones, so keep a copy of the keystore and passwords somewhere safe outside GitHub too.

## What can't be verified automatically

CI proves the code typechecks, passes tests and builds a correctly signed APK. Installing it, opening it on a real phone, fonts, the splash screen and the feel of the transitions can only be checked on a device.
