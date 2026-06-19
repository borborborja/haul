# Release signing

Release APKs are signed with a **stable release key** so that installing a newer
release over an older one works (a changing key makes Android refuse the update
with *"app not installed"*).

## How it works

- The `Release` workflow ([`.github/workflows/release.yml`](../.github/workflows/release.yml))
  reads four repository secrets and, when present, builds a **signed
  `assembleRelease`** APK (R8 minify + resource shrink). Without them it falls
  back to a debug-signed APK.
- Locally, `app/build.gradle.kts` reads `app/keystore.properties` (gitignored).

## Required GitHub Actions secrets

| Secret | Meaning |
| --- | --- |
| `KEYSTORE_BASE64` | base64 of the `.jks` keystore |
| `KEYSTORE_PASSWORD` | keystore (store) password |
| `KEY_ALIAS` | key alias (`shoppinglist`) |
| `KEY_PASSWORD` | key password |

These are already configured.

## ⚠️ Keep the keystore safe

The keystore + passwords are backed up **outside** the repo at
`../signing-backup/` (`release.jks`, `credentials.txt`). **Back this up
somewhere durable.** If the keystore is lost, you can no longer ship updates that
install over existing installs — every user would have to uninstall + reinstall.

## One-time migration note

The switch from debug-signed to this stable key changes the signature once, so
the **first** install of a stable-signed release (v1.3.1+) over a previously
installed debug-signed build requires a single uninstall + reinstall. Every
update after that installs cleanly.

## Local signed build

```sh
# app/keystore.properties (gitignored):
#   storeFile=/abs/path/to/release.jks
#   storePassword=...
#   keyAlias=shoppinglist
#   keyPassword=...
./gradlew :app:assembleRelease
```
