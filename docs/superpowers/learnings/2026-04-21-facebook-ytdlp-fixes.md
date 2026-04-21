# Learnings: Facebook-Fetcher & yt-dlp (2026-04-21)

## yt-dlp: `error.stderr` nicht ausgewertet

**Problem:** `execFileAsync` legt yt-dlp-Fehlermeldungen in `error.stderr`, nicht in `error.message`. Alle bisherigen Error-Checks im Facebook-Fetcher (`errorMsg.includes("Private")` etc.) griffen nie.

**Fix:** `const errorMsg = (error.message || "") + " " + (error.stderr || "");`

**How to apply:** Bei allen `execFileAsync`-Aufrufen immer `error.stderr` mit auswerten.

---

## Facebook Share-URLs (`/share/r/`, `/share/v/`) nicht als Video erkannt

**Problem:** `isFacebookVideoUrl()` kannte `/share/r/` (Reel) und `/share/v/` (Video) nicht → fiel auf OG-Fallback zurück, der von Facebook blockiert wird (JS-only Seite).

**Fix:** Pattern `/facebook\.com\/share\/[rv]\//i` zur Erkennungsliste hinzugefügt.

---

## yt-dlp veraltet → "No video formats found" für öffentliche Facebook-Reels

**Problem:** yt-dlp 2024.04.09 (lokal, 2 Jahre alt) kann öffentliche Facebook-Reels nicht mehr abrufen. Facebook hat die API geändert. Neuere yt-dlp-Versionen unterstützen das wieder.

**Fix:** `Dockerfile` → `pip3 install --upgrade yt-dlp` statt ohne Flag. Wird bei jedem Docker-Build auf neueste Version aktualisiert.

**Wichtig:** Lokal kann yt-dlp mit `pip3 install --upgrade yt-dlp` oder `yt-dlp -U` aktualisiert werden.

---

## Foto-Import: `toUserFriendlyError()` fehlte

**Problem:** `processPhotoJobInBackground` fing Fehler roh auf — kein `toUserFriendlyError()`, kein `hint`. Groq-Fehler beim Foto-Import zeigten rohe Error-Messages statt der übersetzten Nutzer-Meldung.

**Fix:** `toUserFriendlyError` aus `pipeline.ts` exportiert und im Photo-Job-Catch-Block verwendet.

**How to apply:** Jeder neue Background-Job der Fehler an `failJob` weitergibt muss `toUserFriendlyError` nutzen.
