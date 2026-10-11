/* In-memory demo database persisted to localStorage.
   Every table is an array of plain rows; handlers mutate them and call save(). */
import { buildSeed, SEED_VERSION } from "@/mocks";

const STORAGE_KEY = "yagona-demo-db";
/* Lessons and due dates are generated around the day of seeding; after a week the
   calendar would drift, so the demo quietly re-seeds. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

let state = null;

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== SEED_VERSION) return null;
    if (Date.now() - Number(parsed.seededAt || 0) > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or unavailable: the demo keeps working in memory */
  }
}

export function db() {
  if (!state) {
    state = load();
    if (!state) {
      state = { version: SEED_VERSION, seededAt: Date.now(), tables: buildSeed() };
      save();
    }
  }
  return state.tables;
}

export function table(name) {
  const tables = db();
  if (!tables[name]) tables[name] = [];
  return tables[name];
}

/** Drops every change made in the demo and starts from fresh seed data. */
export function resetDemoData() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  state = null;
  db();
}

export function uuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function nowIso() {
  return new Date().toISOString();
}

export function findById(name, id) {
  return table(name).find((row) => String(row.id) === String(id)) || null;
}

export function insert(name, row) {
  const stamp = nowIso();
  const created = { id: uuid(), created_at: stamp, updated_at: stamp, ...row };
  table(name).push(created);
  save();
  return created;
}

export function patch(name, id, changes) {
  const row = findById(name, id);
  if (!row) return null;
  Object.assign(row, changes, { updated_at: nowIso() });
  save();
  return row;
}

export function remove(name, id) {
  const rows = table(name);
  const index = rows.findIndex((row) => String(row.id) === String(id));
  if (index < 0) return false;
  rows.splice(index, 1);
  save();
  return true;
}
