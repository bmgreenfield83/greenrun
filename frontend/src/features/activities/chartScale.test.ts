import { describe, expect, it } from "vitest";

import { formatPaceTick, getPaceChartDomain } from "./chartScale";

describe("pace chart scale", () => {
  it("keeps near-stop pace outliers from stretching the useful domain", () => {
    const typicalPaces = Array.from(
      { length: 97 },
      (_, index) => 8 + index / 50,
    );
    const domain = getPaceChartDomain([...typicalPaces, 75, 100, 124]);

    expect(domain).toEqual([7, 11]);
  });

  it("formats decimal pace ticks as minutes and seconds", () => {
    expect(formatPaceTick(8.5)).toBe("8:30");
    expect(formatPaceTick(12)).toBe("12:00");
  });
});
