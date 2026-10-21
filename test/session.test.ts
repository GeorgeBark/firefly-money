// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import session from '../app/session.js';

// A stand-in for the request object nginx hands to app/session.js
function req({ method = 'GET', body = '', cookie = '', https = false } = {}) {
  const r: any = { method, requestText: body, headersIn: https ? { 'X-Forwarded-Proto': 'https' } : {}, headersOut: {}, status: 0,
    variables: { scheme: 'http', cookie_money_session: cookie } };
  r.return = (s: number) => { r.status = s; };
  return r;
}
const signIn = (password: string, remember = false, https = false) => { const r = req({ method: 'POST', body: JSON.stringify({ password, remember }), https }); session.endpoint(r); return r; };
const env = (globalThis as any).process.env;      // what nginx passes on with its env directive
const value = (r: { headersOut: Record<string, string> }) => /money_session=([^;]*)/.exec(r.headersOut['Set-Cookie'])![1];

beforeEach(() => { env.DASH_PASSWORD = 'correct horse'; env.FIREFLY_TOKEN = 'tok'; });
afterEach(() => vi.useRealTimers());

describe('session.js', () => {
  it('signs in with the right password only', () => {
    const bad = signIn('wrong');
    expect(bad.status).toBe(401);
    expect(bad.headersOut['X-Dash-Auth']).toBe('required');
    expect(bad.headersOut['Set-Cookie']).toBeUndefined();
    const ok = signIn('correct horse');
    expect(ok.status).toBe(204);
    expect(ok.headersOut['Set-Cookie']).toMatch(/; Path=\/api\/; HttpOnly; SameSite=Strict$/);
    expect(session.check(req({ cookie: value(ok) }))).toBe('1');
  });
  it('keeps the cookie for 30 days when asked, and marks it Secure over HTTPS', () => {
    expect(signIn('correct horse', true).headersOut['Set-Cookie']).toContain('; Max-Age=2592000');
    expect(signIn('correct horse', false, true).headersOut['Set-Cookie']).toMatch(/; Secure$/);
  });
  it('refuses tampered, expired and outdated sessions', () => {
    const t = value(signIn('correct horse'));
    expect(session.check(req({ cookie: t.replace(/^\d/, d => String((+d + 1) % 10)) }))).toBe('');
    expect(session.check(req({ cookie: '' }))).toBe('');
    expect(session.check(req({ cookie: 'garbage' }))).toBe('');
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + 13 * 3600e3);
    expect(session.check(req({ cookie: t }))).toBe('');
    vi.useRealTimers();
    env.DASH_PASSWORD = 'new password';
    expect(session.check(req({ cookie: t }))).toBe('');
  });
  it('lets nobody in without a DASH_PASSWORD', () => {
    env.DASH_PASSWORD = '';
    expect(signIn('').status).toBe(401);
  });
  it('renews a session once half its time is gone', () => {
    const t = value(signIn('correct horse', true));
    expect(session.renew(req({ cookie: t }))).toBe('');
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + 16 * 86400e3);
    const fresh = session.renew(req({ cookie: t }));
    expect(fresh).toContain('; Max-Age=2592000');
    expect(session.check(req({ cookie: /money_session=([^;]*)/.exec(fresh)![1] }))).toBe('1');
  });
  it('signs out', () => {
    const r = req({ method: 'DELETE' });
    session.endpoint(r);
    expect(r.status).toBe(204);
    expect(r.headersOut['Set-Cookie']).toMatch(/^money_session=; .*Max-Age=0/);
  });
});
