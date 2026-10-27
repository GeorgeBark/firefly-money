# Sign in through Cloudflare Access

- **Status:** to discuss
- **Branch:** feat/cloudflare-access (or gb/ if upstream does not want it)
- **Upstream:** maybe. Generic ("trust an identity proxy"), useful to anyone
  behind Cloudflare Access.

## Why

The user publishes Money through a Cloudflare tunnel with Cloudflare Access
(Google sign-in) in front. Money still asks for its own shared password, so
there are two logins. Money cannot run without a password today: an empty
`DASH_PASSWORD` makes `app/session.js` refuse every sign-in.

Workaround meanwhile: tick "Keep me signed in" (30 days, renewed while used).

## Idea discussed

- Cloudflare Access adds a signed JWT to every request
  (`Cf-Access-Jwt-Assertion`). nginx (njs, in `session.js`) verifies its
  signature against the team's public keys
  (`https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`) and its `aud`,
  and treats a valid one as a session.
- Verify the signature, not only the header's presence: any other container on
  the same Docker network could send the header.
- New settings: the team domain and the application AUD tag. Without them
  Money behaves exactly as today.
- A LAN port bypasses Cloudflare, so either it keeps the password or it is
  removed and Money is only reached through the tunnel.

Roughly 60–80 lines in `session.js`, plus the `ingest.js` path if Apple Pay
should keep its own key.
