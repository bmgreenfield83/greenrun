import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { StorageCard } from "./StorageCard";

afterEach(() => vi.restoreAllMocks());

it("shows the configured storage use and warning threshold", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        available: true,
        configured_limit_bytes: 100 * 1024 * 1024,
        estimated_used_bytes: 86 * 1024 * 1024,
        usage_percent: 86,
        warning_threshold: 85,
        collections: [],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <StorageCard />
    </QueryClientProvider>,
  );

  expect(
    await screen.findByText("86.0 MB used of 100.0 MB configured"),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/crossed the 85% warning threshold/),
  ).toBeInTheDocument();
});
