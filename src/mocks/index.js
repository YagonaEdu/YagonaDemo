/* Demo data entry point: seed builder and the demo accounts shown on the login page. */
export { buildSeed } from "./seed";
export { DEFAULT_CENTER_SETTINGS, mergeCenterSettings } from "./settings";

/* Bump when the seed shape changes: stored demo data of an older version is discarded. */
export const SEED_VERSION = 1;

/* Any identifier/password logs in; the keyword in the identifier picks the cabinet. */
export const DEMO_ACCOUNTS = [
  { label: "login.demoOwner", identifier: "owner@registon.demo", password: "demo" },
  { label: "login.demoAdmin", identifier: "admin@registon.demo", password: "demo" },
  { label: "login.demoTeacher", identifier: "teacher@registon.demo", password: "demo" },
  { label: "login.demoStudent", identifier: "student@registon.demo", password: "demo" },
];
