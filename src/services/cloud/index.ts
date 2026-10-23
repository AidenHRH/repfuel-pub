import 'expo-sqlite/localStorage/install';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { File } from 'expo-file-system';

import { BACKUP_BUCKET, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config';
import { CloudError, type Cloud, type CloudFailure, type CloudUser } from './types';

export * from './types';

let client: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  // The sign-in is kept in the app's own storage (expo-sqlite's localStorage), so it survives restarts.
  client ??= createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { storage: localStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  });
  return client;
}

/** Sorts a Supabase or network error into what the person can do about it. */
function failure(error: unknown): CloudError {
  if (error instanceof CloudError) return error;
  const e = error as { status?: number; statusCode?: string | number; name?: string; message?: string } | null;
  const status = Number(e?.status ?? e?.statusCode);
  const message = e?.message ?? String(error);
  let kind: CloudFailure = 'other';
  if (status === 401 || status === 403) kind = 'signed_out';
  else if (status >= 500) kind = 'unreachable';
  else if (e?.name === 'TypeError' || /network|fetch|timed? ?out/i.test(message)) kind = 'offline';
  return new CloudError(kind, message);
}

async function run<T>(task: () => Promise<{ data: T; error: unknown }>): Promise<T> {
  let result: { data: T; error: unknown };
  try {
    result = await task();
  } catch (error) {
    throw failure(error);
  }
  if (result.error) throw failure(result.error);
  return result.data;
}

const toUser = (u: { id: string; email?: string | null }): CloudUser => ({ id: u.id, email: u.email ?? null });

async function signedUrl(path: string): Promise<string> {
  const data = await run(() => supabase().storage.from(BACKUP_BUCKET).createSignedUrl(path, 120));
  if (!data) throw new CloudError('other', 'No download link');
  return data.signedUrl;
}

const cloud: Cloud = {
  auth: {
    async currentUser() {
      try {
        const { data } = await supabase().auth.getSession();
        return data.session ? toUser(data.session.user) : null;
      } catch {
        return null;
      }
    },
    async sendCode(email) {
      await run(() => supabase().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } }));
    },
    async verifyCode(email, code) {
      const data = await run(() => supabase().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' }));
      if (!data.user) throw new CloudError('other', 'That code didn’t work');
      return toUser(data.user);
    },
    async signOut() {
      await run(async () => ({ data: null, error: (await supabase().auth.signOut()).error }));
    },
  },
  store: {
    async list(folder) {
      const items = await run(() => supabase().storage.from(BACKUP_BUCKET).list(folder, { limit: 1000 }));
      // Folders come back too, with no id.
      return (items ?? []).filter((i) => i.id !== null).map((i) => i.name);
    },
    async uploadText(path, text) {
      await run(() =>
        supabase().storage.from(BACKUP_BUCKET).upload(path, text, { contentType: 'application/json', upsert: true }),
      );
    },
    async uploadBytes(path, bytes, contentType) {
      await run(() => supabase().storage.from(BACKUP_BUCKET).upload(path, bytes, { contentType, upsert: true }));
    },
    async downloadText(path) {
      const url = await signedUrl(path);
      try {
        const res = await fetch(url);
        if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
        return await res.text();
      } catch (error) {
        throw failure(error);
      }
    },
    async downloadToFile(path, file) {
      const url = await signedUrl(path);
      try {
        if (file.exists) file.delete();
        await File.downloadFileAsync(url, file);
      } catch (error) {
        throw failure(error);
      }
    },
    async remove(paths) {
      await run(() => supabase().storage.from(BACKUP_BUCKET).remove(paths));
    },
  },
};

/** The backup server (Supabase). */
export function getCloud(): Cloud {
  return cloud;
}
