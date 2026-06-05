# Recipes Household Ownership Design

Datum: 2026-06-05
Status: Design-Entscheidung fuer Folgeslice

## Ziel

Rezepte werden langfristig nicht als globale Vorlagen modelliert. Ein Rezept
gehoert immer entweder einem privaten User oder einem Haushalt. Sharing erzeugt
eine Kopie mit neuem Owner, keinen gemeinsamen Besitz am selben Datensatz.

Diese Spec entscheidet das Zielmodell fuer den spaeteren Household-Recipe-Slice.
Der aktuell laufende Recipes-Privacy-Slice bleibt eine Zwischenstufe: eigene
Rezepte plus noch sichtbare Defaults. Der Household-Slice entfernt die
Legacy-/Default-Semantik.

## Entscheidungen

1. Rezepte koennen privat oder haushaltsbezogen sein.
2. Neue und importierte Rezepte sind standardmaessig privat.
3. Ein privates Rezept darf nicht direkt in Haushalts-Planner oder
   Haushalts-Shopping referenziert werden.
4. Wenn ein privates Rezept im Haushalt genutzt werden soll, wird bewusst eine
   Haushaltskopie erstellt.
5. Alle Haushaltsmitglieder duerfen Haushaltsrezepte lesen und bearbeiten.
6. Teilen bedeutet Kopieren in einen Ziel-User oder Ziel-Haushalt.
7. Es gibt langfristig keine globalen Rezepte oder globalen Templates.
8. Bestehende `user_id is null` Rezepte gelten als Test-/Legacy-Daten und
   duerfen fuer diese Migration resetet oder geloescht werden.
9. Der erste Household-Recipe-Slice bekommt keine Admin-/Moderationsrechte fuer
   Rezeptinhalte.
10. Favoritenlisten/Collections werden eigene Owner-Objekte und koennen privat
    oder haushaltsbezogen sein.

## Datenmodell Richtung

`recipes` braucht eine explizite Ownership-Schicht statt der bisherigen
mehrdeutigen `user_id is null` Regel.

Empfohlene Felder:

- `owner_type`: `user` oder `household`
- `owner_user_id`: gesetzt, wenn `owner_type = 'user'`
- `household_id`: gesetzt, wenn `owner_type = 'household'`
- `created_by`: User, der das Rezept erstellt oder importiert hat

Invarianten:

- Genau einer der beiden Owner-Pfade ist gesetzt.
- `created_by` ist Audit-Kontext, nicht Sichtbarkeitsgrenze.
- Private Rezepte sind nur fuer `owner_user_id` sichtbar.
- Haushaltsrezepte sind fuer Mitglieder von `household_id` sichtbar.
- `user_id is null` ist nach der Migration kein gueltiger Sichtbarkeitszustand.

## Sharing und Kopien

Sharing veraendert nie den Owner des Originals. Stattdessen wird ein neuer
Rezeptdatensatz erstellt:

- Privat zu Haushalt: neues Haushaltsrezept mit `household_id`.
- Haushalt zu privat: neue private Kopie mit `owner_user_id`.
- Haushalt zu anderem Haushalt: neue Haushaltskopie im Zielhaushalt.
- Privat zu anderem User: neue private Kopie fuer den Zieluser, falls ein
  expliziter Share-/Accept-Flow spaeter gebaut wird.

Das verhindert ueberraschende gemeinsame Bearbeitungen und macht Loeschen,
Planner-Referenzen und Datenschutz einfacher.

## Planner und Shopping

Haushalts-Planner und Haushalts-Shopping duerfen nur Rezepte referenzieren, die
fuer den Haushalt sichtbar und haushaltsbezogen sind.

Regeln:

- Private Rezepte koennen nicht direkt in den Haushalts-Planner gelegt werden.
- Die UI oder API muss vorher eine Haushaltskopie erzeugen.
- Server-Validierung prueft bei Planner-/Shopping-Mutationen, dass `recipe_id`
  zum aktiven Haushalt gehoert.
- Fremde private und fremde Haushaltsrezepte liefern `404`, nicht `403`, damit
  Existenz nicht geleakt wird.

## Favoriten und Collections

Favoriten werden nicht als Feld am Rezept gespeichert. Sie sind eigene
Beziehungen in privaten oder haushaltsbezogenen Collections.

Richtung:

- `recipe_collections`: Owner ist User oder Haushalt.
- `recipe_collection_items`: referenziert Recipes, auf die der Collection-Owner
  Zugriff hat.
- Private Collections duerfen private Rezepte und erreichbare Haushaltsrezepte
  referenzieren.
- Haushalts-Collections duerfen nur Haushaltsrezepte desselben Haushalts
  referenzieren.

Collections sind ein Folgeslice und blockieren den Household-Recipe-Slice nicht,
sollen aber das Recipe-Modell nicht nachtraeglich verbiegen muessen.

## Migration

Die Migration darf hart sein:

- Bestehende `user_id is null` Rezepte duerfen in Dev/Staging/aktueller Ziel-DB
  geloescht oder resetet werden.
- Es braucht keinen Claim-Flow fuer alte Rezeptdaten.
- Nach dem Reset koennen Constraints streng sein.
- Keine Legacy-Kompatibilitaet fuer Null-Owner im Servercode behalten.

Vor Production-Anwendung muss trotzdem explizit bestaetigt werden, dass die
Ziel-DB keine erhaltenswerten Null-Owner-Rezepte enthaelt.

## API-Verhalten

Neue/importierte Rezepte:

- Standard-Owner ist der eingeloggte User privat.
- Optionaler Ziel-Haushalt darf nur gesetzt werden, wenn der User Mitglied ist.

Reads:

- User sieht private eigene Rezepte.
- User sieht Haushaltsrezepte seiner Haushalte.
- Fremde Rezepte sind unsichtbar und liefern bei Detailzugriff `404`.

Writes:

- Private Rezepte darf nur der Owner bearbeiten oder loeschen.
- Haushaltsrezepte duerfen alle Haushaltsmitglieder bearbeiten oder loeschen.
- Admins bekommen im ersten Slice keine Sonderrechte auf Rezeptinhalte.

## RLS und Tests

RLS kann spaeter fuer `recipes` geoeffnet werden, wenn Server- und Datenmodell
stehen. Bis dahin bleibt die Server-API die primaere Grenze.

Pflichttests fuer den Household-Slice:

- User A sieht eigene private Rezepte.
- User B sieht User-A-private Rezepte nicht.
- User A und User B sehen ein gemeinsames Haushaltsrezept, wenn beide Mitglied
  sind.
- Nicht-Mitglieder sehen Haushaltsrezepte nicht.
- Haushaltsmitglieder koennen Haushaltsrezepte bearbeiten.
- Private Rezepte koennen nicht direkt in den Haushalts-Planner.
- Kopieren von privat zu Haushalt erzeugt einen neuen Datensatz.
- Nach Migration existieren keine sichtbaren Null-Owner-Rezepte.

## Nicht-Ziele

- Kein Admin-Recipe-Editor.
- Keine globalen Templates.
- Kein Public-Rezeptkatalog.
- Kein Legacy-Claim-Flow.
- Keine pro-Rezept-Rollen im ersten Household-Slice.
- Keine Shared-Mutable-Rezepte ueber mehrere Haushalte hinweg.
