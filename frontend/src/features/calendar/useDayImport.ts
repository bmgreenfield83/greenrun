import { useState } from "react";

import {
  confirmFitImport,
  previewFitImport,
  type ConfirmFitImport,
  type FitImportPreview,
} from "../../api/fitImports";
import { syncFromGarmin } from "../../api/garminSync";
import { localDateLabel } from "../activities/format";

export type ImportNotice = {
  severity: "success" | "info" | "warning" | "error";
  text: string;
};

const message = (reason: unknown, fallback: string) =>
  reason instanceof Error ? reason.message : fallback;

const runs = (count: number) => `${count} run${count === 1 ? "" : "s"}`;
const activities = (count: number) =>
  `${count} ${count === 1 ? "activity" : "activities"}`;

/**
 * Imports activities for a calendar day: pulls the day's runs from Garmin Connect (or reads FIT files
 * the user picks), saves straightforward ones at once, and queues duplicates and possible planned-workout
 * links for the review dialog. `onImported` runs after anything is saved so the calendar can refresh.
 */
export function useDayImport(onImported: () => unknown) {
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<ImportNotice | null>(null);
  const [reviews, setReviews] = useState<FitImportPreview[]>([]);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Saves previews that need no decision; returns how many saved and the first failure, if any.
  const saveStraightforward = async (previews: FitImportPreview[]) => {
    let saved = 0;
    let failure: string | null = null;
    const needsReview: FitImportPreview[] = [];
    for (const preview of previews) {
      if (
        preview.duplicate_matches.length ||
        preview.suggested_planned_session
      ) {
        needsReview.push(preview);
        continue;
      }
      try {
        await confirmFitImport({
          preview_token: preview.preview_token,
          duplicate_action: "create",
          metadata: {},
        });
        saved++;
      } catch (reason) {
        failure ??= message(reason, "The activity could not be saved.");
      }
    }
    if (needsReview.length)
      setReviews((current) => [...current, ...needsReview]);
    if (saved) await onImported();
    return { saved, review: needsReview.length, failure };
  };

  const summarize = (
    source: string,
    result: { saved: number; review: number; failure: string | null },
    extra: string[] = [],
  ): ImportNotice => {
    const parts = [
      result.saved
        ? `Imported ${activities(result.saved)} from ${source}.`
        : "",
      result.review
        ? `${activities(result.review)} need${result.review === 1 ? "s" : ""} a quick review.`
        : "",
      ...extra,
      result.failure ?? "",
    ].filter(Boolean);
    return {
      severity: result.failure ? "warning" : result.saved ? "success" : "info",
      text: parts.join(" "),
    };
  };

  const run = async (work: () => Promise<ImportNotice | null>) => {
    setImporting(true);
    setNotice(null);
    try {
      setNotice(await work());
    } catch (reason) {
      setNotice({
        severity: "error",
        text: message(reason, "The import failed. Try again shortly."),
      });
    } finally {
      setImporting(false);
    }
  };

  const importDay = (date: string) =>
    run(async () => {
      const sync = await syncFromGarmin(date);
      if (sync.status === "no_activities")
        return {
          severity: "info",
          text: "No runs on Garmin Connect for this day.",
        };
      if (sync.status === "already_imported")
        return {
          severity: "info",
          text:
            sync.items.length === 1
              ? "This day's run is already imported."
              : "All of this day's runs are already imported.",
        };
      const failed = sync.items.filter((item) => item.status === "error");
      const previews = sync.items.flatMap((item) =>
        item.preview ? [item.preview] : [],
      );
      const result = await saveStraightforward(previews);
      const extra = failed.length
        ? [`${runs(failed.length)} could not be downloaded: ${failed[0].error}`]
        : [];
      if (!previews.length) return { severity: "error", text: extra.join(" ") };
      return summarize("Garmin", result, extra);
    });

  const importFiles = (files: File[], date: string) =>
    run(async () => {
      const fit = files.filter((file) =>
        file.name.toLowerCase().endsWith(".fit"),
      );
      if (!fit.length)
        return { severity: "error", text: "Choose a .fit activity file." };
      const previews: FitImportPreview[] = [];
      let readFailure: string | null = null;
      for (const file of fit) {
        try {
          previews.push(await previewFitImport(file));
        } catch (reason) {
          readFailure ??= `${file.name}: ${message(reason, "could not be read.")}`;
        }
      }
      const elsewhere = [
        ...new Set(
          previews
            .map((preview) => preview.activity.local_date)
            .filter((local) => local !== date),
        ),
      ];
      const result = await saveStraightforward(previews);
      const extra = [
        elsewhere.length
          ? `Saved on ${elsewhere.map((local) => localDateLabel(local)).join(", ")}, the date in the file.`
          : "",
        readFailure ?? "",
      ];
      if (!previews.length)
        return { severity: "error", text: readFailure ?? "" };
      return summarize(
        fit.length === 1 ? "the FIT file" : "the FIT files",
        result,
        extra,
      );
    });

  const confirmReview = async (payload: ConfirmFitImport) => {
    setReviewSaving(true);
    setReviewError(null);
    try {
      await confirmFitImport(payload);
      setReviews((current) => current.slice(1));
      setNotice({ severity: "success", text: "Activity imported." });
      await onImported();
    } catch (reason) {
      setReviewError(message(reason, "The activity could not be saved."));
    } finally {
      setReviewSaving(false);
    }
  };

  const cancelReview = () => {
    setReviews((current) => current.slice(1));
    setReviewError(null);
  };

  return {
    importing,
    notice,
    clearNotice: () => setNotice(null),
    importDay,
    importFiles,
    review: reviews[0] ?? null,
    reviewSaving,
    reviewError,
    confirmReview,
    cancelReview,
  };
}
