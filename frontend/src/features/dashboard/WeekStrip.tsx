import CheckRounded from "@mui/icons-material/CheckRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import RemoveRounded from "@mui/icons-material/RemoveRounded";
import PriorityHighRounded from "@mui/icons-material/PriorityHighRounded";
import DirectionsRunRounded from "@mui/icons-material/DirectionsRunRounded";
import { Box, ButtonBase, Skeleton, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { Link } from "wouter";

import { colors, pixelFont } from "../../app/tokens";
import { localDateLabel } from "../activities/format";
import type { DayState, WeekDay } from "./dashboardDates";

const stateStyle: Record<
  DayState,
  { label: string; bg: string; fg: string; icon: ReactNode; dashed?: boolean }
> = {
  done: {
    label: "Done",
    bg: colors.successTint,
    fg: colors.success,
    icon: <CheckRounded fontSize="small" />,
  },
  partial: {
    label: "Partly done",
    bg: colors.successTint,
    fg: colors.success,
    icon: <CheckRounded fontSize="small" />,
  },
  planned: {
    label: "Planned",
    bg: colors.panel,
    fg: colors.forest,
    icon: <DirectionsRunRounded fontSize="small" />,
    dashed: true,
  },
  missed: {
    label: "Missed",
    bg: colors.warningTint,
    fg: colors.warning,
    icon: <PriorityHighRounded fontSize="small" />,
  },
  skipped: {
    label: "Skipped",
    bg: colors.parchmentDeep,
    fg: colors.inkMuted,
    icon: <CloseRounded fontSize="small" />,
  },
  extra: {
    label: "Unplanned",
    bg: colors.forestTint,
    fg: colors.forest,
    icon: <AddRounded fontSize="small" />,
  },
  rest: {
    label: "Rest",
    bg: colors.parchment,
    fg: colors.inkMuted,
    icon: <RemoveRounded fontSize="small" />,
  },
};

const fmt = (value: number | null) => (value == null ? null : value.toFixed(1));

function mileage(day: WeekDay): string | null {
  const done = fmt(day.completedMiles);
  const planned = fmt(day.plannedMiles);
  if (done && planned) return `${done}/${planned}`;
  return done ?? planned;
}

function DayCell({ day }: { day: WeekDay }) {
  const style = stateStyle[day.state];
  const miles = mileage(day);
  const weekday = localDateLabel(day.date, { weekday: "short" });
  const dayNumber = Number(day.date.slice(8));
  const summary = [
    localDateLabel(day.date, {
      weekday: "long",
      month: "short",
      day: "numeric",
    }),
    day.isToday ? "today" : null,
    style.label,
    day.title,
    miles ? `${miles} mi` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <ButtonBase
      component={Link}
      href={`/calendar?date=${day.date}`}
      aria-label={summary}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "flex-start",
        width: "100%",
        minWidth: 0,
        minHeight: { xs: 88, md: 124 },
        textAlign: "left",
        borderRadius: "4px",
        border: `2px ${style.dashed ? "dashed" : "solid"} ${
          day.isToday
            ? colors.orange
            : style.dashed
              ? colors.forest
              : colors.border
        }`,
        outline: day.isToday ? `2px solid ${colors.orange}` : "none",
        outlineOffset: 0,
        bgcolor: style.bg,
        color: colors.ink,
        overflow: "hidden",
        transition: "transform 80ms ease",
        "&:hover": { transform: "translateY(-2px)" },
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        alignItems={{ xs: "center", md: "baseline" }}
        justifyContent="space-between"
        sx={{
          px: { xs: 0.25, md: 1 },
          py: 0.5,
          bgcolor: day.isToday ? colors.orange : "rgba(27, 33, 28, 0.06)",
          borderBottom: `1.5px solid rgba(27, 33, 28, 0.25)`,
        }}
      >
        <Typography
          component="span"
          sx={{ fontFamily: pixelFont, fontSize: "0.72rem", lineHeight: 1.3 }}
        >
          {weekday}
        </Typography>
        <Typography
          component="span"
          sx={{
            fontFamily: pixelFont,
            fontSize: { xs: "0.95rem", md: "0.85rem" },
            lineHeight: 1.2,
          }}
        >
          {dayNumber}
        </Typography>
      </Stack>
      <Stack
        spacing={0.5}
        alignItems={{ xs: "center", md: "flex-start" }}
        sx={{ px: { xs: 0.25, md: 1 }, py: { xs: 0.75, md: 1 }, flexGrow: 1 }}
      >
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Box
            aria-hidden
            sx={{
              display: "grid",
              placeItems: "center",
              width: 24,
              height: 24,
              borderRadius: "3px",
              bgcolor:
                day.state === "rest" || day.state === "planned"
                  ? "transparent"
                  : style.fg,
              color:
                day.state === "rest" || day.state === "planned"
                  ? style.fg
                  : "#fff",
              border:
                day.state === "planned" ? `1.5px solid ${style.fg}` : "none",
            }}
          >
            {style.icon}
          </Box>
          <Typography
            component="span"
            sx={{
              display: { xs: "none", md: "inline" },
              fontSize: "0.72rem",
              fontWeight: 800,
              color: style.fg,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {style.label}
          </Typography>
        </Stack>
        {day.title && (
          <Typography
            component="span"
            sx={{
              display: { xs: "none", md: "-webkit-box" },
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              fontSize: "0.82rem",
              fontWeight: 700,
              lineHeight: 1.25,
              textDecoration: day.state === "skipped" ? "line-through" : "none",
            }}
          >
            {day.title}
          </Typography>
        )}
        {miles && (
          <Typography
            component="span"
            sx={{
              fontSize: { xs: "0.68rem", md: "0.8rem" },
              fontWeight: 700,
              color: colors.inkMuted,
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {miles}
            <Box
              component="span"
              sx={{ display: { xs: "none", md: "inline" } }}
            >
              {" "}
              mi
            </Box>
          </Typography>
        )}
      </Stack>
    </ButtonBase>
  );
}

/** Monday–Sunday strip: each day's planned vs completed work, linking to the calendar. */
export function WeekStrip({ days }: { days: WeekDay[] | null }) {
  return (
    <Box
      component="ol"
      aria-label="This week, Monday to Sunday"
      sx={{
        listStyle: "none",
        m: 0,
        p: 0,
        display: "grid",
        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
        gap: { xs: 0.5, sm: 1 },
      }}
    >
      {(days ?? Array.from({ length: 7 }, () => null)).map((day, index) => (
        <Box component="li" key={day?.date ?? index} sx={{ display: "flex" }}>
          {day ? (
            <Box sx={{ display: "flex", width: "100%" }}>
              <DayCell day={day} />
            </Box>
          ) : (
            <Skeleton
              variant="rounded"
              height={96}
              sx={{ width: "100%" }}
              aria-hidden
            />
          )}
        </Box>
      ))}
    </Box>
  );
}
