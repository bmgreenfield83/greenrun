import {
  Alert,
  Card,
  CardContent,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";

import { SectionTitle } from "../../components/common/SectionTitle";

type AnalyticsCardProps = {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  loading?: boolean;
  error?: string | null;
  children?: ReactNode;
};

/** Card shell shared by analytics sections: title, short explanation, loading and error states. */
export function AnalyticsCard({
  title,
  description,
  action,
  loading,
  error,
  children,
}: AnalyticsCardProps) {
  return (
    <Card variant="outlined" component="section" aria-label={title}>
      <CardContent>
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <SectionTitle action={action}>{title}</SectionTitle>
            {description && (
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            )}
          </Stack>
          {error ? (
            <Alert severity="warning">{error}</Alert>
          ) : loading ? (
            <Skeleton
              variant="rounded"
              height={220}
              aria-label={`Loading ${title}`}
            />
          ) : (
            children
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

/** Small labeled figure used inside analytics cards. */
export function Figure({
  label,
  value,
  detail,
}: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
      <Typography variant="overline" color="text.secondary" component="p">
        {label}
      </Typography>
      <Typography
        component="p"
        color="primary.dark"
        sx={{
          fontWeight: 750,
          fontSize: { xs: "1.2rem", sm: "1.4rem" },
          lineHeight: 1.2,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </Typography>
      {detail && (
        <Typography variant="body2" color="text.secondary">
          {detail}
        </Typography>
      )}
    </Stack>
  );
}
