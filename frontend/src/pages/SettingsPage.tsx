import { Stack, Typography } from "@mui/material";

import { StorageCard } from "../features/settings/StorageCard";

export function SettingsPage() {
  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h4" gutterBottom>
          Settings
        </Typography>
        <Typography color="text.secondary">
          Application defaults and MongoDB storage visibility.
        </Typography>
      </div>
      <StorageCard />
    </Stack>
  );
}
