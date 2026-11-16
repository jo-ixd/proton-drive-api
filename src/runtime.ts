export const SERVICE_NAME = "proton-drive-api";

/** Node major version the plan targets for production CI and images. */
export const PLAN_NODE_MAJOR = 22;

export function runtimeSummary() {
  return {
    serviceName: SERVICE_NAME,
    planNodeMajor: PLAN_NODE_MAJOR,
  };
}
