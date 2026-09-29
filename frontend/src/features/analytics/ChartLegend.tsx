import { Box, Stack, Typography } from "@mui/material";

export type LegendItem = {
  label: string;
  color: string;
  /** "bar" swatch, "line", "dashed" line, or "dot". */
  kind?: "bar" | "line" | "dashed" | "dot" | "ring" | "hatched";
};

function Mark({ color, kind = "bar" }: Pick<LegendItem, "color" | "kind">) {
  if (kind === "line" || kind === "dashed")
    return (
      <Box
        component="span"
        sx={{
          width: 18,
          height: 0,
          borderTop: `2.5px ${kind === "dashed" ? "dashed" : "solid"} ${color}`,
          flexShrink: 0,
        }}
      />
    );
  return (
    <Box
      component="span"
      sx={{
        width: 12,
        height: 12,
        borderRadius: kind === "dot" || kind === "ring" ? "50%" : "3px",
        flexShrink: 0,
        bgcolor: kind === "hatched" || kind === "ring" ? "transparent" : color,
        border:
          kind === "hatched"
            ? `1.5px dashed ${color}`
            : kind === "ring"
              ? `1.5px solid ${color}`
              : "none",
        backgroundImage:
          kind === "hatched"
            ? `repeating-linear-gradient(45deg, ${color}55 0 2px, transparent 2px 5px)`
            : "none",
      }}
    />
  );
}

/** HTML legend placed under a chart; wraps on phones. */
export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <Stack
      direction="row"
      flexWrap="wrap"
      columnGap={2}
      rowGap={0.5}
      sx={{ mt: 1 }}
    >
      {items.map((item) => (
        <Stack
          key={item.label}
          direction="row"
          spacing={0.75}
          alignItems="center"
        >
          <Mark color={item.color} kind={item.kind} />
          <Typography variant="caption" color="text.secondary">
            {item.label}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}
