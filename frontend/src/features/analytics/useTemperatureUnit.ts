import { useState } from "react";

import type { TemperatureUnit } from "./format";

const storageKey = "greenrun.temperatureUnit";

function readUnit(): TemperatureUnit {
  try {
    return window.localStorage.getItem(storageKey) === "C" ? "C" : "F";
  } catch {
    return "F";
  }
}

/** Per-browser °F/°C preference for analytics displays (defaults to °F). */
export function useTemperatureUnit(): [
  TemperatureUnit,
  (unit: TemperatureUnit) => void,
] {
  const [unit, setUnit] = useState<TemperatureUnit>(readUnit);
  return [
    unit,
    (next) => {
      setUnit(next);
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        // Preference is a convenience only.
      }
    },
  ];
}
