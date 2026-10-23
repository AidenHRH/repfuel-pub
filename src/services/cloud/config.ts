/**
 * RepFuel's Supabase project. The publishable key is meant to ship inside the app: what each person can read and
 * write is set by the storage rules in supabase/setup.sql, not by this key.
 */
export const SUPABASE_URL = 'https://futrlezyjlbeksqszvwe.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_M5quP9ShtZnQ-hUd0zjvng_gP9yB4YR';

/** The private storage bucket holding everyone's backups, one folder per account. */
export const BACKUP_BUCKET = 'backups';
