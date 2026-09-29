import { expect, it } from "vitest";

import { sceneForPath } from "./sceneForPath";

it("uses the lab scene for analytics and the trail everywhere else", () => {
  expect(sceneForPath("/analytics")).toBe("lab");
  expect(sceneForPath("/analytics/anything")).toBe("lab");
  expect(sceneForPath("/")).toBe("trail");
  expect(sceneForPath("/activities/abc")).toBe("trail");
  expect(sceneForPath("/analyticsx")).toBe("trail");
});
