// Types for app/session.js (plain JavaScript run by nginx's njs), so the tests can import it.
// r is the njs request object nginx hands each handler.
declare const session: {
  check(r: unknown): string,
  renew(r: unknown): string,
  endpoint(r: unknown): void,
};
export default session;
