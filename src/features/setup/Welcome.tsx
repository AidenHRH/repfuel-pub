import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ModalScreen } from '@/components/ModalScreen';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useDb } from '@/database/DatabaseProvider';
import { completeSetup } from '@/database/repositories/setupRepository';
import {
  GOAL_LABELS,
  suggestTargets,
  type Activity,
  type BmiBand,
  type Goal,
  type Sex,
  type SuggestedTargets,
} from '@/domain/suggestTargets';
import { validateTargets } from '@/domain/targets';
import { safely } from '@/features/safely';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

const ACTIVITIES: { value: Activity; label: string; detail: string }[] = [
  { value: 'low', label: 'Mostly sitting', detail: 'A desk job and little exercise' },
  { value: 'light', label: 'Lightly active', detail: 'Exercise 1–3 days a week' },
  { value: 'moderate', label: 'Active', detail: 'Exercise 3–5 days a week' },
  { value: 'very', label: 'Very active', detail: 'Hard exercise 6–7 days a week, or a physical job' },
];
const GOALS: Goal[] = ['lose', 'maintain', 'build'];

const BAND_LABELS: Record<BmiBand, string> = {
  underweight: 'underweight range',
  healthy: 'healthy range',
  overweight: 'overweight range',
  obese: 'obese range',
};

