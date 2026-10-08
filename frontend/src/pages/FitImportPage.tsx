import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import CloudUploadRounded from "@mui/icons-material/CloudUploadRounded";
import ErrorOutlineRounded from "@mui/icons-material/ErrorOutlineRounded";
import PendingRounded from "@mui/icons-material/PendingRounded";
import SyncRounded from "@mui/icons-material/SyncRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useRef, useState } from "react";
import { Link } from "wouter";

import { PageHeader } from "../components/common/PageHeader";
import {
  confirmFitImport,
  previewFitImport,
  type ConfirmFitImport,
  type FitImportPreview,
} from "../api/fitImports";
import {
  syncFromGarmin,
  type GarminSyncItem,
  type GarminSyncResult,
} from "../api/garminSync";
import { clearActivityListState } from "../features/activities/activityListState";
import { FitImportPreviewDialog } from "../features/activities/FitImportPreviewDialog";
import { isoDate } from "../features/dashboard/dashboardDates";

type QueueStatus =
  "queued" | "previewing" | "needs_review" | "saving" | "imported" | "error";

// A queued activity comes from an uploaded FIT file or from a Garmin Connect sync.
type QueueItem = {
  id: string;
  name: string;
  file?: File;
  garminActivityId?: string;
  status: QueueStatus;
  preview?: FitImportPreview;
  activityId?: string;
  error?: string;
};

const statusLabel: Record<QueueStatus, string> = {
  queued: "Queued",
  previewing: "Reading",
  needs_review: "Review needed",
  saving: "Saving",
  imported: "Imported",
  error: "Could not import",
};

