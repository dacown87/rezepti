# Checkliste: manuelle Test-Session (Betreiber)

Stand: 2026-10-07. Alle Tests, die sich nicht per Skript oder CI pruefen lassen, weil sie einen echten Browser, ein Geraet oder ein Postfach brauchen. Gedacht fuer **eine** gemeinsame Sitzung statt verstreuter Einzeltermine. Die ausfuehrlichen Ablaeufe stehen in [TODO.md](../../TODO.md) unter „Offene Punkte" → *Pruefen / manuell testen* bzw. an den verlinkten Stellen; hier nur Reihenfolge, Vorbereitung und Haken. Nach jedem Test den Haken **auch in TODO.md** setzen.

## Vorbereitung
- Testkonten: zwei Konten fuer Staging (A, B), ein Wegwerf-Konto fuer Production (Passwort-Reset, Push).
- Lokale Web-App gegen Staging (`SUPABASE_URL`/`DATABASE_URL` auf Staging) fuer Block 1. Achtung: kein `build:mobile`/`mobile:release-gate` lokal (Absturzgefahr) — fuer Block 1 den Dev-Server (`npm run dev:mobile`) nutzen.
- Firefox installiert; Android-Geraet (Block 3) und iPhone (Block 2).

## Block 1 — Staging, lokal im Browser
- [ ] **Account-Loeschung** (7 Schritte inkl. Offline-Queue A→B) — TODO *Pruefen / manuell testen*, erster Eintrag.
- [ ] **Vorschaubilder von Foto-Rezepten in der Liste** — ein Rezept per Foto-Import anlegen (ohne Chefkoch-Treffer), Liste oeffnen: wird das Vorschaubild angezeigt oder liefert `/api/v1/recipes/:id/image` im Netzwerk-Tab `401`? Ergebnis in TODO (Nebenbefunde) eintragen.
- [ ] **PWA-Off-/Online-Smoke** (Offline-Queue, Reconnect) — TODO *Lokaler Browser-/PWA-Smoke gegen Staging*. Kann mit den Konten aus dem Loesch-Test laufen, **vor** der Loeschung.

## Block 2 — Production, echte Geraete und Postfach
- [ ] **Passwort-Reset end-to-end** — Mail von `noreply@recipedeckapp.de`, Link auf `www…/account`, Maske „neues Passwort".
- [ ] **Web-Push end-to-end** — Push in den Einstellungen an, Import abschliessen, Benachrichtigung „Rezept fertig".
- [ ] **jsQR-Fallback in Firefox** — Scanner ohne `BarcodeDetector`, QR-Code wird erkannt.
- [ ] **iOS Logout-/Cross-User-Privacy auf Hardware** — Konto A cached Rezepte, Logout, Login B, keine alten Offline-Rezepte sichtbar ([PWA Post-Deploy QA](../superpowers/plans/2026-06-13-pwa-post-deploy-qa.md)).
- Zum Schluss das Wegwerf-Konto ueber „Konto loeschen" entfernen (prueft nebenbei den Loeschpfad in Production).

## Block 3 — nativer Testbuild (sobald Paket N gebaut ist)
- [ ] **Geraetetest Android** — Smoke-Liste aus [Paket N](../superpowers/plans/2026-10-07-grob-nativer-testbuild.md).

## Spaeter dazukommende Tests (aus den Paketen)
Beim Abschluss der jeweiligen Pakete hier ergaenzen, z. B. `/nutzungsbedingungen` anonym erreichbar und Hinweis im Signup sichtbar (R/D9-light), EXIF-Pruefung eines gespeicherten Fotos mit `exiftool` (DM-2), Foto-Rezept-Thumbnail in der Liste (DM-3-light), `429` nach dem 16. Import (B). Entfallen seit 2026-10-09: Kontaktformular, Nutzungsbedingungen-Gate, Netzwerk-Tab ohne Fremd-Hosts.
