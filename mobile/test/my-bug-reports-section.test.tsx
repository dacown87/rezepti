import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { React?: typeof React }).React = React;

const state = vi.hoisted(() => ({
  fetchMyBugReports: vi.fn(),
}));

vi.mock("@/utils/bug-reporting", () => ({
  fetchMyBugReports: state.fetchMyBugReports,
  getBugReportStatusLabel: (status: string) => status,
}));

vi.mock("lucide-react-native", () => ({
  Bug: () => React.createElement("Icon"),
}));

vi.mock("react-native", () => {
  const wrap = (type: string) => ({ children, ...props }: Record<string, unknown>) =>
    React.createElement(type, props, children as React.ReactNode);

  return {
    View: wrap("View"),
    Text: wrap("Text"),
    Pressable: wrap("Pressable"),
    ActivityIndicator: wrap("ActivityIndicator"),
  };
});

describe("MyBugReportsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a signed-out hint when disabled", async () => {
    const { default: MyBugReportsSection } = await import("@/components/settings/MyBugReportsSection");
    render(React.createElement(MyBugReportsSection, { enabled: false }));

    expect(screen.getByText(/Melde dich an/)).toBeTruthy();
    expect(state.fetchMyBugReports).not.toHaveBeenCalled();
  });

  it("renders fetched reports with status and description", async () => {
    state.fetchMyBugReports.mockResolvedValue([
      {
        id: "r1",
        reportType: "general",
        status: "resolved",
        description: "Screen hängt",
        route: "/settings",
        sourceArea: "global_button",
        createdAt: "2026-06-20T10:00:00.000Z",
        updatedAt: "2026-06-20T10:00:00.000Z",
      },
    ]);

    const { default: MyBugReportsSection } = await import("@/components/settings/MyBugReportsSection");
    render(React.createElement(MyBugReportsSection, { enabled: true }));

    await waitFor(() => {
      expect(screen.getByText("Screen hängt")).toBeTruthy();
      expect(screen.getByText("resolved")).toBeTruthy();
    });
  });
});
