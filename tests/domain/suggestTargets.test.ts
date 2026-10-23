import { bmi, bmiBand, suggestTargets, type SetupAnswers } from '@/domain/suggestTargets';

const base: SetupAnswers = { age: 30, heightCm: 175, weightKg: 75, sex: 'male', activity: 'moderate', goal: 'maintain' };

describe('bmi', () => {
  test('weight over height squared, one decimal, with the NHS bands', () => {
    expect(bmi(75, 175)).toBe(24.5);
    expect(bmiBand(17.9)).toBe('underweight');
    expect(bmiBand(18.5)).toBe('healthy');
    expect(bmiBand(25)).toBe('overweight');
    expect(bmiBand(30)).toBe('obese');
  });
});

describe('suggestTargets', () => {
  test('maintain is the estimated daily burn, rounded to 50', () => {
    // Mifflin-St Jeor: 10×75 + 6.25×175 − 5×30 + 5 = 1698.75; × 1.55 = 2633 → 2650.
    const t = suggestTargets(base);
    expect(t.maintenanceKcal).toBe(2650);
    expect(t.kcal).toBe(2650);
    expect(t.proteinG).toBe(120); // 1.6 g/kg × 75
  });

  test('losing fat is a steady deficit of at most 500 kcal, about half a kilo a week', () => {
    const t = suggestTargets({ ...base, goal: 'lose' });
    expect(t.kcal).toBe(2150);
    expect(t.weeklyChangeKg).toBe(-0.5);
    expect(t.proteinG).toBe(135); // 1.8 g/kg
  });

  test('the deficit is smaller for a smaller burn, and never below basal needs', () => {
    const t = suggestTargets({ age: 60, heightCm: 155, weightKg: 50, sex: 'female', activity: 'low', goal: 'lose' });
    // BMR 10×50 + 6.25×155 − 300 − 161 = 1007.75; burn ×1.2 = 1209; 20% off = 967 → floor 1200.
    expect(t.kcal).toBe(1200);
    expect(t.kcal).toBeGreaterThanOrEqual(1200);
  });

  test('building muscle is a modest surplus', () => {
    const t = suggestTargets({ ...base, goal: 'build' });
    expect(t.kcal).toBe(2900);
    expect(t.weeklyChangeKg).toBe(0.25);
  });

  test('underweight and asking to lose: suggests maintaining instead, and says why', () => {
    const t = suggestTargets({ ...base, weightKg: 52, goal: 'lose' });
    expect(t.bmi).toBe(17);
    expect(t.kcal).toBe(t.maintenanceKcal);
    expect(t.notes.join(' ')).toMatch(/underweight/i);
  });

  test('protein uses a healthy-BMI weight for a high BMI, so it stays realistic', () => {
    const t = suggestTargets({ ...base, weightKg: 120, goal: 'lose' });
    // Healthy-BMI weight at 175 cm: 25 × 1.75² = 76.6 kg; × 1.8 = 138 → 140.
    expect(t.proteinG).toBe(140);
  });

  test('prefer not to say uses the average of the two estimates', () => {
    const t = suggestTargets({ ...base, sex: 'unspecified' });
    // (1698.75 − 83) × 1.55 = 2504 → 2500.
    expect(t.maintenanceKcal).toBe(2500);
  });
});
