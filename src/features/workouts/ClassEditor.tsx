import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { EffortPicker } from '@/components/EffortPicker';
import { ListGroup, ListRow } from '@/components/ListGroup';
import { ModalScreen } from '@/components/ModalScreen';
import { Segmented } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useDb } from '@/database/DatabaseProvider';
import {
  addClassType,
  deleteClass,
  getClass,
  listClassTypes,
  logClass,
  updateClass,
  type ClassType,
} from '@/database/repositories/classRepository';
import { durationLabel } from '@/domain/classes';
import { safely } from '@/features/safely';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

import { workoutEvents } from './events';

const DEFAULT_MINUTES = 60;
const STEP = 5;

/** The same clock time on today or yesterday. */
function onDay(base: Date, day: 'today' | 'yesterday'): Date {
  const d = new Date(base);
  if (day === 'yesterday') d.setDate(d.getDate() - 1);
  return d;
}

/** Log a class (Hyrox, spin, …): which, when, how long, how hard it felt, and notes. Also edits one. */
export function ClassEditor({
  classId,
  from = 'workouts',
  switcher,
}: {
  classId?: string;
  from?: 'today' | 'workouts';
  switcher?: ReactNode;
}) {
  const db = useDb();
  const router = useRouter();
  const { colors } = useTheme();
  const [types, setTypes] = useState<ClassType[]>([]);
  const [typeId, setTypeId] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [effort, setEffort] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [day, setDay] = useState<'today' | 'yesterday'>('today');
  // Editing keeps the saved time; a new class is timed now.
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [loaded, setLoaded] = useState(!classId);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const saving = useRef(false);

  useEffect(() => {
    let cancelled = false;
    listClassTypes(db).then(
      (list) => !cancelled && setTypes(list),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [db]);

  useEffect(() => {
    if (!classId) return;
    getClass(db, classId).then((c) => {
      if (!c) {
        router.back();
        return;
      }
      setTypeId(c.classTypeId);
      setMinutes(c.durationMin);
      setEffort(c.effort);
      setNotes(c.notes ?? '');
      setSavedAt(new Date(c.at));
      setLoaded(true);
    });
  }, [db, classId, router]);

  const chosen = types.find((t) => t.id === typeId) ?? null;

  const save = async () => {
    if (!chosen || saving.current) return;
    saving.current = true;
    const input = { classTypeId: chosen.id, at: savedAt ?? onDay(new Date(), day), durationMin: minutes, effort, notes };
    const done = await safely(`save ${chosen.name}`, async () => {
      if (classId) await updateClass(db, classId, input);
      else await logClass(db, input);
      return true;
    });
    if (!done) {
      saving.current = false;
      return;
    }
    workoutEvents.emit({ type: 'changed' });
    if (!classId) workoutEvents.emit({ type: 'logged', name: chosen.name, records: [], from });
    router.back();
  };

  const addType = async () => {
    try {
      const made = await addClassType(db, newName);
      setTypes((list) => [...list, made]);
      setTypeId(made.id);
      setAdding(false);
      setNewName('');
      setAddError(null);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Couldn’t add that class.');
    }
  };

  const confirmDelete = () =>
    Alert.alert('Delete this class?', 'It leaves your training history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!classId) return;
          await safely('delete that class', () => deleteClass(db, classId));
          workoutEvents.emit({ type: 'changed' });
          router.back();
        },
      },
    ]);

  const title = classId ? 'Edit class' : 'Log workout';
  if (!loaded)
    return (
      <ModalScreen title={title} onClose={() => router.back()}>
        {null}
      </ModalScreen>
    );

  const chip = (label: string, selected: boolean, onPress: () => void, accessibilityLabel?: string, accent = false) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.lg,
        minHeight: 40,
        borderRadius: radii.pill,
        justifyContent: 'center',
        backgroundColor: selected ? colors.text : colors.card,
      }}>
      <Text
        variant="callout"
        style={{
          color: selected ? colors.bg : accent ? colors.pro : colors.text,
          fontFamily: selected ? fonts.semibold : fonts.medium,
        }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <ModalScreen
      title={title}
      onClose={() => router.back()}
      footer={<Button label={chosen ? `Save ${chosen.name}` : 'Save class'} onPress={save} disabled={!chosen} haptic />}>
      {classId ? null : switcher}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {types.map((t) => chip(t.name, t.id === typeId, () => setTypeId(t.id)))}
        {chip('+ New class', false, () => setAdding(true), 'New class', true)}
      </View>

      <ListGroup>
        {classId ? null : (
          <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm }}>
            <Text>When</Text>
            <Segmented
              accessibilityLabel="When"
              value={day}
              onChange={setDay}
              options={[
                { value: 'today', label: 'Today' },
                { value: 'yesterday', label: 'Yesterday' },
              ]}
            />
          </View>
        )}
        <ListRow label="How long">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Button
              variant="secondary"
              label="−"
              accessibilityLabel={`${STEP} minutes less`}
              disabled={minutes <= STEP}
              onPress={() => setMinutes((m) => Math.max(STEP, m - STEP))}
              style={{ paddingHorizontal: spacing.md }}
            />
            <Text numeric style={{ minWidth: 76, textAlign: 'center', fontFamily: fonts.semibold }}>
              {durationLabel(minutes)}
            </Text>
            <Button
              variant="secondary"
              label="+"
              accessibilityLabel={`${STEP} minutes more`}
              disabled={minutes >= 300}
              onPress={() => setMinutes((m) => Math.min(300, m + STEP))}
              style={{ paddingHorizontal: spacing.md }}
            />
          </View>
        </ListRow>
      </ListGroup>

      <View style={{ backgroundColor: colors.card, borderRadius: radii.hero, padding: spacing.lg, gap: spacing.md }}>
        <Text variant="overline" color="text2">
          How hard was it?
        </Text>
        <EffortPicker variant="class" value={effort} onChange={setEffort} accessibilityLabel="How hard, 1 to 10" />
      </View>

      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: radii.card,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          gap: spacing.xs,
        }}>
        <Text variant="caption" color="text2">
          Notes
        </Text>
        <TextInput
          accessibilityLabel="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="How it went, PBs, what to work on"
          placeholderTextColor={colors.text2}
          multiline
          selectionColor={colors.pro}
          style={{
            color: colors.text,
            fontFamily: fonts.regular,
            fontSize: 16,
            minHeight: 48,
            padding: 0,
            textAlignVertical: 'top',
          }}
        />
      </View>

      <View
        style={{
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.track,
          borderRadius: radii.card,
          padding: spacing.md,
        }}>
        <Text variant="callout" color="text2">
          Later: heart rate and strain from Health Connect
        </Text>
      </View>

      {classId ? <Button variant="plain" label="Delete class" onPress={confirmDelete} /> : null}

      <Sheet visible={adding} title="New class" onClose={() => setAdding(false)}>
        <ListGroup>
          <TextField
            label="Name"
            accessibilityLabel="Class name"
            value={newName}
            onChangeText={setNewName}
            placeholder="e.g. Yoga"
            autoFocus
            error={addError ?? undefined}
          />
        </ListGroup>
        <Button label="Add class" onPress={addType} disabled={!newName.trim()} />
      </Sheet>
    </ModalScreen>
  );
}
