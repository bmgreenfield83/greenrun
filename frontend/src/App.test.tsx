import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";

afterEach(() => vi.restoreAllMocks());

describe("application shell", () => {
  it("renders navigation and a connected backend state", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "ready", database: "connected" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>,
    );

    expect(
      screen.getByRole("link", { name: "Go to dashboard" }),
    ).toHaveAttribute("href", "/");
    expect(screen.getByTestId("scene-background")).toHaveAttribute(
      "data-scene",
      "trail",
    );

    // The scene toggle hides everything but the background, then brings it back.
    const toggle = screen.getByRole("button", { name: "Hide UI" });
    fireEvent.click(toggle);
    expect(screen.getByTestId("app-ui")).not.toBeVisible();
    expect(toggle).toHaveAccessibleName("Show UI");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(toggle);
    expect(screen.getByTestId("app-ui")).toBeVisible();

    // Desktop header lists every destination; the current page is marked.
    const primary = screen.getByRole("navigation", {
      name: "Primary navigation",
    });
    expect(within(primary).getAllByRole("link")).toHaveLength(8);
    expect(
      within(primary).getByRole("link", { name: "Dashboard" }),
    ).toHaveAttribute("aria-current", "page");

    // Phone tab bar: five main destinations plus a More menu for the rest.
    const mobile = screen.getByRole("navigation", {
      name: "Mobile navigation",
    });
    expect(
      within(mobile)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Dashboard", "Calendar", "Activities", "Analytics", "Plans"]);
    const more = within(mobile).getByRole("button", { name: "More" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("menu");
    expect(
      within(menu).getByRole("menuitem", { name: "Settings" }),
    ).toHaveAttribute("href", "/settings");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["Import", "Exports", "Settings"]);
    expect(await screen.findByText("Connected")).toBeInTheDocument();
  });
});
