import type { CloudFailure } from '@/services/cloud/types';

import { localDayKey, localTimeLabel } from './dates';

/** What went wrong with a backup, in words the person can act on. */
export function failureMessage(kind: CloudFailure): string {
  switch (kind) {
    case 'offline':
      return 'Not backed up yet. It’ll try again when you’re online.';
    case 'unreachable':
      return 'Couldn’t reach the server. If nobody has used RepFuel for a week, open supabase.com and press Restore project.';
    case 'signed_out':
      return 'You’ve been signed out. Sign in again to keep backing up.';
    default:
      return 'The backup didn’t work. Try Sync now.';
  }
}

/** "14:32 today", "yesterday 09:10" or "22 Oct". */
export function lastBackedUpLabel(iso: string, now: Date = new Date()): string {
  const day = localDayKey(new Date(iso));
  if (day === localDayKey(now)) return `${localTimeLabel(iso)} today`;
  if (day === localDayKey(new Date(now.getTime() - 86_400_000))) return `yesterday ${localTimeLabel(iso)}`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
