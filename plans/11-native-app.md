# P-11 — Native mobile app

- **Status:** to discuss
- **Branch:** none yet
- **Upstream:** no

## Discussed so far

The user installed Money as a PWA on the phone, and it works. Options weighed:

1. Stay a PWA. Over HTTPS (the Cloudflare tunnel) it also gets the offline copy
   and instant start.
2. Wrap it with Capacitor for widgets, reliable notifications on iOS, Face ID.
   Money assumes the page and `/api/` share an origin (session cookie,
   `X-Money` header), so sessions and CORS would need changes.
3. Rewrite in React Native or Flutter. Nothing of Money's code carries over:
   it renders HTML strings into the DOM, so every upstream feature would be
   rewritten by hand.

Recommendation given: stay a PWA, and consider Capacitor only for a concrete
native need. Porting to React Native in parallel while pulling upstream
features was advised against.
