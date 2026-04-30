# Phase 13 Sample-Test — Ergebnisse & Analyse

**Datum:** 2026-04-29  
**Getestete URLs:** 19 (diverse Quellen: DB-Rezepte + bekannte Food-Sites)  
**Script:** `scripts/sample-test.ts` | Rohdaten: `scripts/sample-test-results.json`

---

## Ergebnisse

| URL | Domain | Status | Notiz |
|-----|--------|--------|-------|
| chefkoch.de/rezepte/2220831…Philly-Cheese-Steak-Sandwich | chefkoch.de | ✅ json-ld-full | DB-Rezept |
| chefkoch.de/rezepte/3336651…Marinierte-Spareribs | chefkoch.de | ✅ json-ld-full | DB-Rezept |
| bbcgoodfood.com/recipes/chocolate-chunk-cookies | bbcgoodfood.com | ✅ json-ld-full | DB-Rezept |
| perfekterezepte.duasureayet.com/blitz-nudel-hackfleisch-pfanne/ | unbekannter Blog | 🔶 css-fallback | css=article |
| foodnetwork.com/recipes/…perfect-scrambled-eggs | foodnetwork.com | 🔶 css-fallback | css=main |
| tasteofhome.com/recipes/banana-bread/ | tasteofhome.com | ✅ json-ld-full | |
| delish.com/cooking/recipe-ideas/… | delish.com | ✅ json-ld-full | |
| spendwithpennies.com/banana-bread/ | spendwithpennies.com | ✅ json-ld-full | |
| minimalistbaker.com/strawberry-chia-pudding/ | minimalistbaker.com | ✅ json-ld-full | WPRM |
| minimalistbaker.com/vegan-chickpea-taco-salad/ | minimalistbaker.com | ✅ json-ld-full | WPRM |
| allrecipes.com/recipe/10813/… | allrecipes.com | 💥 HTTP 403 | Bot-Schutz |
| simplyrecipes.com/recipes/perfect_guacamole/ | simplyrecipes.com | 💥 HTTP 403 | Bot-Schutz |
| seriouseats.com/…chocolate-chip-cookies | seriouseats.com | 💥 HTTP 403 | Bot-Schutz |
| ichkoche.at/baerlauchpesto-rezept-13208 | ichkoche.at | 🔶 css-fallback | **has-microdata** |
| ichkoche.at/spargelcremesuppe-rezept-13355 | ichkoche.at | 🔶 css-fallback | **has-microdata** |
| gutekueche.at/nudelauflauf-mit-schinken-rezept-22672 | gutekueche.at | ✅ json-ld-full | |
| gutekueche.at/kraeutersuppe-rezept-12713 | gutekueche.at | ✅ json-ld-full | |
| lecker.de/spaghetti-carbonara-73542.html | lecker.de | 🔶 css-fallback | css=main |
| lidl-kochen.de/rezeptwelt/spaghetti-carbonara-2841 | lidl-kochen.de | ❌ no-json-ld | body-fallback |

---

## Zusammenfassung

| Status | Anzahl | % |
|--------|--------|---|
| ✅ JSON-LD vollständig | 10 | 53% |
| 🔶 CSS-Fallback (LLM nötig) | 5 | 26% |
| ❌ Kein JSON-LD/CSS (body-fallback) | 1 | 5% |
| 💥 Fehler / Bot-Schutz | 3 | 16% |

**Ohne LLM direkt nutzbar: 53%**  
**Benötigt LLM-Fallback: 32% (CSS + body)**  
**Blockiert (403): 16%**

---

## Kritische Befunde

### 1. Microdata bei ichkoche.at — klarer ROI für 13b

ichkoche.at bettet Schema.org-Daten als **HTML Microdata** (`itemprop`-Attribute) ein, nicht als JSON-LD. Der CSS-Selektor `[itemtype*="schema.org/Recipe"]` matched den Microdata-Container — aber wir lesen ihn als rohen Text statt die `itemprop`-Attribute zu parsen.

**Was wir verlieren:** Strukturierte Zutaten, Schritte, Name, Dauer — alles steht sauber im HTML, wir ignorieren es.  
**Was wir stattdessen bekommen:** Unstrukturierter Text aus dem Container → LLM-Extraktion nötig.  
**Fix:** 13b (Microdata-Support) — `extractMicrodataRecipe()` in `web.ts`.

