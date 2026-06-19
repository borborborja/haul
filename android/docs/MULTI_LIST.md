# Future: multiple lists

Status: **not implemented** — design note for a future iteration.

## Motivation

Today the app shows a single list. The top bar renders the list name inline with
the connection dot and the Plan/Shop toggle (`EnhancedTopBar` in
[`MainScreen.kt`](../app/src/main/java/com/borja/shoplist/ui/list/MainScreen.kt)).

The web app places the **title lower** (its own row, below the header controls)
instead of inline. That layout leaves room to turn the title into a **list
switcher** (a tappable title / dropdown / horizontal pager of lists) without
crowding the action buttons. Adopting the same layout on Android is the enabling
step for supporting more than one list.

The current inline layout is fine as-is; this is only a prerequisite to document,
not a change to make now.

## Suggested approach when we implement it

1. **Layout** — Move the list title out of `TopAppBar`'s `title` slot into a
   dedicated row beneath the app bar (mirroring the web). Keep the Plan/Shop
   toggle and connection dot in the bar. The title row becomes the switcher
   entry point (tap to open a list picker / swipe between lists).

2. **Data model** — Items currently live in a single `shoplist.db` with no list
   foreign key (`ItemEntity`). Introduce a `lists` table and add a `listId`
   column to items (Room migration, bump `AppDatabase.version`). Each "list" maps
   to one sync record / sync code on the PocketBase side, so the existing
   `syncCode` / `syncRecordId` settings would move from global prefs to per-list.

3. **Selection state** — Persist the active `listId` in `SettingsDataStore`. The
   repository's flows (`items`, `listName`, `sync`) would filter by / key off the
   active list.

4. **Sync** — `syncHistory` already stores multiple `{code, title}` entries; it is
   the natural backing store for the list switcher. Joining a code would add a
   list rather than replace the current one.

5. **Widgets** — `WidgetDatabase` / `getListName` read the active list today.
   They would need a per-widget `listId` config (Glance state) so different
   home-screen widgets can pin different lists.

No code depends on this document; it exists so the rationale for the web's
lower-title layout is not lost.
