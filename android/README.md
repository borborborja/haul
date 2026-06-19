# ShoppingList — Native Android

A native **Kotlin + Jetpack Compose (Material 3)** client for the
[ShoppingList](https://github.com/bor_devs/shoppinglist) PocketBase backend.
It replaces the Capacitor WebView wrapper with a fully native, offline-first app.

## Features

- **Planning & Shopping modes** — build the list, then shop with a live progress bar.
- **Views & sorting** — list / compact / grid; group by category or sort alphabetically.
- **Items** — add (with catalog autocomplete + category auto-detect), check/uncheck,
  notes, delete, clear completed, move to / restore from *previously used*, auto-clear.
- **Custom categories & items**, with an emoji picker.
- **Real-time sync** across devices over PocketBase SSE, with an offline-first local
  cache (Room) and a retry write-queue — edits made offline reconcile on reconnect.
- **Sharing** — create / join lists by code, rotate codes, sync history, deep links
  (`shoppinglist://…?c=CODE` and `https://shoppinglist.bor-devs.app/?c=CODE`), share sheet.
- **Accounts** — anonymous guest sessions, claim into an account, login, recover lists,
  optional usernames, presence ("viewing now").
- **Settings** — server wizard (with *Test* + **local mode**), light/dark/AMOLED/auto
  themes (Material You), languages (Català / Español / English), notifications,
  JSON export/import.

## Architecture

MVVM + a single `ShopRepository`, mirroring the web app's store + sync hooks.

- **UI**: Jetpack Compose, Material 3, single-activity.
- **DI**: Hilt.
- **Local**: Room (items, custom categories) + DataStore (preferences, auth token).
- **Remote**: a small OkHttp-based PocketBase client with a runtime-reconfigurable
  base URL, plus an SSE realtime client.
- **Sync**: `WriteQueue` (per-record coalescing + retry/backoff) and `SyncMeta`
  (stale-echo suppression), ported 1:1 from the web app.

## Server

On first launch a wizard asks for your PocketBase server URL (default
`https://shoppinglist.bor-devs.app`) with a **Test** button, or you can skip it and use
the app **locally** (on-device only). The server is changeable anytime in Settings.

## Build

Requires JDK 17 and the Android SDK (compileSdk 35).

```bash
./gradlew :app:assembleDebug      # build debug APK
./gradlew :app:testDebugUnitTest  # run unit tests
```

The debug build uses the `.debug` application-id suffix so it can be installed
alongside the existing Capacitor build. Release signing reads
`app/keystore.properties` (untracked).

## License

MIT © bor_devs
