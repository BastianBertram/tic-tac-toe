# Bug log — essklasse-web

Audit date: 2026-06-10. Scope: the `essklasse-web` app (frontend + `server/`).
The sibling projects `../bewirtung-app` and `../essklasse` (a second Vite
prototype and an Expo/React-Native app) were **not** analysed.

**Status: all 10 items below are now fixed.** Build (`tsc -b && vite build`) and
`eslint` pass clean; app verified loading without console errors.

Legend: 🔴 functional · 🟠 robustness · 🟡 minor · ⚪ cleanup.

---

## 🔴 1. Deleted bewirtungen appeared in the calendar — ✅ Fixed
`CalendarScreen.tsx` `belegeForObjekt` now excludes `b.deleted`.

## 🔴 2. Deleted bewirtungen appeared in the "to be completed" list — ✅ Fixed
`AbschlussListScreen.tsx` `offene` now skips `b.deleted`.

## 🟠 3. "Abschließen" badge/banner count ≠ the list it links to — ✅ Fixed
`BottomNav.tsx` and `OffeneBanner.tsx` now scope the overdue count to the active
object, matching `AbschlussListScreen`.

## 🟠 4. `markRechnungErstellt` was a blind toggle — ✅ Fixed
`belegStore.ts` now sets the invoice fields explicitly (idempotent) instead of
toggling, so re-invoking can never silently revoke an invoice.

## 🟠 5. Required object assignment wasn't enforced on save — ✅ Fixed
`AdminScreen.tsx` `canSave` now requires at least one object for
user/bereichsleitung/buchhaltung roles.

## 🟠 6. `parseISO(cateringDatumVon)` could throw on an invalid date — ✅ Fixed
New `src/utils/date.ts` `formatDatum()` guards with `isValid()` and returns ''
on bad input. Adopted in `BelegCard`, `DetailScreen`, and `BuchhaltungScreen`
(both sites). (`CalendarScreen:96` formats `selected`, which is always valid.)

## 🟡 7. `setAuth` called during render (dev-only) — ✅ Fixed
`AuthGuard.tsx` dev auto-login moved into the mount effect and deferred via
`queueMicrotask`, removing the render-phase state update.

## 🟡 8. ObjektSwitcher read the deprecated `adresse` field — ✅ Fixed
`ObjektSwitcher.tsx` now builds the address from `strasse`/`plz`/`ort` (falling
back to the legacy `adresse`).

## ⚪ 9. Dead component ProfilSheet — ✅ Fixed
`src/components/ProfilSheet.tsx` removed (never imported). Its CSS module stays —
`HamburgerDrawer` uses it.

## ⚪ 10. Unused store getters — ✅ Fixed
`belegStore.ts` dropped `getTodaysBelege`, `getBelegeByDate`, and
`getDatesWithBelege` (only `getOffeneBelege` is consumed).

---

## Still open (by design, documented elsewhere)
- Magic-link auth (`server/auth.mjs`) is intentionally dev-grade: in-memory
  stores, console "email", and an `accessToken` not yet verified on protected
  routes. See `server/README.md` for the production checklist.
