export function getPaceChartDomain(
  values: Array<number | null>,
): [number | "auto", number | "auto"] {
  const sorted = values
    .filter(
      (value): value is number => value !== null && Number.isFinite(value),
    )
    .sort((left, right) => left - right);

  if (!sorted.length) return ["auto", "auto"];

  // Recorded speeds briefly approach zero at stops and GPS dropouts. Converting
  // those samples to pace can produce 75-120 min/mi values that make the useful
  // portion of the chart unreadable. Scale to the central 90% without modifying
  // the stored or exported samples.
  const lower = sorted[Math.floor((sorted.length - 1) * 0.05)];
  const upper = sorted[Math.ceil((sorted.length - 1) * 0.95)];
  const domainStart = Math.max(0, Math.floor(lower - 1));
  const domainEnd = Math.max(domainStart + 1, Math.ceil(upper + 1));
  return [domainStart, domainEnd];
}

export function formatPaceTick(value: number) {
  const totalSeconds = Math.round(value * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
