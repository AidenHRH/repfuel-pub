import { render, screen } from '@testing-library/react-native';

import { ProgressRing, ringDashOffset } from '@/components/ProgressRing';
import { ThemeProvider } from '@/theme/ThemeProvider';

describe('ringDashOffset', () => {
  const r = 54;
  const circumference = 2 * Math.PI * r;

  test('empty ring is fully offset', () => {
    expect(ringDashOffset(0, r)).toBeCloseTo(circumference);
  });

  test('half progress offsets half the circumference', () => {
    expect(ringDashOffset(0.5, r)).toBeCloseTo(circumference / 2);
  });

  test('progress above 1 is clamped to a full ring', () => {
    expect(ringDashOffset(1.7, r)).toBeCloseTo(ringDashOffset(1, r));
    expect(ringDashOffset(1, r)).toBeCloseTo(0);
  });

  test('negative or non-finite progress is treated as empty', () => {
    expect(ringDashOffset(-0.2, r)).toBeCloseTo(ringDashOffset(0, r));
    expect(ringDashOffset(Number.NaN, r)).toBeCloseTo(ringDashOffset(0, r));
  });
});

test('ProgressRing exposes its accessibility label', async () => {
  await render(
    <ThemeProvider>
      <ProgressRing
        outer={{ progress: 0.4, color: '#FFB547' }}
        inner={{ progress: 0.6, color: '#6CB4FF' }}
        accessibilityLabel="Calories 1,000 of 2,500. Protein 87 of 145 grams."
      />
    </ThemeProvider>,
  );
  expect(screen.getByLabelText('Calories 1,000 of 2,500. Protein 87 of 145 grams.')).toBeTruthy();
});
