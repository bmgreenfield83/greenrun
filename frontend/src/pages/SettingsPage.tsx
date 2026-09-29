import { Stack } from "@mui/material";

import { PageHeader } from "../components/common/PageHeader";
import { HeartRateSettingsCard } from "../features/settings/HeartRateSettingsCard";
import { StorageCard } from "../features/settings/StorageCard";

export function SettingsPage() {
  return (
    <Stack spacing={3}>
      <PageHeader
        title="Settings"
        description="Heart-rate settings for zones and training load, and MongoDB storage visibility."
      />
      <HeartRateSettingsCard />
      <StorageCard />
    </Stack>
  );
}
