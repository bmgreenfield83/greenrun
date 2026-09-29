import { Alert, Button } from "@mui/material";
import { Link } from "wouter";

/** Shown by HR-derived cards when max or resting heart rate is not set. */
export function HeartRateSettingsMissing({
  message,
}: {
  message?: string | null;
}) {
  return (
    <Alert
      severity="info"
      action={
        <Button component={Link} href="/settings" size="small">
          Open Settings
        </Button>
      }
    >
      {message ??
        "Set your max and resting heart rate in Settings to see heart-rate zones and training load."}
    </Alert>
  );
}
