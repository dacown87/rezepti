import { config } from "../src/config.js";
import { ensureDatabase } from "../src/notion.js";

console.log("Token vorhanden:", !!config.notion.token);
console.log("Parent Page:", config.notion.parentPageId);

try {
  const dbId = await ensureDatabase();
  console.log("Datenbank erstellt! ID:", dbId);
} catch (e: any) {
  console.error("Fehler:", e.message);
  if (e.body) console.error("Details:", e.body);
}
