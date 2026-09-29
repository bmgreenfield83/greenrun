import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import {
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { Link } from "wouter";

/** Small linked dashboard card: pixel overline, content, and a chevron. */
export function GlanceCard({
  label,
  href,
  linkLabel,
  children,
}: {
  label: string;
  href: string;
  linkLabel: string;
  children: ReactNode;
}) {
  return (
    <Card component="section" aria-label={label} sx={{ height: "100%" }}>
      <CardActionArea
        component={Link}
        href={href}
        aria-label={linkLabel}
        sx={{ height: "100%", alignItems: "stretch", display: "flex" }}
      >
        <CardContent sx={{ flexGrow: 1 }}>
          <Stack spacing={1}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography
                variant="overline"
                color="text.secondary"
                component="h2"
              >
                {label}
              </Typography>
              <ChevronRightRounded fontSize="small" color="action" />
            </Stack>
            {children}
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
