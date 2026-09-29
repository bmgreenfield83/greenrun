import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import ErrorOutlineRounded from "@mui/icons-material/ErrorOutlineRounded";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";

import { fetchReadiness } from "../../api/health";

export function SystemStatusCard() {
  const readiness = useQuery({
    queryKey: ["readiness"],
    queryFn: ({ signal }) => fetchReadiness(signal),
  });

  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h6">System status</Typography>
          {readiness.isLoading ? (
            <Skeleton width={92} />
          ) : readiness.isSuccess ? (
            <Chip
              icon={<CheckCircleRounded />}
              label="Connected"
              color="success"
              size="small"
            />
          ) : (
            <Chip
              icon={<ErrorOutlineRounded />}
              label="Unavailable"
              color="error"
              size="small"
            />
          )}
        </Stack>
        {readiness.isError ? (
          <Alert severity="warning">
            Start the backend and verify the MongoDB configuration.
          </Alert>
        ) : (
          <Typography color="text.secondary">
            The backend and database are connected and ready.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
