import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";

import type { HeartRateZoneBoundary } from "../../api/analytics";
import { zoneColors, zoneSwatchBorder } from "./chartTheme";

const zoneNames = ["Recovery", "Aerobic", "Tempo", "Threshold", "Maximum"];

/** Heart-rate-reserve zones with bpm ranges. */
export function ZoneTable({ zones }: { zones: HeartRateZoneBoundary[] }) {
  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ borderRadius: "6px" }}
    >
      <Table size="small" aria-label="Heart-rate zones">
        <TableHead>
          <TableRow>
            <TableCell>Zone</TableCell>
            <TableCell align="right">Heart rate</TableCell>
            <TableCell align="right">% reserve</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {zones.map((zone, index) => (
            <TableRow key={zone.zone}>
              <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                <Box
                  component="span"
                  sx={{
                    display: "inline-block",
                    width: 14,
                    height: 14,
                    borderRadius: "2px",
                    bgcolor: zoneColors[index],
                    border: zoneSwatchBorder,
                    verticalAlign: "-2px",
                    mr: 1,
                  }}
                />
                Z{zone.zone}{" "}
                <Box
                  component="span"
                  sx={{
                    color: "text.secondary",
                    fontWeight: 400,
                    display: { xs: "none", sm: "inline" },
                  }}
                >
                  {zoneNames[index]}
                </Box>
              </TableCell>
              <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                {index === 0 ? "below " : `${Math.round(zone.lower_bpm)}–`}
                {Math.round(zone.upper_bpm)} bpm
              </TableCell>
              <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                {index === 0 ? "< " : `${zone.lower_reserve_percent}–`}
                {zone.upper_reserve_percent}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
