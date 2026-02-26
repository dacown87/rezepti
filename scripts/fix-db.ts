import { config } from "../src/config.js";

const res = await fetch(`https://api.notion.com/v1/databases/${config.notion.databaseId}`, {
  method: "PATCH",
  headers: {
    "Authorization": `Bearer ${config.notion.token}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
  },
  body: JSON.stringify({
    properties: {
      Name: { title: {} },
      Zubereitungsdauer: {
        select: {
          options: [
            { name: "kurz", color: "green" },
            { name: "mittel", color: "yellow" },
            { name: "lang", color: "red" },
          ],
        },
      },
      Tags: { multi_select: {} },
      Foto: { url: {} },
      Quelle: { url: {} },
      Ausprobiert: { checkbox: {} },
      Kalorien: { number: { format: "number" } },
    },
  }),
});

const data = await res.json();
if (res.ok) {
  console.log("Properties gesetzt:", Object.keys(data.properties));
} else {
  console.error("Fehler:", JSON.stringify(data, null, 2));
}
