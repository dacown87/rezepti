import type { ContentBundle } from "../types.js";

export async function fetchFacebook(_url: string): Promise<ContentBundle> {
  throw new Error(
    "Facebook-Import ist noch nicht implementiert. Bitte nutze vorerst die URL-Extraktion über den Web-Importer."
  );
}
