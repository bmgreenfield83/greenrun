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
      screen.getByRole("heading", { name: "Greenrun" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Primary navigation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to dashboard" }),
    ).toHaveAttribute("href", "/");
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const mobileNavigation = screen.getByRole("navigation", {
      name: "Mobile navigation",
    });
    expect(mobileNavigation).toBeInTheDocument();
    expect(
      within(mobileNavigation).getByRole("link", {
        name: "Settings",
      }),
    ).toHaveAttribute("href", "/settings");
    fireEvent.click(screen.getByRole("button", { name: "Close navigation" }));
    expect(
      screen.getByRole("button", {
        name: "Open navigation",
        hidden: true,
      }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(await screen.findByText("Connected")).toBeInTheDocument();
  });
});
