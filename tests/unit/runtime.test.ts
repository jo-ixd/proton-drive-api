import { describe, expect, it } from "vitest";

import {
  PLAN_NODE_MAJOR,
  SERVICE_NAME,
  runtimeSummary,
} from "../../src/runtime.js";

describe("runtime", () => {
  it("exposes the service name", () => {
    expect(SERVICE_NAME).toBe("proton-drive-api");
  });

  it("targets Node 22 per the architecture plan", () => {
    expect(PLAN_NODE_MAJOR).toBe(22);
  });

  it("builds a consistent runtime summary", () => {
    expect(runtimeSummary()).toEqual({
      serviceName: "proton-drive-api",
      planNodeMajor: 22,
    });
  });
});
