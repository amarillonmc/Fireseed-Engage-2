import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';
import { PUBLIC_DIR, PORT, HOST, SESSION_DAYS } from './config.mjs';
import { getSetting } from './db.mjs';
import { sessionByToken, userBySession } from './auth.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};

export class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const routes = [];
export function route(method, pattern, handler) {
  const keys = [];
  const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, (m) => { keys.push(m.slice(1)); return '([^/]+)'; }) + '$');
  routes.push({ method, regex, keys, handler });
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 2 * 1024 * 1024) { reject(new HttpError(413, 'body_too_large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new HttpError(400, 'invalid_json')); }
    });
    req.on('error', reject);
  });
}

export function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  const relative = path.relative(PUBLIC_DIR, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) { sendJson(res, 403, { ok: false, error: 'forbidden' }); return; }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendJson(res, 404, { ok: false, error: 'not_found' });
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const data = fs.readFileSync(filePath);
  const cache = ['.html', '.js', '.mjs', '.css'].includes(ext) ? 'no-cache' : 'public, max-age=86400';
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'content-length': data.length, 'cache-control': cache });
  res.end(data);
}

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self' data:; media-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
}

const KNOWN_GAME_ERRORS = new Set([
  'no_user', 'no_tile', 'own_tile', 'allied_tile', 'need_gateway', 'not_adjacent', 'no_city', 'no_general',
  'general_downed', 'general_busy', 'not_enough_troops', 'empty_army', 'insufficient_resources', 'insufficient_lumen',
  'insufficient_umbra', 'invalid_facility', 'invalid_cell', 'cell_occupied', 'construction_busy', 'unique_facility',
  'max_level', 'cannot_demolish', 'invalid_name', 'invalid_unit', 'requires_facility', 'facility_busy', 'training_busy',
  'troop_cap', 'no_tapes', 'nothing_to_finish', 'general_not_found', 'skill_not_found', 'invalid_slot',
  'skill_equipped_elsewhere', 'not_enough_duplicates', 'passive_skill', 'cooldown', 'full_hp', 'tech_not_found',
  'requires_lab', 'research_busy', 'item_not_found', 'quest_not_found', 'already_claimed', 'not_complete',
  'registration_closed', 'server_full', 'invalid_username', 'invalid_display_name', 'weak_password', 'username_taken',
  'bad_credentials', 'too_many_attempts', 'banned', 'chat_rate', 'empty_message', 'invalid_tag', 'already_in_alliance',
  'tag_taken', 'not_open', 'not_in_alliance', 'season_ended', 'occupied', 'need_army', 'general_cost_cap', 'city_not_found',
  'facility_not_found', 'user_not_found', 'invalid_grant', 'confirm_required', 'invalid_setting', 'invalid_map_size',
  'invalid_rates', 'name_required', 'invalid_rarity', 'invalid_element', 'invalid_cost', 'invalid_stat', 'key_taken',
  'invalid_kind', 'invalid_rare', 'invalid_effects', 'invalid_image', 'image_too_large', 'announcement_not_found',
  'subbase_cap', 'invalid_tile', 'already_city',
]);

export async function handleRequest(req, res) {
  securityHeaders(res);
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  if (!pathname.startsWith('/api/')) {
    serveStatic(req, res, pathname);
    return;
  }
  const method = req.method || 'GET';
  const cookies = parseCookies(req);
  const session = sessionByToken(cookies.fs_sid);
  const user = userBySession(session);
  const ctx = {
    req, res, url, method, params: {}, query: url.searchParams, body: null,
    session, user, ip: req.socket.remoteAddress || '',
    setSession(token, csrf) {
      const secure = (req.headers['x-forwarded-proto'] === 'https') ? '; Secure' : '';
      res.setHeader('Set-Cookie', `fs_sid=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`);
      this.csrf = csrf;
    },
    clearSession() {
      res.setHeader('Set-Cookie', 'fs_sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    },
  };
  try {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      ctx.body = await readBody(req);
      if (session && ctx.body && typeof ctx.body === 'object' && !Array.isArray(ctx.body)) {
        const token = req.headers['x-csrf-token'];
        if (token !== session.csrf) throw new HttpError(403, 'csrf');
      }
    } else if (method === 'GET') {
      ctx.body = {};
    }
    if (user && user.status === 'banned' && pathname !== '/api/bootstrap' && pathname !== '/api/logout') {
      throw new HttpError(403, 'banned', user.banned_reason || 'Account suspended');
    }
    const maintenance = Number(getSetting('maintenance', 0));
    if (maintenance && user?.role !== 'admin' && pathname !== '/api/bootstrap' && pathname !== '/api/login' && pathname !== '/api/register') {
      throw new HttpError(503, 'maintenance');
    }
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = r.regex.exec(pathname);
      if (!m) continue;
      r.keys.forEach((k, i) => { ctx.params[k] = decodeURIComponent(m[i + 1]); });
      const result = await r.handler(ctx);
      if (res.writableEnded) return;
      if (result && result.__raw) {
        res.writeHead(result.status || 200, result.headers || {});
        res.end(result.body ?? '');
        return;
      }
      sendJson(res, 200, { ok: true, ...(result ?? {}) });
      return;
    }
    throw new HttpError(404, 'api_not_found');
  } catch (err) {
    if (res.writableEnded) return;
    if (err instanceof HttpError) {
      sendJson(res, err.status, { ok: false, error: err.code, message: err.message, ...err.extra });
    } else if (KNOWN_GAME_ERRORS.has(err.message)) {
      sendJson(res, 400, { ok: false, error: err.message, message: err.message });
    } else {
      console.error('[api]', method, pathname, err);
      sendJson(res, 500, { ok: false, error: 'internal', message: 'Internal server error' });
    }
  }
}

export function requireUser(ctx) {
  if (!ctx.user) throw new HttpError(401, 'login_required');
  return ctx.user;
}

export function requireAdmin(ctx) {
  const user = requireUser(ctx);
  if (user.role !== 'admin') throw new HttpError(403, 'admin_required');
  return user;
}

export function startServer() {
  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      console.error('[fatal]', err);
      if (!res.writableEnded) sendJson(res, 500, { ok: false, error: 'internal' });
    });
  });
  server.listen(PORT, HOST, () => {
    console.log(`Fireseed Engage listening on http://${HOST}:${PORT}`);
  });
  return server;
}
