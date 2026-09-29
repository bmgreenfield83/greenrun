import { expect, test } from "@playwright/test";

test("comparable HR chart and source runs work on desktop and mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const isTrend = new URL(route.request().url()).pathname.endsWith(
        "/comparable-heart-rate",
      );
      const runs = [
        {
          activity_id: "a",
          title: "Example steady run",
          local_date: "2026-09-01",
          heart_rate_bpm: 149,
          pace_seconds_per_mile: 600,
          matched_minutes: 10,
          temperature_fahrenheit: 70,
        },
        {
          activity_id: "c",
          title: "Example second steady run",
          local_date: "2026-09-02",
          heart_rate_bpm: 153,
          pace_seconds_per_mile: 602,
          matched_minutes: 5,
          temperature_fahrenheit: 72,
        },
        {
          activity_id: "b",
          title: "Example later run",
          local_date: "2026-09-08",
          heart_rate_bpm: 146,
          pace_seconds_per_mile: 601,
          matched_minutes: 5,
          temperature_fahrenheit: 71,
        },
      ];
      await route.fulfill({
        json: isTrend
          ? {
              algorithm_version: 1,
              start_date: "2026-03-17",
              end_date: "2026-09-12",
              runs_screened: 3,
              qualifying_runs: 3,
              exclusion_counts: {},
              comparisons: [
                {
                  id: "easy:600:10:20",
                  category: "easy",
                  pace_seconds_per_mile: 600,
                  start_minute: 10,
                  end_minute: 20,
                  temperature_min_fahrenheit: 68,
                  temperature_max_fahrenheit: 77,
                  runs,
                  weeks: [
                    {
                      week_start: "2026-08-31",
                      median_heart_rate_bpm: 151,
                      minimum_heart_rate_bpm: 149,
                      maximum_heart_rate_bpm: 153,
                      run_count: 2,
                    },
                    {
                      week_start: "2026-09-07",
                      median_heart_rate_bpm: 146,
                      minimum_heart_rate_bpm: 146,
                      maximum_heart_rate_bpm: 146,
                      run_count: 1,
                    },
                  ],
                },
              ],
            }
          : {
              as_of_date: "2026-09-12",
              rolling_7_day_miles: 5,
              rolling_28_day_miles: 20,
              rolling_90_day_miles: 60,
              weekly_mileage: [],
              plan_progress: null,
              personal_bests: [],
              temperature_bands: [],
              heart_rate_response_history: [],
            },
      });
    },
  );
  await page.goto("/analytics");
  await expect(
    page.getByRole("heading", { name: "Heart rate at comparable pace" }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Pace comparison" }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Weekly comparable heart rate" }),
  ).toContainText("146 bpm");
  await expect(page.locator(".recharts-scatter-symbol")).toHaveCount(2);
  await page.getByText("Contributing runs (3)").click();
  await expect(
    page.getByRole("link", { name: /Example steady run/ }),
  ).toHaveAttribute("href", "/activities/a");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: test.info().outputPath("comparable-heart-rate.png"),
    fullPage: true,
  });
});
