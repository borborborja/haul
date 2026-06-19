# Haul

Collaborative, offline-first shopping list with real-time sync. A redesign of the
original ShoppingList app, sharing one backend across all clients.

Monorepo:

| Path        | What                                                                 |
|-------------|----------------------------------------------------------------------|
| `web/`      | React + Vite + Tailwind app (responsive desktop + mobile, PWA, Capacitor) |
| `android/`  | Native Kotlin + Jetpack Compose app                                   |
| `backend/`  | Go + PocketBase server (REST + realtime SSE)                          |
| `DESIGN.md` | Shared Haul design tokens (fonts, palette, category accents, shapes)  |

## Develop

```bash
# Backend (PocketBase)
cd backend && go run . serve

# Web
cd web && npm install && npm run dev

# Android
cd android && ./gradlew assembleDebug    # needs JDK 17 + Android SDK
```

## CI / CD (GitHub Actions)

- **Docker** (`.github/workflows/docker.yml`) — builds the all-in-one image
  (web build + Go backend serving it) and pushes to `ghcr.io/<owner>/haul`
  on pushes to `main` and `v*` tags. `latest` tracks `main`; tags get semver tags.
- **Android APK** (`.github/workflows/android.yml`) — builds the APK on `main`,
  `v*` tags, and manual runs. Uploads a debug-signed APK as a build artifact;
  on `v*` tags it attaches the APK to a GitHub Release. Provide
  `KEYSTORE_BASE64` / `KEYSTORE_PASSWORD` / `KEY_ALIAS` / `KEY_PASSWORD` repo
  secrets to publish a signed release APK instead.

### Run the Docker image

```bash
docker run -p 8090:8090 -v haul_data:/pb_data ghcr.io/<owner>/haul:latest
```