/** A number typed in a field, or null when it isn't one in [min, max]. */
function numberIn(text: string, min: number, max: number): number | null {
  const n = Number(text.trim().replace(',', '.'));
  return text.trim() && Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function pace(t: SuggestedTargets): string {
  if (t.weeklyChangeKg < 0) return `About ${-t.weeklyChangeKg} kg a week down: steady enough to keep your muscle and stick to.`;
  if (t.weeklyChangeKg > 0) return `About ${t.weeklyChangeKg} kg a week up: slow gains keep it mostly muscle.`;
  return 'Keeps your weight about where it is.';
}

/** First-run setup: about you, how active you are and your goal, then realistic suggested targets to start from. */
export function Welcome({ onDone }: { onDone: () => void }) {
  const db = useDb();
  const { colors } = useTheme();
  const [step, setStep] = useState(0);
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [kcalText, setKcalText] = useState('');
  const [proteinText, setProteinText] = useState('');
  const [saving, setSaving] = useState(false);

  const ageN = numberIn(age, 16, 100);
  const heightN = numberIn(height, 120, 230);
  const weightN = numberIn(weight, 35, 300);
  const bodyFatN = bodyFat.trim() ? numberIn(bodyFat, 3, 60) : null;
  const aboutOk = ageN !== null && heightN !== null && weightN !== null && sex !== null && (!bodyFat.trim() || bodyFatN !== null);
  const answers =
    aboutOk && activity && goal ? { age: ageN, heightCm: heightN, weightKg: weightN, sex: sex, activity, goal } : null;
  const suggested = answers ? suggestTargets(answers) : null;
  const edited = validateTargets(kcalText, proteinText);

  const toTargets = () => {
    if (!suggested) return;
    setKcalText(String(suggested.kcal));
    setProteinText(String(suggested.proteinG));
    setStep(2);
  };

  const start = async () => {
    if (!answers || !edited.ok) return;
    setSaving(true);
    const saved = await safely('save your details', async () => {
      await completeSetup(
        db,
        { ...answers, bodyFatPercentage: bodyFatN },
        { kcal: edited.caloriesKcal, proteinG: edited.proteinGrams },
      );
      return true;
    });
    setSaving(false);
    if (saved) onDone();
  };

  const footer =
    step === 2 ? (
      <Button label={saving ? 'Saving…' : 'Start using RepFuel'} disabled={!edited.ok || saving} onPress={() => void start()} />
    ) : (
      <Button
        label="Next"
        disabled={step === 0 ? !aboutOk : !activity || !goal}
        onPress={() => (step === 0 ? setStep(1) : toTargets())}
      />
    );

  const choice = (key: string, selected: boolean, label: string, detail: string | null, onPress: () => void) => (
    <Pressable
      key={key}
      accessibilityRole="radio"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={{
        padding: spacing.lg,
        borderRadius: radii.card,
        backgroundColor: colors.card,
        borderWidth: 2,
        borderColor: selected ? colors.pro : 'transparent',
        gap: 2,
      }}>
      <Text style={{ fontFamily: fonts.medium }}>{label}</Text>
      {detail ? (
        <Text variant="caption" color="text2">
          {detail}
        </Text>
      ) : null}
    </Pressable>
  );

  return (
    <ModalScreen
      title={step === 0 ? 'Welcome' : step === 1 ? 'Your goal' : 'Your targets'}
      closeLabel="Back"
      onClose={step === 0 ? undefined : () => setStep(step - 1)}
      footer={footer}>
      {step === 0 ? (
        <>
          <View style={{ gap: spacing.sm }}>
            <Text variant="title">Welcome to RepFuel</Text>
            <Text color="text2">
              A few questions so your calorie and protein targets fit you. Your answers stay on this phone.
            </Text>
          </View>
          <View style={{ backgroundColor: colors.card, borderRadius: radii.card }}>
            <TextField label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" suffix="years" />
            <View style={{ height: 1, backgroundColor: colors.sep, marginLeft: spacing.lg }} />
            <TextField label="Height" value={height} onChangeText={setHeight} keyboardType="decimal-pad" suffix="cm" />
            <View style={{ height: 1, backgroundColor: colors.sep, marginLeft: spacing.lg }} />
            <TextField label="Weight" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" suffix="kg" />
            <View style={{ height: 1, backgroundColor: colors.sep, marginLeft: spacing.lg }} />
            <TextField
              label="Body fat"
              value={bodyFat}
              onChangeText={setBodyFat}
              keyboardType="decimal-pad"
              suffix="%"
              placeholder="Optional"
            />
          </View>
          <View style={{ gap: spacing.sm }}>
            <Text variant="callout" color="text2" style={{ paddingHorizontal: spacing.xs }}>
              For the calorie estimate
            </Text>
            <Segmented
              accessibilityLabel="Sex"
              value={sex ?? ('' as Sex)}
              onChange={setSex}
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'unspecified', label: 'Prefer not to say' },
              ]}
            />
          </View>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <View style={{ gap: spacing.sm }}>
            <Text variant="headline" accessibilityRole="header">
              How active are you?
            </Text>
            {ACTIVITIES.map((a) => choice(a.value, activity === a.value, a.label, a.detail, () => setActivity(a.value)))}
          </View>
          <View style={{ gap: spacing.sm }}>
            <Text variant="headline" accessibilityRole="header">
              What’s your goal?
            </Text>
            {GOALS.map((g) => choice(g, goal === g, GOAL_LABELS[g], null, () => setGoal(g)))}
          </View>
        </>
      ) : null}

      {step === 2 && suggested ? (
        <>
          <Card style={{ gap: spacing.xs }}>
            <Text variant="headline" numeric>{`BMI ${suggested.bmi} · ${BAND_LABELS[suggested.band]}`}</Text>
            <Text variant="caption" color="text2">
              BMI doesn’t tell muscle from fat, so treat it as a rough guide.
            </Text>
            <Text variant="callout" color="text2" numeric>
              {`You burn about ${suggested.maintenanceKcal.toLocaleString('en-GB')} kcal a day.`}
            </Text>
          </Card>
          <View style={{ gap: spacing.sm }}>
            <Text variant="callout" color="text2" style={{ paddingHorizontal: spacing.xs }}>
              Suggested to start with. Change them if you like.
            </Text>
            <View style={{ backgroundColor: colors.card, borderRadius: radii.card }}>
              <TextField
                label="Calories"
                accessibilityLabel="Calorie target"
                value={kcalText}
                onChangeText={setKcalText}
                keyboardType="number-pad"
                suffix="kcal"
              />
              <View style={{ height: 1, backgroundColor: colors.sep, marginLeft: spacing.lg }} />
              <TextField
                label="Protein"
                accessibilityLabel="Protein target"
                value={proteinText}
                onChangeText={setProteinText}
                keyboardType="number-pad"
                suffix="g"
              />
            </View>
            <Text variant="caption" color="text2" style={{ paddingHorizontal: spacing.xs }}>
              {pace(suggested)}
            </Text>
            {suggested.notes.map((note) => (
              <Text key={note} variant="caption" color="text2" style={{ paddingHorizontal: spacing.xs }}>
                {note}
              </Text>
            ))}
            <Text variant="caption" color="text2" style={{ paddingHorizontal: spacing.xs }}>
              You can change these any time in Settings.
            </Text>
          </View>
        </>
      ) : null}
    </ModalScreen>
  );
}
