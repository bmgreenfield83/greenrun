import { vi } from "vitest";

type Route = unknown | ((init?: RequestInit) => Response | unknown);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/**
 * Mocks fetch by URL path (the part after /api, without the query string). Values are JSON
 * bodies, Response objects, or functions receiving the request init. Unknown paths return 404.
 */
export function mockFetchRoutes(routes: Record<string, Route>) {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const path = url.replace(/^.*\/api/, "").split("?")[0];
    const method = (init?.method ?? "GET").toUpperCase();
    const route =
      routes[`${method} ${path}`] ??
      (method === "GET" ? routes[path] : undefined);
    if (route === undefined)
      return Promise.resolve(json({ detail: "Not found" }, 404));
    const value = typeof route === "function" ? route(init) : route;
    return Promise.resolve(value instanceof Response ? value : json(value));
  });
}

export { json as jsonResponse };
