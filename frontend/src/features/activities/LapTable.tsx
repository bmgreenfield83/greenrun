import {
  Card,
  CardContent,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import type { ActivityLap } from "../../api/activities";
import { SectionTitle } from "../../components/common/SectionTitle";
import { duration, metersToMiles, pace, speed } from "./format";

export function LapTable({
  laps,
  sport,
}: {
  laps: ActivityLap[];
  sport: string;
}) {
  const usesPace = ["run", "walk", "hike"].includes(sport);
  const supportsRate = sport !== "strength";
  // Numeric columns are right-aligned so digits line up down each column.
  const columns: Array<{ label: string; numeric: boolean }> = [
    { label: "Lap", numeric: true },
    { label: "Distance", numeric: true },
    { label: "Duration", numeric: true },
    ...(supportsRate
      ? [{ label: usesPace ? "Pace" : "Avg speed", numeric: true }]
      : []),
    { label: "Avg HR", numeric: true },
    { label: "Max HR", numeric: true },
    ...(sport !== "strength"
      ? [
          {
            label: `Cadence (${sport === "bike" ? "rpm" : "spm"})`,
            numeric: true,
          },
        ]
      : []),
    { label: "Gain", numeric: true },
    { label: "Trigger", numeric: false },
  ];
  return (
    <Card component="section" aria-label="Laps">
      <CardContent>
        <Stack spacing={1.5}>
          <SectionTitle>Laps</SectionTitle>
          {!laps.length ? (
            <Typography color="text.secondary">
              No laps were recorded.
            </Typography>
          ) : (
            <TableContainer
              component={Paper}
              variant="outlined"
              tabIndex={0}
              aria-label="Lap table"
              sx={{ borderRadius: "6px" }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {columns.map(({ label, numeric }) => (
                      <TableCell key={label} align={numeric ? "right" : "left"}>
                        {label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {laps.map((lap) => (
                    <TableRow key={lap.index}>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {lap.index}
                      </TableCell>
                      <TableCell align="right">
                        {metersToMiles(lap.distance_meters)}
                      </TableCell>
                      <TableCell align="right">
                        {duration(lap.elapsed_time_seconds)}
                      </TableCell>
                      {supportsRate && (
                        <TableCell align="right">
                          {usesPace
                            ? pace(lap.average_speed_mps)
                            : speed(lap.average_speed_mps)}
                        </TableCell>
                      )}
                      <TableCell align="right">
                        {lap.average_heart_rate ?? "—"}
                      </TableCell>
                      <TableCell align="right">
                        {lap.maximum_heart_rate ?? "—"}
                      </TableCell>
                      {sport !== "strength" && (
                        <TableCell align="right">
                          {lap.average_cadence_spm?.toFixed(0) ?? "—"}
                        </TableCell>
                      )}
                      <TableCell align="right">
                        {lap.elevation_gain_meters === null
                          ? "—"
                          : `${(lap.elevation_gain_meters * 3.28084).toFixed(0)} ft`}
                      </TableCell>
                      <TableCell sx={{ color: "text.secondary" }}>
                        {lap.lap_trigger?.replaceAll("_", " ") ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
