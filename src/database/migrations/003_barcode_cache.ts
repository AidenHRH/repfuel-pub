import type { Migration } from './index';

// Successful barcode lookups are kept so a product scanned once can be looked up offline.
export const barcodeCache: Migration = {
  version: 3,
  name: 'barcode lookup cache',
  async up(db) {
    await db.exec(`
CREATE TABLE barcode_cache (
  barcode TEXT PRIMARY KEY NOT NULL,
  draft_json TEXT NOT NULL,
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
`);
  },
};