export function FitImportPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [syncDate, setSyncDate] = useState(() => isoDate(new Date()));
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncOutcome | null>(null);

  const updateItem = (id: string, changes: Partial<QueueItem>) =>
    setQueue((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );

  const processItem = async (item: QueueItem) => {
    if (!item.file) return;
    updateItem(item.id, { status: "previewing", error: undefined });
    try {
      await importPreview(item, await previewFitImport(item.file));
    } catch (reason) {
      updateItem(item.id, {
        status: "error",
        error:
          reason instanceof Error
            ? reason.message
            : "The FIT file could not be imported.",
      });
    }
  };

  // Straightforward activities save straight away; duplicates and possible plan links wait for review.
  const importPreview = async (item: QueueItem, preview: FitImportPreview) => {
    try {
      if (
        preview.duplicate_matches.length > 0 ||
        preview.suggested_planned_session
      ) {
        updateItem(item.id, { status: "needs_review", preview });
        setReviewId((current) => current ?? item.id);
        return;
      }
      updateItem(item.id, { status: "saving", preview });
      const result = await confirmFitImport({
        preview_token: preview.preview_token,
        duplicate_action: "create",
        metadata: {},
      });
      clearActivityListState();
      updateItem(item.id, {
        status: "imported",
        activityId: result.activity.id,
      });
    } catch (reason) {
      updateItem(item.id, {
        status: "error",
        error:
          reason instanceof Error
            ? reason.message
            : "The activity could not be imported.",
      });
    }
  };

  const addFiles = (files: File[]) => {
    const fitFiles = files.filter((file) =>
      file.name.toLowerCase().endsWith(".fit"),
    );
    const added = fitFiles.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      name: file.name,
      file,
      status: "queued" as const,
    }));
    if (!added.length) return;
    setQueue((current) => [...current, ...added]);
    added.forEach((item) => void processItem(item));
    if (fileInput.current) fileInput.current.value = "";
  };

  const confirmReview = async (payload: ConfirmFitImport) => {
    if (!reviewId) return;
    updateItem(reviewId, { status: "saving", error: undefined });
    try {
      const result = await confirmFitImport(payload);
      clearActivityListState();
      updateItem(reviewId, {
        status: "imported",
        activityId: result.activity.id,
      });
      setReviewId(null);
    } catch (reason) {
      updateItem(reviewId, {
        status: "needs_review",
        error:
          reason instanceof Error
            ? reason.message
            : "The activity could not be saved.",
      });
    }
  };

  const syncGarmin = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncFromGarmin(syncDate);
      // A run still in the queue from an earlier sync is not queued twice.
      const queued = new Set(
        queue
          .filter((item) => item.garminActivityId && item.status !== "error")
          .map((item) => item.garminActivityId),
      );
      const fresh = result.items.filter(
        (item) =>
          item.status !== "already_imported" &&
          !queued.has(item.garmin_activity_id),
      );
      const added: QueueItem[] = fresh.map((item) => ({
        id: `garmin-${item.garmin_activity_id}-${Date.now()}`,
        name: item.name ?? `Garmin activity ${item.garmin_activity_id}`,
        garminActivityId: item.garmin_activity_id,
        status: item.status === "error" ? "error" : "saving",
        preview: item.preview ?? undefined,
        error: item.error ?? undefined,
      }));
      setQueue((current) => [...current, ...added]);
      setSyncResult({
        result,
        requeued:
          fresh.length <
          result.items.filter((item) => item.status !== "already_imported")
            .length,
      });
      added.forEach((item) => {
        if (item.preview) void importPreview(item, item.preview);
      });
    } catch (reason) {
      setSyncResult({
        error:
          reason instanceof Error
            ? reason.message
            : "The Garmin sync failed. Try again shortly.",
      });
    } finally {
      setSyncing(false);
    }
  };

  const completed = queue.filter((item) => item.status === "imported").length;
  const failed = queue.filter((item) => item.status === "error").length;
  const needsReview = queue.filter(
    (item) => item.status === "needs_review",
  ).length;
  const active = queue.some((item) =>
    ["queued", "previewing", "saving"].includes(item.status),
  );
  const reviewItem = queue.find((item) => item.id === reviewId);

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Import Garmin FIT"
        description="Add one or more FIT files. Straightforward activities save automatically; only duplicates and possible planned-workout links pause for review."
      />

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems={{ sm: "center" }}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6">Sync from Garmin Connect</Typography>
                <Typography variant="body2" color="text.secondary">
                  Pull a day's runs straight from Garmin. Runs already in
                  Greenrun are skipped.
                </Typography>
              </Box>
              <TextField
                type="date"
                label="Activity date"
                size="small"
                value={syncDate}
                onChange={(event) => setSyncDate(event.target.value)}
                disabled={syncing}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <Button
                variant="contained"
                startIcon={
                  syncing ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <SyncRounded />
                  )
                }
                disabled={syncing || !syncDate}
                onClick={() => void syncGarmin()}
              >
                {syncing ? "Syncing…" : "Sync from Garmin"}
              </Button>
            </Stack>
            {syncResult && <SyncMessage outcome={syncResult} />}
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Box
            data-testid="fit-drop-zone"
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              addFiles(Array.from(event.dataTransfer.files));
            }}
            sx={{
              border: "2px dashed",
              borderColor: dragging ? "primary.main" : "divider",
              bgcolor: dragging ? "action.hover" : "transparent",
              borderRadius: "6px",
              p: 4,
              textAlign: "center",
              transition: "150ms ease",
            }}
          >
            <Stack spacing={1.5} alignItems="center">
              <CloudUploadRounded color="primary" sx={{ fontSize: 42 }} />
              <Typography variant="h6">Drop Garmin FIT files here</Typography>
              <Typography color="text.secondary">
                or select them from your computer
              </Typography>
              <input
                ref={fileInput}
                hidden
                multiple
                type="file"
                accept=".fit,application/octet-stream"
                aria-label="Garmin FIT files"
                onChange={(event) =>
                  addFiles(Array.from(event.target.files ?? []))
                }
              />
              <Button
                variant="contained"
                startIcon={<CloudUploadRounded />}
                onClick={() => fileInput.current?.click()}
              >
                Select FIT files
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {queue.length > 0 && (
        <Card variant="outlined">
          {active && <LinearProgress />}
          <CardContent>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                  Import queue
                </Typography>
                <Chip color="success" label={`${completed} imported`} />
                {needsReview > 0 && (
                  <Chip color="warning" label={`${needsReview} need review`} />
                )}
                {failed > 0 && (
                  <Chip color="error" label={`${failed} failed`} />
                )}
              </Stack>
              {queue.map((item) => (
                <Stack
                  key={item.id}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  alignItems={{ sm: "center" }}
                  sx={{ borderTop: "1px solid", borderColor: "divider", pt: 2 }}
                >
                  {item.status === "imported" ? (
                    <CheckCircleRounded color="success" />
                  ) : item.status === "error" ? (
                    <ErrorOutlineRounded color="error" />
                  ) : (
                    <PendingRounded
                      color={
                        item.status === "needs_review" ? "warning" : "action"
                      }
                    />
                  )}
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography fontWeight={700} noWrap>
                      {item.name}
                    </Typography>
                    <Typography
                      variant="body2"
                      color={item.error ? "error" : "text.secondary"}
                    >
                      {item.error ?? statusLabel[item.status]}
                    </Typography>
                    {item.preview && (
                      <Typography variant="caption" color="text.secondary">
                        {item.preview.activity.sport.replaceAll("_", " ")} ·{" "}
                        {item.preview.activity.local_date}
                      </Typography>
                    )}
                  </div>
                  {item.status === "needs_review" && (
                    <Button
                      variant="outlined"
                      onClick={() => setReviewId(item.id)}
                    >
                      Review
                    </Button>
                  )}
                  {item.status === "error" && item.file && (
                    <Button onClick={() => void processItem(item)}>
                      Retry
                    </Button>
                  )}
                  {item.activityId && (
                    <Button
                      component={Link}
                      href={`/activities/${item.activityId}`}
                      startIcon={<VisibilityRounded />}
                    >
                      View activity
                    </Button>
                  )}
                </Stack>
              ))}
              {!active && needsReview === 0 && (
                <Alert severity={failed ? "warning" : "success"}>
                  Import complete: {completed} imported
                  {failed ? `, ${failed} failed` : ""}.
                </Alert>
              )}
              <Button
                sx={{ alignSelf: "flex-start" }}
                onClick={() => fileInput.current?.click()}
              >
                Import another
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {reviewItem?.preview && (
        <FitImportPreviewDialog
          key={reviewItem.id}
          preview={reviewItem.preview}
          saving={reviewItem.status === "saving"}
          error={reviewItem.error ?? null}
          onCancel={() => setReviewId(null)}
          onConfirm={(payload) => void confirmReview(payload)}
        />
      )}
    </Stack>
  );
}

