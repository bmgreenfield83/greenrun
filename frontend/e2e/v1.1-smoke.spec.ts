import { expect, test, type Page } from "@playwright/test";

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

const fitPreview = {
  preview_token: "token",
  activity: {
    sport: "run",
    category: "easy",
    title: "Run",
    local_date: "2026-08-05",
    distance_meters: 5000,
    elapsed_time_seconds: 1800,
    summary: {},
    laps: [],
    subjective: {},
    planned_session_id: null,
  },
  sample_count: 100,
  duplicate_matches: [],
  suggested_planned_session: null,
};

async function mockApi(page: Page) {
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      if (path.endsWith("/health/ready"))
        return route.fulfill(json({ status: "ready", database: "connected" }));
      if (path.endsWith("/analytics/summary"))
        return route.fulfill(
          json({
            as_of_date: "2026-08-05",
            rolling_7_day_miles: 5,
            rolling_28_day_miles: 20,
            rolling_90_day_miles: 60,
            weekly_mileage: [],
            plan_progress: null,
            personal_bests: [],
            temperature_bands: [],
            drift_history: [],
          }),
        );
      if (path.endsWith("/calendar"))
        return route.fulfill(
          json({
            events: [
              {
                id: "p1",
                kind: "planned_session",
                title: "Easy run",
                date: "2026-08-05",
                sport: "run",
                status: "planned",
                activity_id: null,
                planned_session_id: "s1",
              },
              {
                id: "a1",
                kind: "activity",
                title: "Bike",
                date: "2026-08-05",
                sport: "bike",
                status: "completed",
                activity_id: "a1",
                completed_duration_seconds: 1200,
                completed_average_speed_mps: 5,
              },
            ],
          }),
        );
      if (path.endsWith("/plans"))
        return route.fulfill(json({ items: [], total: 0 }));
      if (path.endsWith("/activities/garmin-sync"))
        return route.fulfill(
          json({
            date: "2026-08-05",
            status: "ready",
            items: [
              {
                garmin_activity_id: "1001",
                name: "Annapolis Running",
                started_at_local: "2026-08-05 06:15:00",
                distance_meters: 5000,
                status: "ready",
                activity_id: null,
                preview: fitPreview,
                error: null,
              },
            ],
          }),
        );
      if (path.includes("/activities/import-fit/preview"))
        return route.fulfill(json(fitPreview));
      if (path.includes("/activities/import-fit/confirm"))
        return route.fulfill(
          json(
            {
              activity: { id: "new-activity", title: "Run" },
              samples_persisted: 100,
            },
            201,
          ),
        );
      if (path.endsWith("/activities"))
        return route.fulfill(json({ items: [], total: 0 }));
      if (path.endsWith("/settings/storage"))
        return route.fulfill(
          json({
            available: true,
            configured_limit_bytes: 536870912,
            estimated_used_bytes: 1000,
            usage_percent: 0.1,
            warning_threshold: null,
            collections: [],
          }),
        );
      return route.fulfill(json({}));
    },
  );
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("primary navigation reaches the major workflows", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Today" })).toBeVisible();
  for (const [label, heading] of [
    ["Calendar", "Training calendar"],
    ["Analytics", "Analytics"],
    ["Plans", "Training plans"],
  ]) {
    const mobile = page.getByRole("navigation", { name: "Mobile navigation" });
    const header = page.getByRole("navigation", { name: "Primary navigation" });
    if (await mobile.isVisible()) {
      const tab = mobile.getByRole("link", { name: label, exact: true });
      if (await tab.count()) await tab.click();
      else {
        await mobile.getByRole("button", { name: "More" }).click();
        await page.getByRole("menuitem", { name: label, exact: true }).click();
      }
    } else if (await header.isVisible()) {
      await header.getByRole("link", { name: label, exact: true }).click();
    } else {
      const section = page.getByRole("navigation", {
        name: "Section navigation",
      });
      const link = section.getByRole("link", { name: label, exact: true });
      if (await link.count()) await link.click();
      else {
        await section.getByRole("button", { name: "More" }).click();
        await page.getByRole("menuitem", { name: label, exact: true }).click();
      }
    }
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
  }
});

test("calendar visibility controls work", async ({ page }) => {
  await page.goto("/calendar");
  const plannedEvent = page.getByLabel("Easy run, 2026-08-05, planned");
  const completedEvent = page.getByLabel("Bike, 2026-08-05, completed");
  await expect(plannedEvent).toBeVisible();
  await page.getByRole("switch").first().uncheck();
  await expect(plannedEvent).toBeHidden();
  await expect(completedEvent).toBeVisible();
});

// The day drawer opens straight away; wait for the day's events before using its import controls.
async function openDay(page: Page) {
  await page.goto("/calendar?date=2026-08-05");
  await expect(page.getByRole("heading", { name: "Easy run" })).toBeVisible();
}

test("a calendar day imports its run from Garmin", async ({ page }) => {
  await openDay(page);
  await page
    .getByRole("button", { name: "Import activity", exact: true })
    .click();
  await expect(
    page.getByText("Imported 1 activity from Garmin."),
  ).toBeVisible();
});

test("a calendar day still accepts an uploaded FIT file", async ({ page }) => {
  await openDay(page);
  await page
    .getByLabel("FIT activity files")
    .first()
    .setInputFiles({
      name: "activity.fit",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("synthetic-fit"),
    });
  await expect(
    page.getByText("Imported 1 activity from the FIT file."),
  ).toBeVisible();
});
