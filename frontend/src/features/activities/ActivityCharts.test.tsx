import { render } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { expect, it, vi } from "vitest";

const lineChartRender = vi.fn();
const referenceArea = vi.fn();

vi.mock("recharts", () => ({
  CartesianGrid: () => null,
  Line: () => null,
  LineChart: ({ children }: { children: ReactNode }) => {
    lineChartRender();
    return <div>{children}</div>;
  },
  ReferenceArea: (props: { x1: number; x2: number }) => {
    referenceArea(props);
    return null;
  },
  ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
  Scatter: () => null,
  ScatterChart: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

import { ActivityCharts } from "./ActivityCharts";

const samples: ComponentProps<typeof ActivityCharts>["samples"] = [
  {
    elapsed_seconds: 0,
    distance_meters: 0,
    heart_rate: 130,
    speed_mps: 3,
    cadence_spm: 165,
    elevation_meters: 10,
    temperature_celsius: null,
  },
];

it("does not rebuild charts when an unchanged analysis window gets a new object identity", () => {
  const { rerender } = render(
    <ActivityCharts
      samples={samples}
      sport="run"
      analysisRanges={[{ startSeconds: 600, endSeconds: 1800 }]}
    />,
  );
  const initialRenderCount = lineChartRender.mock.calls.length;

  rerender(
    <ActivityCharts
      samples={samples}
      sport="run"
      analysisRanges={[{ startSeconds: 600, endSeconds: 1800 }]}
    />,
  );

  expect(lineChartRender).toHaveBeenCalledTimes(initialRenderCount);
});

it("shades each analysis range separately so stops are not shaded", () => {
  referenceArea.mockClear();
  render(
    <ActivityCharts
      samples={samples}
      sport="run"
      analysisRanges={[
        { startSeconds: 300, endSeconds: 900 },
        { startSeconds: 1200, endSeconds: 2400 },
      ]}
    />,
  );
  const shaded = referenceArea.mock.calls.map(([props]) => [
    props.x1,
    props.x2,
  ]);
  expect(shaded).toContainEqual([5, 15]);
  expect(shaded).toContainEqual([20, 40]);
  expect(shaded).not.toContainEqual([5, 40]);
});
