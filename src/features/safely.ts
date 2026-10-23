import { Alert } from 'react-native';

/**
 * Runs a user action and tells the owner if it fails, instead of failing silently.
 * Returns the result, or undefined if it failed.
 */
export async function safely<T>(what: string, action: () => Promise<T>): Promise<T | undefined> {
  try {
    return await action();
  } catch {
    Alert.alert(`Couldn’t ${what}`, 'Please try again. If it keeps happening, close and reopen RepFuel.');
    return undefined;
  }
}
