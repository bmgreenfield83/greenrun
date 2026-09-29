import StorageRounded from "@mui/icons-material/StorageRounded";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Card,
  CardContent,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";

import { fetchStorageStatistics } from "../../api/settings";

function formatBytes(value: number | null): string {
  if (value === null) return "Unavailable";
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function StorageCard() {
  const query = useQuery({
    queryKey: ["settings", "storage"],
    queryFn: ({ signal }) => fetchStorageStatistics(signal),
  });

  return (
    <Card variant="outlined" sx={{ maxWidth: 760 }}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" mb={2}>
          <StorageRounded color="primary" />
          <Typography variant="h5" component="h2">
            Database storage
          </Typography>
        </Stack>
        {query.isError ? (
          <Alert severity="warning">
            Storage statistics could not be loaded.
          </Alert>
        ) : query.data && !query.data.available ? (
          <Alert severity="info">
            This MongoDB deployment does not expose collection storage
            statistics.
          </Alert>
        ) : (
          <Stack spacing={1.5}>
            <LinearProgress
              aria-label="Database storage used"
              variant={query.data ? "determinate" : "indeterminate"}
              value={Math.min(query.data?.usage_percent ?? 0, 100)}
              color={
                (query.data?.warning_threshold ?? 0) >= 85
                  ? "warning"
                  : "primary"
              }
            />
            <Typography color="text.secondary">
              {formatBytes(query.data?.estimated_used_bytes ?? null)} used of{" "}
              {formatBytes(query.data?.configured_limit_bytes ?? null)}{" "}
              configured
            </Typography>
            {query.data?.warning_threshold && (
              <Alert
                severity={
                  query.data.warning_threshold >= 95 ? "error" : "warning"
                }
              >
                Storage use has crossed the {query.data.warning_threshold}%
                warning threshold.
              </Alert>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