type SyncOutcome =
  | { result: GarminSyncResult; requeued: boolean; error?: undefined }
  | { error: string; result?: undefined };

const dayLabel = (date: string) =>
  new Date(`${date}T00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const runs = (count: number) => `${count} run${count === 1 ? "" : "s"}`;

function ImportedLinks({ items }: { items: GarminSyncItem[] }) {
  const imported = items.filter(
    (item) => item.status === "already_imported" && item.activity_id,
  );
  if (!imported.length) return null;
  return (
    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
      {imported.map((item) => (
        <Button
          key={item.garmin_activity_id}
          size="small"
          component={Link}
          href={`/activities/${item.activity_id}`}
          startIcon={<VisibilityRounded />}
        >
          {item.name ?? "View activity"}
        </Button>
      ))}
    </Stack>
  );
}

function SyncMessage({ outcome }: { outcome: SyncOutcome }) {
  if (outcome.error !== undefined)
    return <Alert severity="error">{outcome.error}</Alert>;
  const { result } = outcome;
  const day = dayLabel(result.date);
  const count = (status: GarminSyncItem["status"]) =>
    result.items.filter((item) => item.status === status).length;
  const ready = count("ready");
  const failed = count("error");
  const imported = count("already_imported");
  if (result.status === "no_activities")
    return <Alert severity="info">No runs on Garmin Connect for {day}.</Alert>;
  if (result.status === "already_imported")
    return (
      <Alert severity="info">
        {imported === 1
          ? `The run from ${day} is already in Greenrun.`
          : `All ${runs(imported)} from ${day} are already in Greenrun.`}
        <ImportedLinks items={result.items} />
      </Alert>
    );
  if (result.status === "failed")
    return (
      <Alert severity="error">
        Garmin found {runs(failed)} for {day}, but{" "}
        {failed === 1 ? "it" : "they"} could not be downloaded. The import queue
        below has the details.
      </Alert>
    );
  return (
    <Alert severity={failed ? "warning" : "success"}>
      Found {runs(ready)} to import from {day}
      {outcome.requeued ? " (some were already in the queue)" : ""}.
      {imported ? ` ${runs(imported)} already in Greenrun.` : ""}
      {failed ? ` ${runs(failed)} could not be downloaded.` : ""}
      <ImportedLinks items={result.items} />
    </Alert>
  );
}