### 2. CSS-Fallback funktioniert, aber mit falschen Selektoren

Für foodnetwork.com (css=`main`) und lecker.de (css=`main`) matcht unser Fallback auf `main` — das ist das gesamte Seitenlayout, nicht nur den Rezeptbereich. Besser wäre ein spezifischer Selektor. Food Network hat z.B. `.o-RecipeIntro` und `.o-Method` im DOM.

**ROI 13a:** Die 5 CSS-Fallback-Sites könnten mit besseren Selektoren weniger Rauschen an den LLM schicken. Moderate Verbesserung.

### 3. Wild-Mode (13e) — kein Fund in diesem Sample

Kein einziger Fall wo JSON-LD in einem `<script>` mit falschem type oder in `window.__NUXT__` steckte. ROI für 13e ist in diesem Sample nicht messbar.

**Empfehlung:** 13e bleibt geplant (andere Sites außerhalb dieses Samples können davon profitieren), aber Priorität senken gegenüber 13b.

### 4. Bot-Schutz (403) ist kein Schema-Problem

allrecipes.com, simplyrecipes.com, seriouseats.com sind mit HTTP 403 blockiert. Das ist Cloudflare/WAF-Schutz — kein CSS-Selektor oder Microdata-Parser hilft hier. Diese 3 Sites (16% des Samples) brauchen andere Lösungen (Puppeteer, Cookies, Proxies — außerhalb von Phase 13).

### 5. Lidl Kochen — body-fallback

lidl-kochen.de liefert nur den Body als Text, kein strukturiertes Format. Damit geht alles an den LLM — teuer und langsam. Guter Kandidat für 13h (ML-Fallback) wenn implementiert.

---

## ROI-Neubewertung für Phase 13

| Item | ROI aus Sample | Befund |
|------|---------------|--------|
| **13b Microdata** | **HOCH** | 2 Sites belegt, structured data ist da, wir lesen es falsch |
| **13a CSS-Selektoren** | Moderat | 5 Sites CSS-Fallback, bestehende Selektoren deckeln schon viel |
| **13c Fehlermeldungen** | — | Bot-403 sollte besser kommuniziert werden (neue Kategorie!) |
| **13e Wild-Mode** | Niedrig | 0 Kandidaten im Sample — spekulative Verbesserung |
| **13h ML-Fallback** | — | 1 body-fallback (lidl-kochen) — zu klein für ROI-Aussage |
| **13f Scraper-Validierung** | — | Gilt für CSS-Fallback-Fälle, wo Ergebnis unvollständig sein kann |

**Priorisierungsänderung:** 13b (Microdata) sollte in Wave 2 erste Priorität haben. 13e (Wild-Mode) bleibt aber nachrangig.

---

## Neue Fehlerkategorie: Bot-Schutz (403)

Die 403-Fälle zeigen, dass `toUserFriendlyError()` (13c) einen neuen Fall braucht:

```
"Diese Website erlaubt kein automatisches Abrufen (Bot-Schutz aktiv). 
Versuche die URL direkt zu öffnen und den Rezepttext manuell einzufügen."
```

Das führt direkt zum 13g-Freitext-Import als Lösung für User — guter Cross-Link!

---

## Vergleich mit Planung

| Prämisse aus Plan | Sample-Befund |
|------------------|---------------|
| CSS-Selektoren fehlen → Extraktion scheitert | ✅ Bestätigt (5 Sites), aber bestehende Selektoren greifen schon |
| Microdata-Sites vorhanden | ✅ Klar bestätigt (ichkoche.at) |
| Wild-Mode findet Schema in JS-Bundles | ❌ Nicht gefunden in diesem Sample |
| Bot-Schutz ist Infrastruktur-Problem | ✅ Bestätigt (allrecipes, seriouseats) |

---

## Nächste Schritte (aus Analyse)

1. **13b zuerst in Wave 2** — klarer Microdata-ROI
2. **13c um Bot-403-Meldung erweitern** — neue Fehlerkategorie identifiziert
3. **13a** — moderate Priorität, hauptsächlich bessere Selektoren für `main`-Fallback-Sites
4. **13e** — niedrigere Priorität, erst nach 13b/13a
