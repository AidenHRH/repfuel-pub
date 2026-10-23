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

/** Why signing in or creating an account was refused. */
export type SignInProblem = 'wrong_password' | 'already_registered' | 'weak_password' | 'needs_confirming';

export class SignInError extends Error {
  constructor(readonly problem: SignInProblem) {
    super(problem);
    this.name = 'SignInError';
  }
}

/** Signing in with an email and password (no emails are sent). Refusals throw SignInError, failures CloudError. */
export interface CloudAuth {
  currentUser(): Promise<CloudUser | null>;
  signIn(email: string, password: string): Promise<CloudUser>;
  createAccount(email: string, password: string): Promise<CloudUser>;
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
