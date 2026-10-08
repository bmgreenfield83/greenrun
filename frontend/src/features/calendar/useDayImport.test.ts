import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import type { FitImportPreview } from "../../api/fitImports";
import { useDayImport } from "./useDayImport";

afterEach(() => vi.restoreAllMocks());

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const preview = (changes: Partial<FitImportPreview> = {}) =>
  ({
    preview_token: "token-1",
    expires_in_seconds: 1800,
    sample_count: 300,
    duplicate_matches: [],
    suggested_planned_session: null,
    activity: { local_date: "2026-10-08", sport: "run" },
    ...changes,
  }) as FitImportPreview;

const syncItem = (changes: Record<string, unknown> = {}) => ({
  garmin_activity_id: "1001",
  name: "Annapolis Running",
  started_at_local: "2026-10-08 06:15:00",
  distance_meters: 8046,
  status: "ready",
  activity_id: null,
  preview: preview(),
  error: null,
  ...changes,
});

const saved = () =>
  json({
    activity: { id: "a-1", title: "Run" },
    samples_persisted: 300,
  });

function setup() {
  const onImported = vi.fn();
  const hook = renderHook(() => useDayImport(onImported));
  return { onImported, hook };
}

it("pulls the day's runs from Garmin and saves straightforward ones", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      json({ date: "2026-10-08", status: "ready", items: [syncItem()] }),
    )
    .mockResolvedValueOnce(saved());
  const { onImported, hook } = setup();

  await act(() => hook.result.current.importDay("2026-10-08"));

  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
    date: "2026-10-08",
  });
  expect(String(fetchMock.mock.calls[1][0])).toMatch(/import-fit\/confirm$/);
  expect(onImported).toHaveBeenCalledOnce();
  expect(hook.result.current.notice).toEqual({
    severity: "success",
    text: "Imported 1 activity from Garmin.",
  });
  expect(hook.result.current.importing).toBe(false);
  expect(hook.result.current.review).toBeNull();
});

it("queues runs that match a planned workout or a duplicate for review", async () => {
  const suggested = preview({
    preview_token: "token-2",
    suggested_planned_session: {
      planned_session_id: "s-1",
      title: "Easy run",
      scheduled_date: "2026-10-08",
      session_type: "easy",
      score: 120,
    },
  });
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      json({
        date: "2026-10-08",
        status: "ready",
        items: [syncItem({ preview: suggested })],
      }),
    )
    .mockResolvedValueOnce(saved());
  const { onImported, hook } = setup();

  await act(() => hook.result.current.importDay("2026-10-08"));

  expect(hook.result.current.review?.preview_token).toBe("token-2");
  expect(hook.result.current.notice?.text).toBe(
    "1 activity needs a quick review.",
  );
  expect(onImported).not.toHaveBeenCalled();

  await act(() =>
    hook.result.current.confirmReview({
      preview_token: "token-2",
      duplicate_action: "create",
      metadata: {},
    }),
  );

  expect(hook.result.current.review).toBeNull();
  expect(hook.result.current.notice?.text).toBe("Activity imported.");
  expect(onImported).toHaveBeenCalledOnce();
});

it("reports when Garmin has nothing new for the day", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      json({ date: "2026-10-08", status: "no_activities", items: [] }),
    )
    .mockResolvedValueOnce(
      json({
        date: "2026-10-08",
        status: "already_imported",
        items: [syncItem({ status: "already_imported", activity_id: "a-1" })],
      }),
    );
  const { onImported, hook } = setup();

  await act(() => hook.result.current.importDay("2026-10-08"));
  expect(hook.result.current.notice).toEqual({
    severity: "info",
    text: "No runs on Garmin Connect for this day.",
  });

  await act(() => hook.result.current.importDay("2026-10-08"));
  expect(hook.result.current.notice).toEqual({
    severity: "info",
    text: "This day's run is already imported.",
  });
  expect(onImported).not.toHaveBeenCalled();
});

it("explains Garmin download and sign-in failures", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      json({
        date: "2026-10-08",
        status: "failed",
        items: [
          syncItem({
            status: "error",
            preview: null,
            error: "The Garmin download did not contain a FIT file.",
          }),
        ],
      }),
    )
    .mockResolvedValueOnce(
      json(
        {
          error: {
            code: "garmin_setup_required",
            message: "Garmin needs you to sign in again.",
          },
        },
        503,
      ),
    );
  const { hook } = setup();

  await act(() => hook.result.current.importDay("2026-10-08"));
  expect(hook.result.current.notice).toEqual({
    severity: "error",
    text: "1 run could not be downloaded: The Garmin download did not contain a FIT file.",
  });

  await act(() => hook.result.current.importDay("2026-10-08"));
  expect(hook.result.current.notice).toEqual({
    severity: "error",
    text: "Garmin needs you to sign in again.",
  });
});

it("imports an uploaded FIT file and notes when it belongs to another day", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      json(
        preview({
          activity: {
            local_date: "2026-10-06",
            sport: "run",
          } as FitImportPreview["activity"],
        }),
      ),
    )
    .mockResolvedValueOnce(saved());
  const { onImported, hook } = setup();

  await act(() =>
    hook.result.current.importFiles(
      [new File(["fit"], "run.fit")],
      "2026-10-08",
    ),
  );

  expect(onImported).toHaveBeenCalledOnce();
  expect(hook.result.current.notice?.severity).toBe("success");
  expect(hook.result.current.notice?.text).toMatch(
    /^Imported 1 activity from the FIT file\. Saved on Oct 6, 2026, the date in the file\.$/,
  );
});

it("rejects files that are not FIT activities", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch");
  const { hook } = setup();

  await act(() =>
    hook.result.current.importFiles(
      [new File(["x"], "notes.txt")],
      "2026-10-08",
    ),
  );

  expect(fetchMock).not.toHaveBeenCalled();
  expect(hook.result.current.notice).toEqual({
    severity: "error",
    text: "Choose a .fit activity file.",
  });
});
