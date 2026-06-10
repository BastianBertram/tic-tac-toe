# Bug log — essklasse-web

Audit date: 2026-06-10. Scope: the `essklasse-web` app (frontend + `server/`).
The sibling projects `../bewirtung-app` and `../essklasse` (a second Vite
prototype and an Expo/React-Native app) were **not** analysed — separate
codebases.

Status legend: 🔴 functional bug · 🟠 robustness · 🟡 minor/cosmetic · ⚪ cleanup.
Nothing in this log has been fixed yet — it is analysis only.

---

## 🔴 1. Deleted bewirtungen appear in the calendar
`src/screens/CalendarScreen.tsx:30-33` — `belegeForObjekt` filters by object but
not by `deleted`:
```ts
() => belege.filter(b => !aktivesObjekt || b.objektId === aktivesObjekt.id)
```
Soft-deleted belege still produce calendar dots and show in the day list.
Every other user-facing list excludes `b.deleted` (`TodayScreen`, the store
getters). Fix: add `!b.deleted &&`.

## 🔴 2. Deleted bewirtungen appear in the "to be completed" list
`src/screens/AbschlussListScreen.tsx:20-26` — the `offene` filter checks
`!b.abgeschlossen` and object, but not `!b.deleted`. A soft-deleted, not-yet-
completed beleg shows up in the Abschluss list and can be opened and closed.
Fix: add `if (b.deleted) return false;`.

## 🟠 3. "Abschließen" badge count ≠ the list it links to
`src/components/BottomNav.tsx:16-25` and `src/components/OffeneBanner.tsx`
(via `belegStore.getOffeneBelege`) count overdue belege across **all** objects,
but `AbschlussListScreen` scopes its list to the **active** object
(`AbschlussListScreen.tsx:22`). For a user with more than one object the badge
can read higher than the list shows. Decide on one scoping rule (almost
certainly: scope the badge to the active object too).

## 🟠 4. `markRechnungErstellt` is a blind toggle
`src/store/belegStore.ts:68-77` toggles `rechnungErstellt` and, when toggling
*off*, clears `rechnungErstelltAm`/`rechnungErstelltVon` while leaving
`rechnungsnummer` set. The invoice flow always means "set", so a second
invocation on an already-invoiced beleg would silently revoke it and leave an
inconsistent record. Currently latent (the UI only shows the button when
`!rechnungErstellt`), but the action should be an explicit set, not a toggle.

## 🟠 5. Required object assignment isn't enforced on save
`src/screens/AdminScreen.tsx` — for `user`/`bereichsleitung` the form labels
"Objekte zuordnen *" as required, but `canSave` (`AdminScreen.tsx:151`) only
checks name + email. A user can be saved with zero objects, leaving them with
access to nothing. Fix: require non-empty `objektIds` for those roles.

## 🟠 6. `parseISO(cateringDatumVon)` assumes a valid date
`BelegCard.tsx:16`, `DetailScreen.tsx:25`, `AbschlussScreen.tsx` (datum),
`BuchhaltungScreen.tsx:28,323`, `CalendarScreen.tsx:96` all do
`format(parseISO(b.cateringDatumVon), …)`. An empty/invalid date yields
`Invalid time value` and throws during render. Creation defaults the date to
today, so risk is low, but persisted/imported data with a blank date would
crash the screen. Consider a guarded formatter.

## 🟡 7. `setAuth` called during render (dev-only)
`src/components/AuthGuard.tsx:73-78` — the DEV auto-login calls `setAuth(...)`
directly in the render body. It converges (next render has a user) but is a
state-update-during-render anti-pattern and can warn under StrictMode. Move it
into the mount effect. Dev-only, so harmless in production builds.

## 🟡 8. ObjektSwitcher reads the deprecated `adresse` field
`src/components/ObjektSwitcher.tsx:57` renders `obj.adresse`, which is the
`@deprecated` field. Objects created via Admin or seed populate
`strasse`/`plz`/`ort` instead, so the address never renders in the switch
sheet. Build the address from the structured fields (as `AdminScreen` does at
`AdminScreen.tsx:601`).

## ⚪ 9. Dead component: ProfilSheet
`src/components/ProfilSheet.tsx` (`ProfilButton`, `ProfilModal`, `ObjekteInfo`,
~110 lines) is never imported. The header uses `ObjektSwitcherButton` +
`HamburgerDrawer` instead. Remove, or wire it in if it was intended.

## ⚪ 10. Dead store getters
`src/store/belegStore.ts` — `getTodaysBelege`, `getBelegeByDate`, and
`getDatesWithBelege` are defined but unused (`TodayScreen`/`CalendarScreen`
compute these inline). Only `getOffeneBelege` is consumed. Remove or adopt.

---

## Notes / non-bugs
- `src/screens/CalendarScreen.tsx:19` places an `import` after a function
  declaration. Works (imports hoist) but reads oddly.
- `HamburgerDrawer.tsx` imports `ProfilSheet.module.css` as its primary `s`
  styles. Works, but confusing given the filename.

## Security posture (context, mostly resolved earlier)
- AI calls now go through `server/` so the Anthropic key is no longer exposed in
  the browser — resolved.
- Magic-link auth (`server/auth.mjs`) is intentionally **dev-grade**: in-memory
  stores, console "email", and an `accessToken` that protected routes do not yet
  verify. Documented in `server/README.md`; replace before production.
