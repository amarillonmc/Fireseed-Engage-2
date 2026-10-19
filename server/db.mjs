import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { DB_PATH, ROOT, DEFAULT_SETTINGS } from './config.mjs';

if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');

const schema = fs.readFileSync(path.join(ROOT, 'server', 'schema.sql'), 'utf8');
db.exec(schema);

const stmts = new Map();
function prep(sql) {
  let st = stmts.get(sql);
  if (!st) {
    st = db.prepare(sql);
    stmts.set(sql, st);
  }
  return st;
}

export function all(sql, ...params) {
  return prep(sql).all(...params);
}
export function get(sql, ...params) {
  return prep(sql).get(...params) ?? null;
}
export function run(sql, ...params) {
  const r = prep(sql).run(...params);
  return { changes: Number(r.changes ?? 0), lastInsertRowid: Number(r.lastInsertRowid ?? 0) };
}
export function prepare(sql) {
  return prep(sql);
}
export function exec(sql) {
  db.exec(sql);
}

let txDepth = 0;
export function tx(fn) {
  if (txDepth > 0) return fn();
  db.exec('BEGIN IMMEDIATE');
  txDepth++;
  try {
    const result = fn();
    db.exec('COMMIT');
    txDepth--;
    return result;
  } catch (err) {
    txDepth--;
    try { db.exec('ROLLBACK'); } catch { /* already rolled back */ }
    throw err;
  }
}

export function getSetting(key, fallback) {
  const row = get('SELECT value FROM settings WHERE key = ?', String(key));
  if (!row) return fallback ?? DEFAULT_SETTINGS[key];
  const raw = row.value;
  try {
    const v = JSON.parse(raw);
    return v;
  } catch {
    return raw;
  }
}

export function numberSetting(key, fallback) {
  const v = getSetting(key, fallback);
  const n = Number(v);
  return Number.isFinite(n) ? n : (fallback ?? DEFAULT_SETTINGS[key]);
}

export function setSetting(key, value) {
  const raw = typeof value === 'string' ? JSON.stringify(value) : JSON.stringify(value);
  run('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', String(key), raw);
}

export function allSettings() {
  const out = { ...DEFAULT_SETTINGS };
  for (const row of all('SELECT key, value FROM settings')) {
    try { out[row.key] = JSON.parse(row.value); } catch { out[row.key] = row.value; }
  }
  return out;
}

export function initSettings() {
  const existing = new Set(all('SELECT key FROM settings').map((r) => r.key));
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (!existing.has(key)) setSetting(key, value);
  }
}

export function now() {
  return Date.now();
}

export function parseJson(value, fallback = null) {
  if (value == null) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

export function closeDb() {
  try { db.close(); } catch { /* ignore */ }
}

initSettings();
