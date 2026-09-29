import DownloadRounded from "@mui/icons-material/DownloadRounded";
import UploadFileRounded from "@mui/icons-material/UploadFileRounded";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useRef, useState } from "react";

import { PageHeader } from "../components/common/PageHeader";
import {
  confirmPlanImport,
  downloadBlankPlan,
  previewPlanImport,
  type PlanImportPreview,
} from "../api/plans";
import { localDateLabel } from "../features/activities/format";
import { PlanLibrary } from "../features/plans/PlanLibrary";

export function PlansPage() {
  const input = useRef<HTMLInputElement>(null);
  const [template, setTemplate] = useState<unknown>(null);
  const [filename, setFilename] = useState("");
  const [startDate, setStartDate] = useState("");
  const [preview, setPreview] = useState<PlanImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const readFile = async (file?: File) => {
    if (!file) return;
    setError(null);
    try {
      setTemplate(JSON.parse(await file.text()));
      setFilename(file.name);
    } catch {
      setTemplate(null);
      setError("The selected file is not valid JSON.");
    }
  };

  const makePreview = async () => {
    if (!template) {
      setError("Choose a plan JSON file.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setPreview(await previewPlanImport(template, startDate));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The plan could not be validated.",
      );
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const result = await confirmPlanImport(
        preview.preview_token,
        Boolean(preview.conflict),
      );
      setSuccess(
        `Plan imported with ${result.sessions_created} planned sessions.`,
      );
      setPreview(null);
      setTemplate(null);
      setFilename("");
      setRefreshKey((current) => current + 1);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The plan could not be imported.",
      );
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    try {
      const blob = await downloadBlankPlan();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "blank-training-plan.json";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Download failed.");
    }
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Training plans"
        description="Import a strict dated plan, or choose any date in the first week of an undated plan."
      />
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={3}>
            <Typography variant="h5" component="h2">
              Import new plan
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <input
                ref={input}
                hidden
                type="file"
                accept="application/json,.json"
                aria-label="Training plan JSON file"
                onChange={(event) => void readFile(event.target.files?.[0])}
              />
              <Button
                variant="outlined"
                startIcon={<UploadFileRounded />}
                onClick={() => input.current?.click()}
                sx={{ minWidth: 0, overflowWrap: "anywhere" }}
              >
                {filename || "Choose plan JSON"}
              </Button>
              <Button
                startIcon={<DownloadRounded />}
                onClick={() => void download()}
              >
                Download blank template
              </Button>
            </Stack>
            <TextField
              label="First-week date override (optional)"
              helperText="Choose any date in week 1; plan weeks remain Monday–Sunday."
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ maxWidth: { sm: 320 } }}
            />
            <Button
              variant="contained"
              sx={{ alignSelf: { sm: "flex-start" } }}
              disabled={busy || !template}
              onClick={() => void makePreview()}
            >
              Validate and preview
            </Button>
          </Stack>
        </CardContent>
      </Card>
      <PlanLibrary refreshKey={refreshKey} />
      {preview && (
        <Dialog
          open
          fullWidth
          maxWidth="sm"
          onClose={busy ? undefined : () => setPreview(null)}
        >
          <DialogTitle>Plan import preview</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              {preview.conflict && (
                <Alert severity="warning">
                  Importing this plan will archive the active plan “
                  {preview.conflict.active_plan_name}”
                  {preview.conflict.dates_overlap
                    ? " because their dates overlap."
                    : "."}
                </Alert>
              )}
              <Typography variant="h6">{preview.name}</Typography>
              <Grid container spacing={2}>
                <Grid size={6}>
                  <Typography color="text.secondary">Weeks</Typography>
                  <Typography>{preview.number_of_weeks}</Typography>
                </Grid>
                <Grid size={6}>
                  <Typography color="text.secondary">Sessions</Typography>
                  <Typography>{preview.planned_session_count}</Typography>
                </Grid>
                <Grid size={6}>
                  <Typography color="text.secondary">Dates</Typography>
                  <Typography>
                    {localDateLabel(preview.start_date)} –{" "}
                    {localDateLabel(preview.end_date)}
                  </Typography>
                </Grid>
                <Grid size={6}>
                  <Typography color="text.secondary">
                    Planned running
                  </Typography>
                  <Typography>
                    {preview.total_planned_running_miles.toFixed(1)} mi
                  </Typography>
                </Grid>
              </Grid>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPreview(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              color={preview.conflict ? "warning" : "primary"}
              variant="contained"
              onClick={() => void confirm()}
              disabled={busy}
            >
              {preview.conflict ? "Archive old plan and import" : "Import plan"}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Stack>
  );
}
