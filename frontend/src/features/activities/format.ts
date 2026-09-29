export const metersToMiles = (meters: number | null) =>
  meters === null ? "—" : `${(meters / 1609.344).toFixed(2)} mi`;

export const duration = (seconds: number | null) => {
  if (seconds === null) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = Math.round(seconds % 60);
  return `${hours ? `${hours}:` : ""}${hours ? String(minutes).padStart(2, "0") : minutes}:${String(remainder).padStart(2, "0")}`;
};

export const pace = (speedMps: number | null) => {
  if (!speedMps) return "—";
  const seconds = 1609.344 / speedMps;
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}/mi`;
};

export const speed = (speedMps: number | null) =>
  speedMps ? `${(speedMps * 2.23694).toFixed(1)} mph` : "Not recorded";
