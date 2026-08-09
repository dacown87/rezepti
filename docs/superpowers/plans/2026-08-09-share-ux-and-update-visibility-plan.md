# Plan: Teilen-UX und Update-Sichtbarkeit

**Stand:** 2026-08-09 · **Status:** ENTWURF

Drei Punkte aus der Nutzung am 2026-08-09, nachdem der Mailversand erstmals
nachweislich funktioniert hat. Alle drei sind klein; einer davon behebt einen
echten Fehler, die anderen zwei sind UX-Schulden mit messbarem Alltagseffekt.

---

## Was gemessen ist

Der Ist-Stand unten ist am Code geprüft, nicht angenommen.

| Fund | Beleg |
|---|---|
| Update-Einstieg liegt fast am Ende der Einstellungen | `settings.tsx:1163-1202` in einer Datei mit 1329 Zeilen |
| `usePwaUpdate` wird an genau **einer** Stelle benutzt | `settings.tsx:303`, sonst nirgends |
| Die E-Mail-Einladung liegt **nicht** im Teilen-Modal | `[id].tsx:1048-1082`, inline in „Collections & Teilen" |
| Das Teilen-Modal kennt nur QR und Text | `[id].tsx:750-781` |
| Ein Empfänger ohne Konto landet auf **Anmelden** | `share-invite/[token].tsx:36` → `buildLoginFirstAccountHref(returnTo, 'signin')` |
| Der Server weiß nichts über Konto-Existenz | `routes/recipe-share-invites.ts` — weder Preview noch Accept signalisieren es |
| Die Invite-Seite hat **keinerlei** Testabdeckung | keine Datei in `mobile/test/` oder `test/` referenziert sie |

---

## Slice C — Empfänger ohne Konto landet auf dem falschen Formular

**Zuerst, weil es der einzige echte Fehler der drei ist und der kleinste Eingriff.**

### Was passiert

`accept()` prüft die Session erst beim Klick und schickt bei fehlender Session
auf `'signin'`. Wer eine Einladung bekommt und noch kein Konto hat — der
Normalfall bei einer Einladung — sieht ein Anmeldeformular für ein Konto, das
es nicht gibt.

Verschärfend: die Seite sieht vorher für angemeldete und nicht angemeldete
Besucher **identisch** aus. Der Zustand wird erst nach dem Klick sichtbar.

### Umbau

- Session beim Laden auflösen, nicht erst beim Klick. Die Seite bekommt damit
  drei statt zwei Zustände: angemeldet, nicht angemeldet, lädt.
- Für nicht angemeldete Besucher ein erklärender Block statt eines Redirects:
  die Einladung ist an `recipientEmail` gebunden, dafür wird ein Konto mit
  **genau dieser** Adresse gebraucht. Zwei gleichwertige Buttons, beide mit
  `returnTo`: **Account erstellen** (`'signup'`) und **Anmelden** (`'signin'`).
- `buildLoginFirstAccountHref` akzeptiert bereits `'signin' | 'signup' | 'reset'`
  (`login-first-routing.ts:33-44`) — keine Signaturänderung nötig.
- `account.tsx` um einen optionalen `email`-Parameter erweitern, der das
  E-Mail-Feld vorbefüllt. Kein Leak: wer den Token hat, sieht `recipientEmail`
  ohnehin im Preview. Spart den häufigsten Tippfehler, nämlich die Registrierung
  mit einer anderen Adresse — was direkt in `email_mismatch` läuft.

### Ausdrücklich nicht gebaut

**Dem Absender anzeigen, ob eine Adresse schon ein Konto hat.** Das wäre ein
Account-Enumeration-Orakel: jeder mit Konto könnte beliebige Adressen
durchprobieren. Der Preview-Payload ist im „Route Auth Inventory" (`CLAUDE.md`)
aus genau diesem Grund als bewusst schmal markiert, und der Server kennt die
Information heute an keiner Stelle. Die empfängerseitige Lösung erreicht
dasselbe Ziel ohne diese Nebenwirkung.

Es bleibt damit auch bei **null** neuen Serverfeldern — Slice C ist rein Client.

### Tests

