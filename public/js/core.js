import { t, DICT } from './i18n.js';

export const S = {
  lang: localStorage.getItem('fs_lang') || 'zh',
  boot: null,
  state: null,
  csrf: null,
  user: null,
  page: 'landing',
  cityId: null,
  adminTab: 'overview',
  map: { cx: 256, cy: 256, zoom: 6 },
  busy: false,
  lastError: null,
};

export function L(obj) {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  return obj[S.lang] ?? obj.zh ?? obj.en ?? '';
}

export function tr(key, vars) {
  return t(S.lang, key, vars);
}

export function setLang(lang) {
  S.lang = lang === 'en' ? 'en' : 'zh';
  localStorage.setItem('fs_lang', S.lang);
  document.documentElement.lang = S.lang === 'en' ? 'en' : 'zh-CN';
  window.dispatchEvent(new CustomEvent('fs:lang'));
}

export class ApiError extends Error {
  constructor(status, code, extra) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra || {};
  }
}

export async function api(path, { method = 'GET', body, silent = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (S.csrf) headers['x-csrf-token'] = S.csrf;
  let r;
  try {
    r = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  } catch (e) {
    if (!silent) throw new ApiError(0, 'network');
    throw e;
  }
  let data = null;
  const text = await r.text();
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!r.ok || data.ok === false) {
    const err = new ApiError(r.status, data.error || `http_${r.status}`, data);
    if (r.status === 401) {
      S.user = null;
      S.state = null;
      window.dispatchEvent(new CustomEvent('fs:unauthorized'));
    }
    if (r.status === 503 && data.error === 'maintenance') window.dispatchEvent(new CustomEvent('fs:maintenance'));
    if (!silent) throw err;
    throw err;
  }
  if (data.csrf) S.csrf = data.csrf;
  return data;
}

export async function boot() {
  const data = await api('/api/bootstrap');
  S.boot = data;
  S.user = data.user;
  S.csrf = data.csrf;
  if (data.user?.locale && data.user.locale !== S.lang && !localStorage.getItem('fs_lang')) {
    setLang(data.user.locale);
  }
  return data;
}

export async function refreshState() {
  if (!S.user) return null;
  try {
    const data = await api('/api/state', { silent: true });
    S.state = data;
    if (!S.cityId && data.cities?.length) S.cityId = data.cities[0].id;
    window.dispatchEvent(new CustomEvent('fs:state', { detail: data }));
    return data;
  } catch (e) {
    if (e.code === 'login_required') return null;
    return null;
  }
}

export function errorText(e) {
  if (!e) return tr('error.internal');
  if (e.code === 'network') return tr('error.network');
  const key = `error.${e.code}`;
  const msg = tr(key);
  if (msg !== key) return msg;
  return e.extra?.message || e.message || tr('error.internal');
}

export function isLoggedIn() {
  return !!S.user;
}

export function hasAdmin() {
  return S.user?.role === 'admin';
}

export function locale() {
  return S.lang;
}
