import DownloadRounded from "@mui/icons-material/DownloadRounded";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

import { exportPlan, exportRange } from "../api/exports";
import { PageHeader } from "../components/common/PageHeader";
import { listPlans, type TrainingPlan } from "../api/plans";

export function ExportsPage() {
  const [scope, setScope] = useState<"day" | "week" | "month" | "range">(
    "week",
  );
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [planId, setPlanId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [includeAllActivities, setIncludeAllActivities] = useState(false);
  useEffect(() => {
    void listPlans()
      .then((items) => {
        setPlans(items);
        setPlanId(items[0]?.id ?? "");
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);
  const perform = (operation: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    void operation()
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setBusy(false));
  };
  return (
    <Stack spacing={3}>
      <PageHeader
        title="Exports"
        description="Analysis-oriented JSON with exact laps, contextual data, and scope-appropriate sample smoothing. GPS data is never included."
      />
      {error && <Alert severity="error">{error}</Alert>}
      <div>
        <FormControlLabel
          control={
            <Checkbox
              checked={includeAllActivities}
              onChange={(event) =>
                setIncludeAllActivities(event.target.checked)
              }
            />
          }
          label="Include walks, bike rides, and other activity types"
        />
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ pl: { xs: 0, sm: 4 } }}
        >
          Exports include runs only by default. This applies to both exports
          below.
        </Typography>
      </div>
      <Grid container spacing={{ xs: 1.5, sm: 2 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h5" component="h2">
                  Calendar range
                </Typography>
                <TextField
                  select
                  label="Scope"
                  value={scope}
                  onChange={(event) =>
                    setScope(event.target.value as typeof scope)
                  }
                >
                  {(["day", "week", "month", "range"] as const).map((value) => (
                    <MenuItem value={value} key={value}>
                      {value[0].toUpperCase() + value.slice(1)}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label={scope === "month" ? "Any date in month" : "Start date"}
                  type="date"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                {scope === "range" && (
                  <TextField
                    label="End date"
                    type="date"
                    value={end}
                    onChange={(event) => setEnd(event.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                )}
                <Button
                  startIcon={<DownloadRounded />}
                  variant="contained"
                  sx={{ alignSelf: { sm: "flex-start" } }}
                  disabled={busy || !start || (scope === "range" && !end)}
                  onClick={() =>
                    perform(() =>
                      exportRange(scope, start, end, includeAllActivities),
                    )
                  }
                >
                  Download range export
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h5" component="h2">
                  Training plan
                </Typography>
                <TextField
                  select
                  label="Plan"
                  value={planId}
                  onChange={(event) => setPlanId(event.target.value)}
                >
                  {plans.map((plan) => (
                    <MenuItem value={plan.id} key={plan.id}>
                      {plan.name} ({plan.status})
                    </MenuItem>
                  ))}
                </TextField>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadRounded />}
                    disabled={busy || !planId}
                    onClick={() => perform(() => exportPlan(planId))}
                  >
                    Download import-compatible plan
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<DownloadRounded />}
                    disabled={busy || !planId}
                    onClick={() =>
                      perform(() =>
                        exportPlan(planId, true, includeAllActivities),
                      )
                    }
                  >
                    Download plan analysis
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
