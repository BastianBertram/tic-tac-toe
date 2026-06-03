# EssKlasse – Betriebsgastronomie App
**HWK Hannover | Bewirtungsbelege digital erfassen**

---

## Schnellstart

```bash
cd essklasse
npm install
npx expo start
```

Dann in der Expo Go App auf iOS/Android scannen, oder `i` für iOS-Simulator, `a` für Android-Emulator.

---

## Konfiguration Business Central

Öffne `src/services/authService.ts` und ersetze die Platzhalter:

| Konstante | Wert |
|-----------|------|
| `YOUR_TENANT_ID` | Azure Entra ID Tenant-ID |
| `YOUR_CLIENT_ID` | App-Registrierung Client-ID |
| `YOUR_BC_COMPANY_ID` | Business Central Company-ID |

Öffne `src/services/bcService.ts`:
- Passe die OData-Entity-Namen an deine BC-Customisierung an (`salesOrders`, `salesOrderLines`)
- Passe die Feldnamen an (custom Extension-Felder mit `hwk`-Präfix)

### Azure App-Registrierung
1. Azure Portal → Entra ID → App-Registierungen → Neu
2. Redirect URI: `essklasse://auth` (mobil)
3. API-Berechtigungen: `Dynamics 365 Business Central → Financials.ReadWrite.All`
4. Token-Konfiguration: Access Token + ID Token aktivieren

---

## Projektstruktur

```
essklasse/
├── App.tsx                          # Root: Navigation + Modals
├── src/
│   ├── types/index.ts               # Bewirtungsbeleg, Positionen, Typen
│   ├── store/
│   │   ├── belegStore.ts            # Zustand Store (persistiert via AsyncStorage)
│   │   └── authStore.ts             # Auth State
│   ├── services/
│   │   ├── authService.ts           # MSAL Token-Verwaltung (SecureStore)
│   │   ├── bcService.ts             # Business Central OData v4
│   │   └── syncService.ts           # Offline → Online Synchronisation
│   ├── components/
│   │   ├── BottomNav.tsx            # Tab Bar mit FAB (+)
│   │   ├── BelegCard.tsx            # Listen-Karte
│   │   ├── PhotoCapture.tsx         # Kamera + Galerie + Vorschau
│   │   ├── PositionEditor.tsx       # Positionen mit Kategorie-Picker
│   │   └── StatusBadge.tsx          # Lokal / Syncing / Übertragen / Fehler
│   └── screens/
│       ├── TodayScreen.tsx          # Heutiger Tag + Zusammenfassung
│       ├── CalendarScreen.tsx       # Monatskalender + Tagesübersicht
│       ├── NewBelegScreen.tsx       # Neuer Beleg (Formular + Fotos)
│       └── BelegDetailScreen.tsx    # Detail + Retry-Sync + Löschen
```

---

## Features

### Offline-First
- Alle Belege werden sofort lokal gespeichert (AsyncStorage + Zustand persist)
- Sync-Status: `lokal → syncing → übertragen | fehler`
- Beim App-Start & Pull-to-Refresh werden ausstehende Belege automatisch übertragen
- Badge in der BottomNav zeigt Anzahl ausstehender Belege

### Foto-Funktionen
- Großer roter Kamera-Button zum direkten Fotografieren
- Mehrere Fotos möglich (Kamera + Galerie)
- Thumbnail-Vorschau mit Einzeln-Löschen

### Kalender
- `react-native-calendars` Monatsansicht
- Rote Punkte markieren Tage mit Bewirtungen
- Tap auf Datum → filtert die Beleg-Liste

### Business Central
- Automatische Anlage eines Verkaufsauftrags (Header + Zeilen)
- Rückgabe der BC-Auftragsnummer → wird prominent angezeigt
- Retry-Button bei Übertragungsfehlern
- OData v4, Bearer Token (MSAL / Entra ID)

---

## Authentifizierung (Produktion)

Für die vollständige MSAL-Integration in React Native empfehlen wir:

```bash
npm install react-native-msal
```

Dann in `authService.ts` den `PublicClientApplication` aus `react-native-msal` nutzen
und `acquireToken` / `acquireTokenSilent` aufrufen.

Die `saveTokens()` / `getStoredToken()` Funktionen in `authService.ts` können
direkt mit den zurückgegebenen Token-Objekten verwendet werden.

---

## Farben (Design-System)

| Token | Hex | Verwendung |
|-------|-----|------------|
| `bg` | `#1a1a2e` | App-Hintergrund |
| `surface` | `#16213e` | Cards, Sections |
| `card` | `#0f3460` | Input-Felder, Icons |
| `accent` | `#e94560` | FAB, Primär-Aktionen, Markierungen |
| `light` | `#a8dadc` | Akzent-Text, Summen, BC-Nummern |
| `fb-blue` | `#1877f2` | Sekundäre Buttons (Facebook-Style) |
