import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { React?: typeof React }).React = React;

const state = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  openBugReportModal: vi.fn(),
}));

vi.mock("expo-router", () => ({
  router: { push: vi.fn() },
  useFocusEffect: (callback: () => void) => callback(),
}));

vi.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: vi.fn(async () => ({ status: "granted" })),
  requestMediaLibraryPermissionsAsync: vi.fn(async () => ({ status: "granted" })),
  launchCameraAsync: vi.fn(async () => ({ canceled: true })),
  launchImageLibraryAsync: vi.fn(async () => ({ canceled: true })),
  MediaTypeOptions: { Images: "Images" },
}));

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async () => null),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => "4"),
  },
}));

vi.mock("@/utils/image-compress", () => ({
  compressIfNeeded: vi.fn(async (value: string) => value),
}));

vi.mock("@/utils/server-url", () => ({
  getServerUrl: vi.fn(async () => "https://api.test"),
}));

vi.mock("@/utils/api", () => ({
  apiFetch: state.apiFetch,
  assertApiOk: vi.fn(async () => undefined),
}));

vi.mock("@/utils/bug-reporting", () => ({
  openBugReportModal: state.openBugReportModal,
}));

vi.mock("@/components/ImagePickerModal", () => ({
  ImagePickerModal: () => null,
}));

vi.mock("lucide-react-native", () => {
  const icon = () => React.createElement("Icon");
  return {
    Globe: icon,
    Camera: icon,
    ImagePlus: icon,
    CheckCircle: icon,
    AlertCircle: icon,
    X: icon,
    UtensilsCrossed: icon,
    Copy: icon,
    Type: icon,
  };
});

vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => React.createElement("SafeAreaView", {}, children),
}));

vi.mock("react-native", () => {
  const wrap = (type: string) => ({ children, ...props }: Record<string, unknown>) =>
    React.createElement(type, props, children as React.ReactNode);

  return {
    View: wrap("View"),
    Text: wrap("Text"),
    TextInput: wrap("TextInput"),
    Pressable: wrap("Pressable"),
    ScrollView: wrap("ScrollView"),
    ActivityIndicator: wrap("ActivityIndicator"),
    Alert: { alert: vi.fn() },
    Image: wrap("Image"),
    Modal: ({ visible = true, children, ...props }: Record<string, unknown>) =>
      visible ? React.createElement("Modal", props, children as React.ReactNode) : null,
    Platform: { OS: "android" },
  };
});

const URL_PLACEHOLDER = "https://youtube.com/watch?v=…";

function makeJobIdResponse(jobId = "job-1") {
  return new Response(JSON.stringify({ jobId }), { status: 200 });
}

async function press(node: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(node);
  });
}

async function startUrlJob() {
  const { default: ExtractScreen } = await import("@/app/(tabs)/extract");
  render(React.createElement(ExtractScreen));

  fireEvent.changeText(screen.getByPlaceholderText(URL_PLACEHOLDER), "https://example.com");
  await press(screen.getByText("Extrahieren"));
}

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("extract job polling failure handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("zeigt den top-level Fehlertext aus failJob an", async () => {
    vi.useFakeTimers();

    state.apiFetch.mockImplementation(async (path: string, opts?: RequestInit) => {
      if (path === "/api/v1/extract/react" && opts?.method === "POST") {
        return makeJobIdResponse();
      }
      if (path.startsWith("/api/v1/extract/react/")) {
        return new Response(
          JSON.stringify({
            status: "failed",
            error: "yt-dlp ist veraltet",
            message: "Inhalte werden abgerufen (facebook)…",
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 200 });
    });

    await startUrlJob();
    await tick(1000);

    expect(screen.getByText("yt-dlp ist veraltet")).toBeTruthy();
    expect(screen.queryByText("Inhalte werden abgerufen (facebook)…")).toBeNull();
  });

  it("beendet das Polling nach einem 404 auf einen zuvor erfolgreichen Job", async () => {
    vi.useFakeTimers();

    let pollCalls = 0;
    state.apiFetch.mockImplementation(async (path: string, opts?: RequestInit) => {
      if (path === "/api/v1/extract/react" && opts?.method === "POST") {
        return makeJobIdResponse();
      }
      if (path.startsWith("/api/v1/extract/react/")) {
        pollCalls++;
        if (pollCalls === 1) {
          return new Response(JSON.stringify({ status: "running", progress: 40 }), { status: 200 });
        }
        return new Response("{}", { status: 404 });
      }
      return new Response("{}", { status: 200 });
    });

    await startUrlJob();

    // Erster Poll: ok, laeuft noch — keine Fehlermeldung
    await tick(1000);
    expect(screen.queryByText(/Import unterbrochen/)).toBeNull();

    // Zweiter Poll: 404 nach einem zuvor erfolgreichen Poll -> terminal
    await tick(1000);
    expect(
      screen.getByText("Import unterbrochen (vermutlich Serverneustart). Bitte erneut versuchen.")
    ).toBeTruthy();

    const callsAtFailure = pollCalls;
    await tick(5000);
    expect(pollCalls).toBe(callsAtFailure);
  });

  it("pollt weiter, wenn der erste Poll 404 liefert", async () => {
    vi.useFakeTimers();

    let pollCalls = 0;
    state.apiFetch.mockImplementation(async (path: string, opts?: RequestInit) => {
      if (path === "/api/v1/extract/react" && opts?.method === "POST") {
        return makeJobIdResponse();
      }
      if (path.startsWith("/api/v1/extract/react/")) {
        pollCalls++;
        return new Response("{}", { status: 404 });
      }
      return new Response("{}", { status: 200 });
    });

    await startUrlJob();
    await tick(3000);

    expect(pollCalls).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText(/Import unterbrochen/)).toBeNull();
    expect(screen.queryByText(/Zeitüberschreitung/)).toBeNull();
  });

  it("bricht nach der Poll-Obergrenze ab", async () => {
    vi.useFakeTimers();

    state.apiFetch.mockImplementation(async (path: string, opts?: RequestInit) => {
      if (path === "/api/v1/extract/react" && opts?.method === "POST") {
        return makeJobIdResponse();
      }
      if (path.startsWith("/api/v1/extract/react/")) {
        return new Response("{}", { status: 500 });
      }
      return new Response("{}", { status: 200 });
    });

    await startUrlJob();

    // MAX_POLL_ATTEMPTS = 900 — der Abbruch greift beim 901. Tick.
    await tick(901 * 1000);

    expect(
      screen.getByText(
        "Zeitüberschreitung beim Import. Der Server hat zu lange nicht geantwortet. Bitte erneut versuchen."
      )
    ).toBeTruthy();
  }, 20000);
});
