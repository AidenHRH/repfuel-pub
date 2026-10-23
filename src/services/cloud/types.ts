import type { File } from 'expo-file-system';

/** Why talking to the backup server failed, for a message the person can act on. */
export type CloudFailure = 'offline' | 'unreachable' | 'signed_out' | 'other';

export class CloudError extends Error {
  constructor(
    readonly kind: CloudFailure,
    message: string = kind,
  ) {
    super(message);
    this.name = 'CloudError';
  }
}

export type CloudUser = { id: string; email: string | null };

/** Signing in with an emailed 6-digit code. */
export interface CloudAuth {
  currentUser(): Promise<CloudUser | null>;
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<CloudUser>;
  signOut(): Promise<void>;
}

/** The person's private folder of files on the server. Paths start with their user id. Failures throw CloudError. */
export interface CloudStore {
  /** File names (not folders) directly inside `folder`. */
  list(folder: string): Promise<string[]>;
  uploadText(path: string, text: string): Promise<void>;
  uploadBytes(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  downloadText(path: string): Promise<string>;
  downloadToFile(path: string, file: File): Promise<void>;
  remove(paths: string[]): Promise<void>;
}

export type Cloud = { auth: CloudAuth; store: CloudStore };
