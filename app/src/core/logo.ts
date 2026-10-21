import { html } from './html';
import { LS } from './helpers';

/* ---------- Logos ----------
   A payee's or account's logo is the icon of its website. The website is guessed from the name
   (Walmart → walmart.com) unless one was set for it (LS logoSites, by lower-case name; '' = no logo).
   The browser only ever asks this server (/logo/<domain>), which fetches the icon and caches it, so the
   page's security policy stays 'self' and no other site sees who you pay. A logo that doesn't exist
   falls back to the monogram underneath it. */
const NOISE = /^(sq|tst|pos|ach|dd|pp|paypal|aplpay|sp|py|ic|in|web|pmt)\s*\*\s*|^(sq|tst)\s+/i;
// Names whose website isn't simply the name + .com (matched at the start of the cleaned-up name)
const ALIAS: [string, string][] = [
  ['amzn', 'amazon.com'], ['amazon', 'amazon.com'], ['whole foods', 'wholefoodsmarket.com'], ['wholefds', 'wholefoodsmarket.com'],
  ['bank of america', 'bankofamerica.com'], ['bofa', 'bankofamerica.com'], ['wells fargo', 'wellsfargo.com'], ['chase', 'chase.com'],
  ['american express', 'americanexpress.com'], ['amex', 'americanexpress.com'], ['capital one', 'capitalone.com'], ['citi', 'citi.com'],
  ['discover', 'discover.com'], ['apple', 'apple.com'], ['google', 'google.com'], ['uber eats', 'ubereats.com'], ['uber', 'uber.com'],
  ['lyft', 'lyft.com'], ['doordash', 'doordash.com'], ['netflix', 'netflix.com'], ['spotify', 'spotify.com'], ['target', 'target.com'],
  ['walmart', 'walmart.com'], ['wal-mart', 'walmart.com'], ['costco', 'costco.com'], ['starbucks', 'starbucks.com'], ['mcdonald', 'mcdonalds.com'],
  ['7-eleven', '7-eleven.com'], ['shell', 'shell.com'], ['exxon', 'exxon.com'], ['home depot', 'homedepot.com'], ['trader joe', 'traderjoes.com'],
  ['usaa', 'usaa.com'], ['ally', 'ally.com'], ['sofi', 'sofi.com'], ['venmo', 'venmo.com'], ['paypal', 'paypal.com'], ['zelle', 'zellepay.com'],
];
// Words that describe the account or the purchase rather than the business
const FILLER = /^(the|and|of|inc|llc|ltd|co|corp|company|store|stores|online|payment|payments|autopay|bill|purchase|checking|savings?|account|credit|debit|card|visa|mastercard|rewards|joint|personal|business|loan|mortgage|us|usa|www|com)$/;
const failed = new Set<string>();
document.addEventListener('error', e => {
  const t = e.target as HTMLElement;
  if (t instanceof HTMLImageElement && t.classList.contains('logo')) { failed.add(t.dataset.d || ''); t.remove(); }
}, true);
// Shown only once it has loaded, so a slow or missing logo never hides the monogram behind a blank square
document.addEventListener('load', e => { const t = e.target as HTMLElement; if (t instanceof HTMLImageElement && t.classList.contains('logo')) t.classList.add('ok'); }, true);

export const logosOn = () => LS.get('logos', true) !== false;
const key = (name: string) => String(name).trim().toLowerCase();
export function logoDomain(name: string): string {
  const set = LS.get('logoSites', {})[key(name)];
  return set !== undefined ? set : guessDomain(name);
}
// Remembers the website set in the account form (only when it differs from the guess), under its new name
export function setLogoSite(name: string, site: string, oldName = '') {
  const m = { ...LS.get('logoSites', {}) };
  delete m[key(oldName)]; delete m[key(name)];
  if (site !== guessDomain(name)) m[key(name)] = site;
  failed.delete(site);
  LS.set('logoSites', m);
}
function guessDomain(name: string) {
  const n = String(name).replace(NOISE, '').toLowerCase().trim();
  const site = n.match(/\b([a-z0-9][a-z0-9-]*\.(?:com|net|org|io|co|us|ca|uk|de|in|ae|au))\b/);
  if (site) return site[1];
  const alias = ALIAS.find(([k]) => n === k || n.startsWith(k + ' ') || n.startsWith(k + '.') || n.startsWith(k + '*') || n.startsWith(k + '#'));
  if (alias) return alias[1];
  const words = n.split(/[#*]/)[0].replace(/['’]/g, '').split(/[^a-z0-9&]+/).filter(w => w && !/\d/.test(w) && !FILLER.test(w));
  if (!words.length || words.length > 3) return '';
  const d = words.join('').replace(/&/g, 'and');
  return d.length >= 3 && d.length <= 30 ? d + '.com' : '';
}
// The <img> to put over a monogram, or nothing
export function logoImg(name: string) {
  if (!logosOn()) return '';
  const d = logoDomain(name);
  return d && !failed.has(d) ? html`<img class="logo" src="logo/${d}" data-d="${d}" alt="" loading="lazy" decoding="async">` : '';
}
