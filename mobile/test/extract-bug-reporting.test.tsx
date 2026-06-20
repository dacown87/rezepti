import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

async function press(node: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(node);
  });
}

describe("extract bug reporting integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.apiFetch.mockResolvedValue(new Response(JSON.stringify({ error: "kaputt" }), { status: 500 }));
  });

  it("opens an import_failure bug report after a failed URL extraction", async () => {
    const { default: ExtractScreen } = await import("@/app/(tabs)/extract");
    render(React.createElement(ExtractScreen));

    fireEvent.changeText(screen.getByPlaceholderText("https://youtube.com/watch?v=…"), "https://example.com");
    await press(screen.getByText("Extrahieren"));

    await waitFor(() => {
      expect(screen.getByText("kaputt")).toBeTruthy();
    });

    await press(screen.getByText("Problem melden"));

    expect(state.openBugReportModal).toHaveBeenCalledWith(expect.objectContaining({
      reportType: "import_failure",
      sourceArea: "import_error",
      route: "/(tabs)/extract",
      metadata: expect.objectContaining({
        importMode: "url",
        errorMessage: "kaputt",
        lastFailureSnapshot: expect.objectContaining({
          mode: "url",
          errorMessage: "kaputt",
        }),
      }),
    }));
  });
});
