import { describe, expect, it } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { app } from "../../src/index.js";

// Der Expo-Web-Export unter public/ ist seit 2026-08-07 ein Build-Artefakt und
// nicht mehr eingecheckt. Ohne vorherigen `npm run build:mobile` gibt es keine
// gehashten Assets, die dieser Test pruefen koennte. Die reale Auslieferung
// deckt der e2e-legacy-soak-Job ab, der den Export vor dem Serverstart baut.
const hasExpoExport = existsSync("public/assets/public");

describe("static asset serving", () => {
  it.skipIf(!hasExpoExport)("serves an existing Expo hashed logo asset", async () => {
    const hashedLogo = readdirSync("public/assets/public").find((name) =>
      /^Logo\.[a-f0-9]+\.png$/i.test(name),
    );

    expect(hashedLogo).toBeTruthy();

    const response = await app.request(`/assets/public/${hashedLogo}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it("falls back from missing top-level Logo asset paths to public/Logo.png", async () => {
    const response = await app.request("/assets/Logo.missing-hash.png");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
    expect(response.headers.get("cache-control")).toBe("no-cache, no-store, must-revalidate");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it("returns 404 instead of SPA HTML for unrelated missing assets", async () => {
    const response = await app.request("/assets/not-the-logo.missing.js");
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(body).toBe("Not found");
    expect(body).not.toContain("<!DOCTYPE html>");
  });
});
