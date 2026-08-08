#!/usr/bin/env npx tsx
/**
 * Duenner Runner fuer den yt-dlp Health Check. Die gesamte Logik lebt in
 * scripts/ytdlp-health-check.ts, das bewusst keine Top-Level-Seiteneffekte
 * hat, damit es in Unit-Tests ueber einen normalen statischen Import
 * mitgenommen werden kann, ohne main() (und damit einen echten yt-dlp-Aufruf)
 * auszuloesen.
 *
 * Ausführen: npm run ytdlp:health
 */
import { main } from "./ytdlp-health-check.js";

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error("Unerwarteter Fehler im Health Check:", error);
    process.exit(1);
  });
