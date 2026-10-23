import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/Button';
import { ListGroup, ListRow } from '@/components/ListGroup';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { BackupError } from '@/database/backup';
import {
  backupNow,
  getCloudStatus,
  latestCloudBackup,
  phoneHasData,
  restoreFromCloud,
  type CloudStatus,
} from '@/database/cloudBackup';
import { useDb } from '@/database/DatabaseProvider';
import { failureMessage, lastBackedUpLabel } from '@/domain/cloudText';
import { cloudEvents } from '@/features/cloud/events';
import { nutritionEvents } from '@/features/nutrition/events';
import { workoutEvents } from '@/features/workouts/events';
import { CloudError, getCloud, SignInError, type CloudUser, type SignInProblem } from '@/services/cloud';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const PROBLEMS: Record<SignInProblem, string> = {
  wrong_password: 'That email and password don’t match. If you’re new here, tap Create account.',
  already_registered: 'That email already has an account. Sign in instead.',
  weak_password: 'Use a password of at least 6 characters.',
  needs_confirming:
    'Supabase is asking for email confirmation. In Supabase › Authentication › Sign In / Providers › Email, turn off Confirm email, then try again.',
};

const longDate = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Cloud backup: sign in with an email and password, then the data and recipe photos back up to the person's own private
 * folder on the server, automatically and with Sync now; Restore from cloud brings them back on a new phone.
 */
export function CloudBackupSettings() {
  const db = useDb();
  const { colors } = useTheme();
  const cloud = getCloud();
  const [user, setUser] = useState<CloudUser | null | undefined>(undefined);
  const [status, setStatus] = useState<CloudStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signInError, setSignInError] = useState<string | null>(null);

  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([cloud.auth.currentUser(), getCloudStatus(db)]).then(
      ([u, s]) => {
        if (cancelled) return;
        setUser(u);
        setStatus(s);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [cloud, db, version]);

  useEffect(() => cloudEvents.subscribe(refresh), [refresh]);

  const sync = async (who: CloudUser) => {
    setBusy(true);
    await backupNow(db, cloud, who.id).catch(() => undefined);
    setBusy(false);
    refresh();
  };

  const restore = async (who: CloudUser) => {
    setBusy(true);
    try {
      const { day } = await restoreFromCloud(db, cloud, who.id);
      nutritionEvents.emit({ type: 'changed' });
      workoutEvents.emit({ type: 'changed' });
      Alert.alert('Restored', `Your backup from ${longDate(day)} is on this phone.`);
    } catch (e) {
      Alert.alert(
        'Couldn’t restore',
        e instanceof BackupError
          ? e.message
          : e instanceof CloudError && e.kind !== 'other'
            ? failureMessage(e.kind)
            : 'Nothing was changed. Please try again.',
      );
    }
    setBusy(false);
    refresh();
  };

  const confirmRestore = async (who: CloudUser) => {
    const latest = await latestCloudBackup(cloud, who.id).catch(() => null);
    if (!latest) return Alert.alert('No backup yet', 'There’s nothing on the server to restore.');
    Alert.alert(
      'Replace everything on this phone?',
      `This replaces what’s on this phone with your backup from ${longDate(latest.day)}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore', style: 'destructive', onPress: () => void restore(who) },
      ],
    );
  };

  const signIn = async (mode: 'signIn' | 'create') => {
    setSignInError(null);
    if (mode === 'create' && password.length < 6) {
      setSignInError(PROBLEMS.weak_password);
      return;
    }
    setBusy(true);
    let who: CloudUser;
    try {
      who = mode === 'create' ? await cloud.auth.createAccount(email, password) : await cloud.auth.signIn(email, password);
    } catch (e) {
      setBusy(false);
      setSignInError(
        e instanceof SignInError
          ? PROBLEMS[e.problem]
          : e instanceof CloudError && e.kind !== 'other'
            ? failureMessage(e.kind)
            : 'Couldn’t sign in. Please try again.',
      );
      return;
    }
    setSigningIn(false);
    setPassword('');
    setBusy(false);
    setUser(who);
    // A new phone: offer the backup before anything is uploaded over it.
    const [hasData, latest] = await Promise.all([phoneHasData(db), latestCloudBackup(cloud, who.id).catch(() => null)]);
    if (!hasData && latest) {
      Alert.alert('Restore your backup?', `You have a backup from ${longDate(latest.day)}.`, [
        { text: 'Not now', style: 'cancel', onPress: () => void refresh() },
        { text: 'Restore', onPress: () => void restore(who) },
      ]);
      return;
    }
    await sync(who);
  };

  const signOut = async () => {
    await cloud.auth.signOut().catch(() => undefined);
    refresh();
  };

  if (user === undefined) return null;

  if (!user) {
    return (
      <>
        <ListGroup
          title="Cloud backup"
          footer="Backs up your data and recipe photos to your own private space, automatically whenever you’re online. Sign in on a new phone to get it all back.">
          <ListRow label="Turn on cloud backup" onPress={() => setSigningIn(true)} />
        </ListGroup>
        <Sheet
          visible={signingIn}
          title="Cloud backup"
          onClose={() => {
            setSigningIn(false);
            setSignInError(null);
          }}>
          <View style={{ backgroundColor: colors.well, borderRadius: 18 }}>
            <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" plain />
            <View style={{ height: 1, backgroundColor: colors.sep, marginLeft: spacing.lg }} />
            <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry plain />
          </View>
          <Text variant="caption" color="text2">
            New here? Choose a password and tap Create account. On another phone, sign in with the same details.
          </Text>
          {signInError ? (
            <Text variant="callout" color="danger">
              {signInError}
            </Text>
          ) : null}
          <Button
            label={busy ? 'Signing in…' : 'Sign in'}
            disabled={busy || !/\S+@\S+\.\S+/.test(email) || !password}
            onPress={() => void signIn('signIn')}
          />
          <Button
            variant="secondary"
            label="Create account"
            disabled={busy || !/\S+@\S+\.\S+/.test(email) || !password}
            onPress={() => void signIn('create')}
          />
        </Sheet>
      </>
    );
  }

  const problem = status?.lastError ? failureMessage(status.lastError) : null;
  return (
    <ListGroup title="Cloud backup" footer={problem ?? 'Backs up automatically when you open RepFuel online.'}>
      <ListRow label="Signed in" value={user.email ?? ''} />
      <ListRow
        label="Last backed up"
        value={busy ? 'Backing up…' : status?.lastBackupAt ? lastBackedUpLabel(status.lastBackupAt) : 'Not yet'}
      />
      <ListRow label="Sync now" onPress={() => void sync(user)} />
      <ListRow label="Restore from cloud" onPress={() => void confirmRestore(user)} />
      <ListRow label="Sign out" onPress={() => void signOut()} />
    </ListGroup>
  );
}
