import { describe, expect, it } from "vitest";

import { runtimeSummary } from "../../src/runtime.js";

describe("e2e vitest config", () => {
  it("runs from tests/e2e separately from unit tests", () => {
    const summary = runtimeSummary();
    expect(summary.planNodeMajor).toBe(22);
    expect(summary.serviceName.length).toBeGreaterThan(0);
  });
});
