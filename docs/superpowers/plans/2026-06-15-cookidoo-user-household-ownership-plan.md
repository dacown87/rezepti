# Cookidoo User-Default + Optional Household-Share Plan

Datum: 2026-06-15
Status: geplant

## Ziel

Cookidoo-Credentials sollen nicht mehr server-global geteilt sein.

Neue Zielregel:

- Default: `user-scoped`
- Optional: ein User kann die eigenen Cookidoo-Credentials explizit fuer den
  aktiven Haushalt freigeben
- Kein Server-Default und keine globale Singleton-Credential mehr

BYOK/Groq bleibt bewusst der Sonderfall:

- wenn ein User lokal keinen BYOK-Key hinterlegt hat, nutzt der Server weiter
  den konfigurierten `GROQ_API_KEY`
- wenn ein User lokal einen BYOK-Key hinterlegt, wird dieser fuer die Anfrage
  verwendet

## Produktregel

### Cookidoo

- Jeder User startet mit privaten Cookidoo-Credentials.
- In Settings gibt es eine explizite Freigabe-Option fuer den aktiven
  Haushalt.
- Household-Share ist ein aktiver Opt-in, kein implizites Verhalten.
- Bereits vorhandene globale Cookidoo-Credentials werden beim Umstieg
  verworfen, nicht migriert.

### BYOK/Groq

- BYOK bleibt lokal auf dem Geraet/User gespeichert.
- Fehlt lokal ein BYOK-Key, arbeitet die App weiter mit dem Server-Key.
- Diese Ausnahme bleibt in Copy und Doku explizit benannt.

## Scope

- Kleiner Follow-up-Slice fuer Cookidoo-Ownership.
- Datenmodell fuer private und optional haushaltsgeteilte Cookidoo-Credentials.
- API-Regeln fuer lesen, setzen, loeschen und Share-Umschalten.
- Settings-Copy und sichtbare Scope-Anzeige.
- Migrationsregel: globale Altdaten verwerfen.

## Nicht-Ziele

- Kein Pinterest-/Facebook-Rework.
- Keine allgemeine Credential-Plattform fuer beliebige Provider.
- Keine Multi-Household-Share-Matrix ausser "aktiver Haushalt".
- Kein Umbau des BYOK-Speicherorts.

## Zielmodell

### Datenebene

Cookidoo braucht zwei erlaubte Scope-Typen:

- `user`
- `household`

Minimalregel:

- Ein User kann genau einen privaten Cookidoo-Eintrag haben.
- Ein Haushalt kann hoechstens einen geteilten Cookidoo-Eintrag haben.
- Beim Resolve gilt:
  1. privater User-Eintrag gewinnt
  2. sonst aktiver Household-Eintrag
  3. sonst keine Cookidoo-Credentials

## API-Richtung

Zielverhalten:

- `GET /api/v1/cookidoo/status`
  - liefert Scope-Info statt nur `connected`
  - z. B. `scope: 'user' | 'household' | 'none'`
- `POST /api/v1/cookidoo/credentials`
  - speichert privat fuer den eingeloggten User
- `POST /api/v1/cookidoo/credentials/share`
  - uebernimmt die aktuellen User-Credentials in den aktiven Haushalt
- `DELETE /api/v1/cookidoo/credentials`
  - loescht den privaten User-Eintrag
- `DELETE /api/v1/cookidoo/credentials/share`
  - entfernt die Household-Freigabe im aktiven Haushalt

Offene Detailentscheidung fuer Implementierung:

- ob Share nur fuer Household-Owner erlaubt ist oder fuer jedes Mitglied mit
  expliziter Produktfreigabe

Empfehlung:

- Share/Delete-Share nur fuer Household-Owner

## UI-Richtung

Settings soll klar zwischen privat und geteilt unterscheiden:

- Standardtext: "Deine Cookidoo-Zugangsdaten sind privat."
- Wenn Household-Share aktiv ist: "Fuer Haushalt freigegeben."
- Eigener Call-to-Action: "Fuer Haushalt freigeben"
- Eigener Call-to-Action: "Haushaltsfreigabe entfernen"

Wichtig:

- keine Formulierung mehr, die eine globale Server-Verbindung suggeriert
- keine implizite Freigabe beim normalen Speichern

## Migration

Beim Rollout:

- bestehende globale Datei `data/cookidoo-credentials.json` wird verworfen
- bestehende globale Session-Datei wird ebenfalls nicht als gueltiger Shared
  Zustand uebernommen
- User muessen ihre Cookidoo-Daten nach Deploy neu eingeben

Das ist absichtlich die sicherste Regel und vermeidet falsche Zuweisung alter
globaler Secrets.

## Tests

Mindestens noetig:

- User A sieht/mutiert nicht die privaten Cookidoo-Credentials von User B
- User ohne private Credentials kann Household-Share nutzen, falls vorhanden
- privater Eintrag hat Vorrang vor Household-Share
- alte globale Datei wird nicht mehr gelesen
- Status-/UI-Copy spiegelt den echten Scope korrekt

## TODO-Folge

Nach diesem Plan ist Cookidoo kein `server-scoped-singleton` mehr, sondern:

- primaer `user-scoped`
- optional `workspace-scoped` per expliziter Freigabe

BYOK bleibt separat:

- `device-local` mit optionalem Server-Fallback, wenn kein User-Key gesetzt ist
