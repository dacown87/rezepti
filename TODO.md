
## ReactNative-Migration (Branch: ReactNative) — Stand 2026-04-02

### ✅ Abgeschlossen
- Vite/React-Frontend entfernt, Expo Web als einziger Web-Build
- Expo-Projekt mit EAS verknüpft (`app.json` + `eas.json`)
- GitHub Actions EAS-Workflow eingerichtet (manuell triggerbar)
- `getServerUrl` same-origin fix für Web
- CORS-Allowlist + SSRF-Proxy-Hardening
- Planer auf Web via AsyncStorage/localStorage

### ❌ Offen

**Native-App (EAS Build)**
- EAS Build für Android testen (APK/AAB)
- iOS-Build konfigurieren (falls gewünscht)
- Push-Notifications prüfen (Expo Notifications)

**UX / Offene Bugs**
- QR-Bild-Scan (BarcodeDetector API): Nur Chromium — Safari/Firefox zeigen Fehlermeldung. Alternativ: `expo-barcode-scanner` für native App.
- Kamera-Zugriff im Wochenplan-Modal auf mobilen Geräten testen

**Infrastruktur**
- Docker-Image aktualisieren: Expo Web Build statt Vite-Build
- Northflank: Prüfen ob Production-Deployment mit Expo Web funktioniert

---

## Backlog (nach Migration)

- Multi-User / Login (JWT oder Session-Cookies)
- Android-App via EAS (nach erfolgreichen Tests)
- KI-Rezeptgenerierung ("Was habe ich zu Hause?")
- Kommentarfunktion (nur sinnvoll mit Multi-User)
