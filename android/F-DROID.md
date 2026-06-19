# Publishing on F-Droid

This repo is set up to be buildable by the F-Droid build server with no
local secrets. Follow the checklist below to submit.

## What's in the repo

- `metadata/com.bor_devs.shoplist.yml` — F-Droid build recipe template.
  Copy it into `fdroiddata/metadata/` when opening the merge request.
- `fastlane/metadata/android/{en-US,es-ES,ca}/` — store listing texts,
  icon, and per-version changelog. F-Droid auto-imports these.
- `app/keystore.properties` is **gitignored** and only used for local
  signing. F-Droid signs its own builds with the F-Droid key, so the
  recipe explicitly removes the file before building (`rm:` in the YAML).

## Pre-submit checklist

- [x] FOSS license present (`LICENSE`, MIT).
- [x] No proprietary dependencies (no Google Services, Firebase, Crashlytics).
- [x] No tracking / analytics SDKs.
- [x] No hard-coded secrets in committed files.
- [x] `applicationId` (`com.bor_devs.shoplist`) is unique and stable.
- [x] Repo URL, issue tracker and changelog are public.
- [ ] Tag a release on GitHub as `v1.3.3` (so the F-Droid recipe can `commit: v1.3.3`).
- [ ] Add 2–8 phone screenshots under
      `fastlane/metadata/android/en-US/images/phoneScreenshots/`
      (PNG, 1080×1920 or similar, named `01_*.png`, `02_*.png`, …).
- [ ] Re-render the launcher icon if you changed the SVG
      (`app/src/main/res/branding/icon*.svg`).

## How F-Droid will build it

1. F-Droid clones the repo at the tag `v1.3.3`.
2. Removes `app/keystore.properties` (so the `if (keystorePropsFile.exists())`
   branch in `build.gradle.kts` is skipped — no signing config is added,
   F-Droid signs the APK with its own key).
3. Runs `./gradlew assembleRelease`.
4. Signs the resulting APK with the F-Droid release key.

## Submit

1. Fork https://gitlab.com/fdroid/fdroiddata
2. Copy `metadata/com.bor_devs.shoplist.yml` into the fork's
   `metadata/` directory.
3. Run `fdroid readmeta` and `fdroid lint com.bor_devs.shoplist`
   to verify locally (optional but recommended).
4. Open a merge request titled `New app: ShoppingList`.

## Reproducible builds (optional, recommended)

For [Reproducible Builds](https://f-droid.org/docs/Reproducible_Builds/),
ensure:

- The build is deterministic (no embedded timestamps in resources).
- The same source at the same tag produces a byte-identical unsigned APK.

Once F-Droid confirms reproducibility, the app gets a green "Built and
signed by the developer" badge — at which point you can also upload your
own signed APKs to GitHub Releases and F-Droid will verify them match.
