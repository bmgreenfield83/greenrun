import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import type { ActivityLap } from "../../api/activities";
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
  return (
    <div>
      <Typography variant="h5" gutterBottom>
        Laps
      </Typography>
      {!laps.length ? (
        <Typography color="text.secondary">No laps were recorded.</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                {[
                  "Lap",
                  "Distance",
                  "Duration",
                  ...(supportsRate ? [usesPace ? "Pace" : "Avg speed"] : []),
                  "Avg HR",
                  "Max HR",
                  ...(sport !== "strength"
                    ? [`Cadence (${sport === "bike" ? "rpm" : "spm"})`]
                    : []),
                  "Gain",
                  "Trigger",
                ].map((label) => (
                  <TableCell key={label}>{label}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {laps.map((lap) => (
                <TableRow key={lap.index}>
                  <TableCell>{lap.index}</TableCell>
                  <TableCell>{metersToMiles(lap.distance_meters)}</TableCell>
                  <TableCell>{duration(lap.elapsed_time_seconds)}</TableCell>
                  {supportsRate && (
                    <TableCell>
                      {usesPace
                        ? pace(lap.average_speed_mps)
                        : speed(lap.average_speed_mps)}
                    </TableCell>
                  )}
                  <TableCell>{lap.average_heart_rate ?? "—"}</TableCell>
                  <TableCell>{lap.maximum_heart_rate ?? "—"}</TableCell>
                  {sport !== "strength" && (
                    <TableCell>
                      {lap.average_cadence_spm?.toFixed(0) ?? "—"}
                    </TableCell>
                  )}
                  <TableCell>
                    {lap.elevation_gain_meters === null
                      ? "—"
                      : `${(lap.elevation_gain_meters * 3.28084).toFixed(0)} ft`}
                  </TableCell>
                  <TableCell>{lap.lap_trigger ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}
