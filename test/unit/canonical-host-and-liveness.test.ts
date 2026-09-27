import { describe, expect, it } from "vitest";
import { app } from "../../src/index.js";

describe("canonical host redirect", () => {
  it("redirects the apex domain to www and keeps path and query", async () => {
    const response = await app.request("/recipe/42?tab=steps", {
      headers: { host: "recipedeckapp.de" },
    });

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://www.recipedeckapp.de/recipe/42?tab=steps");
  });

  it("uses 308 for non-GET requests so method and body survive", async () => {
    const response = await app.request("/api/v1/recipes", {
      method: "POST",
      headers: { host: "RecipeDeckApp.de:443", "content-type": "application/json" },
      body: "{}",
    });

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://www.recipedeckapp.de/api/v1/recipes");
  });

  it("leaves www and other hosts alone", async () => {
    for (const host of ["www.recipedeckapp.de", "p01--rezepti-app--2s7hvlwm5zc5.code.run", "localhost:3000"]) {
      const response = await app.request("/assets/not-the-logo.missing.js", { headers: { host } });
      expect(response.status, host).toBe(404);
    }
  });
});

describe("liveness endpoint", () => {
  it("answers without touching the database", async () => {
    const response = await app.request("/api/v1/health/live");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ server: true, status: "alive" });
  });
});
