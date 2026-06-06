import { describe, it, expect, vi } from "vitest";

const mockFetchChefkoch = vi.fn();
const mockFetchWeb = vi.fn();
const mockExtractRecipeFromText = vi.fn();
const mockSaveRecipeToReactDb = vi.fn();
const mockCreateTempDir = vi.fn(() => "/tmp/rezepti-test");
const mockCleanupTempDir = vi.fn();

vi.mock("../../src/fetchers/chefkoch.js", () => ({
  fetchChefkoch: mockFetchChefkoch,
}));

vi.mock("../../src/fetchers/web.js", () => ({
  fetchWeb: mockFetchWeb,
}));

vi.mock("../../src/fetchers/youtube.js", () => ({
  fetchYouTube: vi.fn(),
}));

vi.mock("../../src/fetchers/instagram.js", () => ({
  fetchInstagram: vi.fn(),
}));

vi.mock("../../src/fetchers/tiktok.js", () => ({
  fetchTikTok: vi.fn(),
}));

vi.mock("../../src/fetchers/cookidoo.js", () => ({
  fetchCookidoo: vi.fn(),
}));

vi.mock("../../src/fetchers/pinterest.js", () => ({
  fetchPinterest: vi.fn(),
}));

vi.mock("../../src/fetchers/facebook.js", () => ({
  fetchFacebook: vi.fn(),
}));

vi.mock("../../src/processors/llm.js", () => ({
  extractRecipeFromText: mockExtractRecipeFromText,
  extractRecipeFromImage: vi.fn(),
  extractRecipeFromImages: vi.fn(),
  refineRecipe: vi.fn(),
  estimateNutrition: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../src/processors/whisper.js", () => ({
  transcribeAudio: vi.fn(),
}));

vi.mock("../../src/db-react.js", () => ({
  saveRecipeToReactDb: mockSaveRecipeToReactDb,
}));

vi.mock("../../src/temp.js", () => ({
  createTempDir: mockCreateTempDir,
  cleanupTempDir: mockCleanupTempDir,
}));

const { processURL } = await import("../../src/pipeline.js");

describe("processURL Chefkoch routing", () => {
  it("uses the dedicated Chefkoch fetcher instead of the generic web fetcher", async () => {
    const url = "https://www.chefkoch.de/rezepte/123456/test.html";
    const recipe = {
      name: "Chefkoch Rezept",
      duration: "kurz",
      tags: ["Test"],
      emoji: "🍽️",
      calories: 100,
      servings: "2",
      imageUrl: "",
      ingredients: ["200 g Mehl"],
      steps: ["Alles mischen."],
    };

    mockFetchChefkoch.mockResolvedValue({
      url,
      type: "chefkoch",
      title: "Chefkoch Rezept",
      description: "",
      textContent: "Dies ist ein Chefkoch Rezept mit mehr als fünfzig Zeichen und Zutaten.",
      imageUrls: [],
      schemaRecipe: null,
    });
    mockExtractRecipeFromText.mockResolvedValue(recipe);
    mockSaveRecipeToReactDb.mockResolvedValue(42);

    const result = await processURL(url, vi.fn(), {
      userId: "00000000-0000-0000-0000-000000000001",
    });

    expect(result.success).toBe(true);
    expect(mockFetchChefkoch).toHaveBeenCalledWith(url);
    expect(mockFetchWeb).not.toHaveBeenCalled();
    expect(mockSaveRecipeToReactDb).toHaveBeenCalledWith(recipe, url, undefined, {
      owner: { type: "user", userId: "00000000-0000-0000-0000-000000000001" },
      createdBy: "00000000-0000-0000-0000-000000000001",
    });
  });
});
