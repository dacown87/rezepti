import { describe, it, expect } from "vitest";
import { parseIngredient } from "../../src/processors/ingredient-parser.js";

describe("parseIngredient", () => {
  // ─── Grundlegende Fälle ───────────────────────────────────────────────────

  it('parst "200 g Mehl"', () => {
    expect(parseIngredient("200 g Mehl")).toMatchObject({ amount: 200, unit: "g", food: "Mehl" });
  });

  it('parst "1 EL Olivenöl"', () => {
    expect(parseIngredient("1 EL Olivenöl")).toMatchObject({ amount: 1, unit: "EL", food: "Olivenöl" });
  });

  it('parst "2 TL Zucker"', () => {
    expect(parseIngredient("2 TL Zucker")).toMatchObject({ amount: 2, unit: "TL", food: "Zucker" });
  });

  it('parst "500 ml Milch"', () => {
    expect(parseIngredient("500 ml Milch")).toMatchObject({ amount: 500, unit: "ml", food: "Milch" });
  });

  it('parst "1,5 kg Fleisch" (deutsche Dezimalkomma)', () => {
    expect(parseIngredient("1,5 kg Fleisch")).toMatchObject({ amount: 1.5, unit: "kg", food: "Fleisch" });
  });

  // ─── Ohne Einheit ─────────────────────────────────────────────────────────

  it('parst "3 Eier" ohne Einheit', () => {
    expect(parseIngredient("3 Eier")).toMatchObject({ amount: 3, unit: null, food: "Eier" });
  });

  it('parst "1 Prise Salz"', () => {
    expect(parseIngredient("1 Prise Salz")).toMatchObject({ amount: 1, unit: "Prise", food: "Salz" });
  });

  it('parst "2 Zehen Knoblauch"', () => {
    expect(parseIngredient("2 Zehen Knoblauch")).toMatchObject({ amount: 2, unit: "Zehen", food: "Knoblauch" });
  });

  it('parst "1 Bund Petersilie"', () => {
    expect(parseIngredient("1 Bund Petersilie")).toMatchObject({ amount: 1, unit: "Bund", food: "Petersilie" });
  });

  it('parst "1 Dose Tomaten"', () => {
    expect(parseIngredient("1 Dose Tomaten")).toMatchObject({ amount: 1, unit: "Dose", food: "Tomaten" });
  });

  // ─── Bruchzahlen ─────────────────────────────────────────────────────────

  it('parst "1/2 l Brühe"', () => {
    expect(parseIngredient("1/2 l Brühe")).toMatchObject({ amount: 0.5, unit: "l", food: "Brühe" });
  });

  it('parst "1 1/2 EL Butter" (gemischte Zahl)', () => {
    expect(parseIngredient("1 1/2 EL Butter")).toMatchObject({ amount: 1.5, unit: "EL", food: "Butter" });
  });

  it('parst "3/4 Tasse Mehl"', () => {
    expect(parseIngredient("3/4 Tasse Mehl")).toMatchObject({ amount: 0.75, unit: "Tasse", food: "Mehl" });
  });

  // ─── Unicode-Brüche ───────────────────────────────────────────────────────

  it('parst "½ TL Salz" (Unicode-Bruch)', () => {
    expect(parseIngredient("½ TL Salz")).toMatchObject({ amount: 0.5, unit: "TL", food: "Salz" });
  });

  it('parst "¼ Tasse Zucker"', () => {
    expect(parseIngredient("¼ Tasse Zucker")).toMatchObject({ amount: 0.25, unit: "Tasse", food: "Zucker" });
  });

  it('parst "¾ l Gemüsebrühe"', () => {
    expect(parseIngredient("¾ l Gemüsebrühe")).toMatchObject({ amount: 0.75, unit: "l", food: "Gemüsebrühe" });
  });

  it('parst "1½ EL Honig" (Ganzzahl + Unicode-Bruch)', () => {
    expect(parseIngredient("1½ EL Honig")).toMatchObject({ amount: 1.5, unit: "EL", food: "Honig" });
  });

  // ─── Notes ────────────────────────────────────────────────────────────────

  it('extrahiert note aus Klammer: "2 Zwiebeln (gehackt)"', () => {
    const r = parseIngredient("2 Zwiebeln (gehackt)");
    expect(r).toMatchObject({ amount: 2, unit: null, food: "Zwiebeln", note: "gehackt" });
  });

  it('extrahiert note nach Komma: "100 g Mehl, gesiebt"', () => {
    const r = parseIngredient("100 g Mehl, gesiebt");
    expect(r).toMatchObject({ amount: 100, unit: "g", food: "Mehl", note: "gesiebt" });
  });

  it('extrahiert Klammer-note mit Gewicht: "1 Dose Tomaten (400 g)"', () => {
    const r = parseIngredient("1 Dose Tomaten (400 g)");
    expect(r).toMatchObject({ amount: 1, unit: "Dose", food: "Tomaten", note: "400 g" });
  });

  // ─── Range ───────────────────────────────────────────────────────────────

  it('nimmt ersten Wert aus Range "3-4 Kartoffeln" und speichert Range als note', () => {
    const r = parseIngredient("3-4 Kartoffeln");
    expect(r.amount).toBe(3);
    expect(r.unit).toBeNull();
    expect(r.food).toBe("Kartoffeln");
    expect(r.note).toContain("3");
    expect(r.note).toContain("4");
  });

  // ─── Kein Betrag ─────────────────────────────────────────────────────────

  it('gibt amount: null für "etwas Salz"', () => {
    const r = parseIngredient("etwas Salz");
    expect(r.amount).toBeNull();
    expect(r.unit).toBeNull();
    expect(r.food).toBe("etwas Salz");
  });

  it('gibt amount: null für "nach Geschmack"', () => {
    const r = parseIngredient("nach Geschmack");
    expect(r.amount).toBeNull();
    expect(r.food).toBe("nach Geschmack");
  });
});