Die Seite hat heute **keine**. Neue Datei `mobile/test/share-invite-screen.test.tsx`:
nicht angemeldet → beide CTAs sichtbar, Accept-Button nicht; Klick auf
„Account erstellen" navigiert mit `mode=signup`, korrektem `returnTo` und
vorbefüllter Adresse; angemeldet → Accept-Button sichtbar; `email_mismatch`
zeigt die bestehende Meldung; `accepted`/`revoked`/`expired` ersetzen den Button
wie bisher.

**Aufwand:** ~2 h.

---

## Slice A — Update-Hinweis dorthin, wo er gebraucht wird

### Warum das mehr ist als Kosmetik

Nach jedem Deploy läuft die installierte PWA bis zum nächsten Reload auf dem
alten Stand. Das hat in dieser Session bereits zweimal zu Fehldiagnosen geführt:
ein Fix war ausgerollt und wirkte trotzdem nicht, weil der alte Service Worker
noch aktiv war. Der einzige Hinweis darauf steckt heute hinter etwa 1100 Zeilen
Scrollweg.

### A1 — Karte in den Einstellungen nach oben

Der Block `settings.tsx:1163-1202` wandert direkt hinter den Header
(`settings.tsx:660-664`), also **vor** die Admin- und Account-Karte.

Das drängt nichts dauerhaft nach unten: die ganze Karte ist ohnehin an
`canInstall || showIOSHint || updateReady` gebunden und im Normalfall gar nicht
da. Sie erscheint nur, wenn sie etwas zu sagen hat — und dann oben.

Nebenher: der Button verwendet `TouchableOpacity`, während der Rest des Screens
`Pressable` nutzt. Beim Verschieben angleichen.

### A2 — Globaler Hinweis

`usePwaUpdate` wird ein zweites Mal eingebunden, in einer neuen kleinen
Komponente `mobile/components/PwaUpdateBanner.tsx`, montiert **einmal** in
`_layout.tsx` als Geschwister von `<Stack>`.

Drei Entscheidungen dazu:

**Warum global statt nur auf der Hauptseite.** Gewünscht war „auf der
Hauptseite". Ein global montierter Banner kostet dieselbe Arbeit, erreicht aber
auch den Fall, der real weh tut — jemand testet auf `/recipe/…` oder
`/shopping` und wundert sich, warum ein Fix nicht greift.

**Warum eine zweite Hook-Instanz statt Context.** Zwei Instanzen registrieren
zwei Listener-Sätze; beide setzen `updateReady`, beide können `applyUpdate`
auslösen, der Hook ist idempotent. Ein Context wäre sauberer, kostet aber eine
Provider-Ebene für genau zwei Konsumenten. Wenn ein dritter dazukommt, ist der
Context fällig — das gehört als Notiz in den Code, nicht als Vorbau.

**Warum nicht dem `OfflineBanner` folgen.** Der ist bewusst pro Screen im
Fluss montiert (`OfflineBanner.tsx:41-55`), nicht global. Ihn nachzuahmen hieße,
jeden Screen anzufassen. Das Vorbild ist stattdessen der absolut positionierte
Bug-Report-Button in `_layout.tsx:299-334`.

**Achtung, Falle:** dieser Button ist an `!LOGIN_FIRST_ACCOUNT_GATE_ENABLED`
gebunden (`_layout.tsx:299`) und im aktuell aktiven Login-First-Modus damit
faktisch tot. Der Update-Banner darf diese Bedingung **nicht** übernehmen — er
soll in beiden Gate-Zuständen erscheinen. Wer das Muster kopiert, kopiert sonst
den Defekt mit.

Der Banner ist für die Sitzung ausblendbar; wer ihn wegklickt, findet den
Update-Weg weiterhin oben in den Einstellungen.

### Tests

`mobile/test/usePwaUpdate.test.ts` deckt den Hook ab und ist von beiden
Änderungen **nicht** betroffen — reine Hook-Tests ohne UI.

Für die Settings-Karte existiert heute **kein** Test. Das Verschieben ist
dadurch risikolos und gleichzeitig ungesichert. Neu: ein Test, dass der Banner
bei `updateReady=true` erscheint, `applyUpdate` auslöst und sich ausblenden
lässt.

