// Sign-in sessions, run inside nginx (njs). Loaded by default.conf.template.
//
// Signing in (POST /api/money-session with the dashboard password) sets the money_session cookie: an expiry time
// signed with a key made from DASH_PASSWORD and FIREFLY_TOKEN. The cookie is HttpOnly, so the page's scripts never
// see it, and nothing about the password is kept in the browser. Changing either variable signs everyone out.
// "Keep me signed in" gives a 30-day cookie; otherwise it lasts until the browser closes, and at most 12 hours of
// not using the app. Either way, using the app renews it (see renew below).
import crypto from 'crypto';

const NAME = 'money_session';
const KEEP = 30 * 86400, BRIEF = 12 * 3600;

const env = k => process.env[k] || '';
const now = () => Math.floor(Date.now() / 1000);
const mac = (key, s) => crypto.createHmac('sha256', key).update(s).digest('base64url');
// Both sides go through the same HMAC first, so the comparison takes as long whatever the inputs are
function same(a, b) {
  const x = mac('money-compare', a), y = mac('money-compare', b);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}
const signingKey = () => mac(env('FIREFLY_TOKEN'), 'money-session\n' + env('DASH_PASSWORD'));
const token = (exp, keep) => exp + '.' + keep + '.' + mac(signingKey(), exp + '.' + keep);

// The session in the request's cookie, or null when there is none, it has expired, or its signature is wrong
function session(r) {
  const t = r.variables.cookie_money_session || '';
  const m = /^(\d{1,12})\.([01])\.[\w-]{43}$/.exec(t);
  if (!m || !env('DASH_PASSWORD') || +m[1] <= now() || !same(t, token(m[1], m[2]))) return null;
  return { exp: +m[1], keep: m[2] === '1' };
}

function cookie(r, value, maxAge) {
  // Secure only over HTTPS (directly or behind a proxy): most installs are plain HTTP on a home network
  const https = r.variables.scheme === 'https' || r.headersIn['X-Forwarded-Proto'] === 'https';
  return NAME + '=' + value + '; Path=/api/; HttpOnly; SameSite=Strict' + (maxAge === undefined ? '' : '; Max-Age=' + maxAge) + (https ? '; Secure' : '');
}
function issue(r, keep) {
  const life = keep ? KEEP : BRIEF;
  return cookie(r, token(now() + life, keep ? 1 : 0), keep ? life : undefined);
}

// $money_session: "1" when the request carries a valid session
function check(r) { return session(r) ? '1' : ''; }
// $money_renew: a fresh cookie once less than half of the session's time is left, else nothing (no header)
function renew(r) {
  const s = session(r);
  return s && s.exp - now() < (s.keep ? KEEP : BRIEF) / 2 ? issue(r, s.keep) : '';
}

// POST {password, remember} signs in, DELETE signs out
function endpoint(r) {
  r.headersOut['Cache-Control'] = 'no-store';
  if (r.method === 'DELETE') {
    r.headersOut['Set-Cookie'] = cookie(r, '', 0);
    return r.return(204);
  }
  if (r.method !== 'POST') return r.return(405);
  let body = {};
  try { body = JSON.parse(r.requestText || '{}') || {}; } catch (e) { /* not JSON: wrong password below */ }
  const pw = typeof body.password === 'string' ? body.password : '';
  if (!env('DASH_PASSWORD') || !same(pw, env('DASH_PASSWORD'))) {
    r.headersOut['X-Dash-Auth'] = 'required';
    return r.return(401);
  }
  r.headersOut['Set-Cookie'] = issue(r, !!body.remember);
  r.return(204);
}

export default { check, renew, endpoint };
