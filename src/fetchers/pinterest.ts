import type { ContentBundle } from "../types.js";

export async function fetchPinterest(_url: string): Promise<ContentBundle> {
  throw new Error(
    "Pinterest-Import ist noch nicht implementiert. Bitte nutze vorerst die URL-Extraktion über den Web-Importer."
  );
}
