import crypto from 'node:crypto';
import { get, run, now } from './db.mjs';
import { SESSION_DAYS } from './config.mjs';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  try {
    const [algo, salt, hash] = String(stored).split('$');
    if (algo !== 'scrypt' || !salt || !hash) return false;
    const test = crypto.scryptSync(String(password), salt, 64);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), test);
  } catch { return false; }
}

export function newToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function createSession(userId, ip = '', ua = '') {
  const token = newToken(32);
  const csrf = newToken(24);
  const ts = now();
  const expires = ts + SESSION_DAYS * 86400000;
  run('INSERT INTO sessions (token,user_id,csrf,created_at,expires_at,ip,user_agent) VALUES (?,?,?,?,?,?,?)', token, userId, csrf, ts, expires, ip, ua);
  return { token, csrf, expires };
}

export function sessionByToken(token) {
  if (!token) return null;
  const s = get('SELECT * FROM sessions WHERE token=?', token);
  if (!s) return null;
  if (s.expires_at <= now()) {
    run('DELETE FROM sessions WHERE token=?', token);
    return null;
  }
  return s;
}

export function destroySession(token) {
  if (token) run('DELETE FROM sessions WHERE token=?', token);
}

export function userBySession(session) {
  if (!session) return null;
  return get('SELECT * FROM users WHERE id=?', session.user_id);
}

const attempts = new Map();
export function loginAllowed(key) {
  const rec = attempts.get(key);
  if (!rec) return true;
  if (rec.until <= Date.now()) { attempts.delete(key); return true; }
  return rec.count < 8;
}
export function noteLoginFailure(key) {
  const rec = attempts.get(key) ?? { count: 0, until: 0, first: Date.now() };
  rec.count++;
  rec.until = Date.now() + Math.min(15 * 60000, 30000 * rec.count);
  attempts.set(key, rec);
}
export function clearLoginFailures(key) {
  attempts.delete(key);
}

export function changePassword(userId, password) {
  run('UPDATE users SET password_hash=? WHERE id=?', hashPassword(password), userId);
  run('DELETE FROM sessions WHERE user_id=?', userId);
}
