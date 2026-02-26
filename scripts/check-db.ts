import { Client } from "@notionhq/client";
import { config } from "../src/config.js";

const notion = new Client({ auth: config.notion.token });

const db = await notion.databases.retrieve({
  database_id: config.notion.databaseId,
});

console.log("DB Title:", (db as any).title?.[0]?.plain_text);
console.log("Properties:", Object.keys((db as any).properties));
console.log(JSON.stringify((db as any).properties, null, 2));
