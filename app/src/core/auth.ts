import { AuthError, CACHE, PAGES, PDB } from './api';
import { S, el } from './base';
import { closeDrawer, formError, toast } from './dom';

/* Signing in and out: the saved password, and what happens when Firefly or the password check says no. */

export function storedKey() {
  try { const k = localStorage.getItem('moneyKey'); S.remember = !!k; return k || sessionStorage.getItem('moneyKey') || ''; } catch (e) { return ''; }
}
export function saveKey(k, remember) { S.remember = !!remember; try { (remember ? localStorage : sessionStorage).setItem('moneyKey', k); } catch (e) { /* storage blocked */ } }
export function clearKey() { try { localStorage.removeItem('moneyKey'); sessionStorage.removeItem('moneyKey'); } catch (e) { /* ignore */ } }
// Everything this device saved (in memory, IndexedDB and the offline cache) goes when the sign-in screen shows.
function forgetDeviceData() {
  CACHE.clear(); PAGES.clear(); PDB.clear(); S.remember = false;
  try { if (window.caches) caches.open('money-v1').then(c => c.keys().then(ks => ks.forEach(k => { if (new URL(k.url).pathname.startsWith('/api/')) c.delete(k); }))).catch(() => {}); } catch (e) { /* no Cache Storage */ }
}
export function showLogin(msg?) {
  closeDrawer(); S.lists = null; forgetDeviceData();
  el('app').hidden = true; el('login').hidden = false;
  const e = el('loginErr'); e.hidden = !msg || msg === 'Wrong password.' && !S.key; e.textContent = msg || '';
  el('loginPw').value = ''; el('loginPw').focus();
}
export async function withAuth(fn) { try { return await fn(); } catch (e) { if (e instanceof AuthError) return showLogin(e.message); toast(e.message); } }
export async function busy(btn, fn) {
  if (btn) { btn.disabled = true; btn.dataset.l = btn.textContent; btn.textContent = 'Saving…'; }
  try { await fn(); } catch (e) { if (e instanceof AuthError) return showLogin(e.message); formError(e.message); }
  finally { if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = btn.dataset.l; } }
}