**Aufwand:** ~3 h.

---

## Slice B — Teilen an einem Ort

### Ist-Zustand

Drei Teilen-Wege, drei verschiedene Orte, drei verschiedene Darreichungsformen:

| Weg | Ort | Form |
|---|---|---|
| QR + Text | `[id].tsx:750-781` | Modal, geöffnet über die Aktionsleiste (`:1021`) |
| An Person schicken | `[id].tsx:1048-1082` | inline, dauerhaft sichtbar |
| In Haushalt / Private Kopie | `[id].tsx:1084-1151` | inline, dauerhaft sichtbar |

### Was zusammengehört — und was nicht

Ins Modal wandert **nur** „An Person schicken". Grund: QR, Text und
E-Mail-Einladung sind dieselbe Absicht — *dieses Rezept jemand anderem geben*.

„In Haushalt kopieren" und „Private Kopie erstellen" bleiben, wo sie sind. Sie
sind eine andere Absicht — *dieses Rezept in einen anderen meiner eigenen
Bereiche duplizieren*. Sie in denselben Dialog zu legen, würde die drei Wege
verwechselbar machen, und die Semantik unterscheidet sich erheblich:

- **QR** — Offline-Import, der Empfänger braucht kein Konto, kein Rückbezug
- **Text teilen** — reine Kopie, kein Rückbezug, keine Bindung
- **E-Mail-Einladung** — an genau eine Adresse gebunden, erzeugt beim Annehmen
  eine private Kopie beim Empfänger

Diese drei Zeilen gehören sichtbar in den Dialog. Wer sie nicht unterscheiden
kann, teilt etwas anderes als er meint.

### Umbau

Das Modal wird nach `mobile/components/RecipeShareModal.tsx` ausgelagert.
`[id].tsx` hat 1476 Zeilen und würde sonst weiter wachsen. Die Komponente
besitzt die Invite-Eingabe und das Share-Feedback selbst; der Screen reicht das
Rezept sowie `onCreateInvite` durch, damit die Mutation und die
Offline-Prüfung dort bleiben, wo sie heute sind.

Der Auslöser bleibt der bestehende „Teilen"-Button in der Aktionsleiste.

### Testfolgen — der Punkt, der hier zählt

`mobile/test/recipe-detail-sharing.test.tsx` (12 Tests) greift die Invite-Felder
per `testID` **direkt nach dem Render** ab, ohne vorher irgendetwas zu öffnen.
Sobald die Einladung im Modal liegt, schlagen diese Tests fehl.

Die richtige Korrektur ist, in den betroffenen Tests den Öffnen-Schritt zu
ergänzen. Die falsche wäre, die Assertions aufzuweichen oder die Tests zu
löschen — sie decken echte Regressionen ab (Offline-Sperre, Fallback bei
fehlgeschlagenem Versand, Feedback nach erfolgreichem Versand).

`copy-to-household-cta` und `copy-to-private-cta` bleiben unberührt, weil diese
Buttons nicht ins Modal wandern.

**Aufwand:** ~4 h, davon etwa ein Drittel Testnachzug.

---

## Reihenfolge

**C, dann A, dann B.**

C ist der einzige echte Fehler und der kleinste Eingriff. A hat den größten
Alltagsnutzen und ist unabhängig von allem anderen. B ist der größte Umbau mit
der meisten Testarbeit und sollte nicht vor den beiden kleineren liegen.

A und C berühren getrennte Dateien und könnten parallel laufen. B fasst
`[id].tsx` an und sollte allein stehen.

## Ausdrücklich nicht im Scope

- **Konto-Existenz an den Absender melden** — Begründung in Slice C
- **Neue Serverfelder** — alle drei Slices sind reiner Client-Code
- **`OfflineBanner` global machen** — eigener Umbau mit eigener Begründung;
  `recipe-detail-fallbacks.test.tsx:284` sichert bewusst ab, dass er *nicht*
  immer rendert
- **Haushalts-/Privatkopie ins Modal** — Begründung in Slice B
