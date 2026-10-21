// Types for app/ingest.js (plain JavaScript run by nginx's njs), so the tests can import it.
// r is the njs request object nginx hands each handler.
declare const ingest: {
  endpoint(r: unknown): Promise<void>,
  parseAmount(v: unknown): string | null,
  parseCurrency(v: unknown): string | null,
  matchAccount<T extends { name: string, number?: string }>(accounts: T[], card: string): T | null,
};
export default ingest;
