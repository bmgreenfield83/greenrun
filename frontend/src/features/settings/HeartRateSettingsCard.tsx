import FavoriteRounded from "@mui/icons-material/FavoriteRounded";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

import {
  getSettings,
  updateHeartRateSettings,
  type AppSettings,
} from "../../api/settings";
import { SectionTitle } from "../../components/common/SectionTitle";
import { ZoneTable } from "../analytics/ZoneTable";
import {
  heartRateReserveZones,
  parseBpm,
  validateHeartRates,
} from "./heartRateSettings";

const asText = (value: number | null | undefined) =>
  value == null ? "" : String(value);

/** Max and resting heart rate (optional) and the resulting heart-rate-reserve zones. */
export function HeartRateSettingsCard() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [maximum, setMaximum] = useState("");
  const [resting, setResting] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getSettings(controller.signal)
      .then((value) => {
        setSettings(value);
        setMaximum(asText(value.max_heart_rate_bpm));
        setResting(asText(value.resting_heart_rate_bpm));
      })
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setLoadError(reason.message);
      });
    return () => controller.abort();
  }, []);

  const errors = validateHeartRates(maximum, resting);
  const valid = !errors.maximum && !errors.resting;
  const parsedMaximum = parseBpm(maximum);
  const parsedResting = parseBpm(resting);
  const changed =
    settings !== null &&
    (maximum !== asText(settings.max_heart_rate_bpm) ||
      resting !== asText(settings.resting_heart_rate_bpm));
  const zones =
    valid &&
    typeof parsedMaximum === "number" &&
    typeof parsedResting === "number"
      ? heartRateReserveZones(parsedMaximum, parsedResting)
      : null;

  const save = async () => {
    setTouched(true);
    if (!valid || parsedMaximum === "invalid" || parsedResting === "invalid")
      return;
    setBusy(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await updateHeartRateSettings({
        max_heart_rate_bpm: parsedMaximum,
        resting_heart_rate_bpm: parsedResting,
      });
      setSettings(updated);
      setMaximum(asText(updated.max_heart_rate_bpm));
      setResting(asText(updated.resting_heart_rate_bpm));
      setSaved(true);
    } catch (reason) {
      setSaveError(
        reason instanceof Error
          ? reason.message
          : "Settings could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  };

  const showErrors = touched || changed;
  return (
    <Card variant="outlined" sx={{ maxWidth: 760, width: "100%", mx: "auto" }}>
      <CardContent>
        <Stack spacing={2}>
          <SectionTitle icon={<FavoriteRounded color="secondary" />}>
            Heart rate
          </SectionTitle>
          <Typography variant="body2" color="text.secondary">
            Used for heart-rate-reserve zones, time in zones, and training load.
            Leave a field blank to clear it; those analytics then ask you to set
            both values.
          </Typography>
          {loadError && <Alert severity="warning">{loadError}</Alert>}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Max heart rate (bpm)"
                value={maximum}
                disabled={!settings}
                onChange={(event) => {
                  setMaximum(event.target.value);
                  setSaved(false);
                }}
                onBlur={() => setTouched(true)}
                error={showErrors && Boolean(errors.maximum)}
                helperText={(showErrors && errors.maximum) || "100–230 bpm"}
                slotProps={{ htmlInput: { inputMode: "numeric" } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Resting heart rate (bpm)"
                value={resting}
                disabled={!settings}
                onChange={(event) => {
                  setResting(event.target.value);
                  setSaved(false);
                }}
                onBlur={() => setTouched(true)}
                error={showErrors && Boolean(errors.resting)}
                helperText={
                  (showErrors && errors.resting) || "25–120 bpm, lower than max"
                }
                slotProps={{ htmlInput: { inputMode: "numeric" } }}
              />
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button
              variant="contained"
              disabled={!settings || busy || !changed || !valid}
              onClick={() => void save()}
            >
              Save heart rate
            </Button>
            {saved && (
              <Typography variant="body2" color="success.main" role="status">
                Saved.
              </Typography>
            )}
          </Stack>
          {saveError && <Alert severity="error">{saveError}</Alert>}
          {zones ? (
            <Stack spacing={1}>
              <Typography variant="h6" component="h3">
                {changed ? "Zones with these values (not saved)" : "Your zones"}
              </Typography>
              <ZoneTable zones={zones} />
              <Typography variant="caption" color="text.secondary">
                Karvonen zones: resting + percent of (max − resting). Below 50%
                counts as Z1; above max counts as Z5.
              </Typography>
            </Stack>
          ) : (
            settings && (
              <Typography color="text.secondary">
                Enter both max and resting heart rate to see your zones.
              </Typography>
            )
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
