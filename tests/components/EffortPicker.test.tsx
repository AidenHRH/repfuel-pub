import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { EffortPicker } from '@/components/EffortPicker';
import { ThemeProvider } from '@/theme/ThemeProvider';

function Harness({ variant, onChange }: { variant: 'set' | 'class'; onChange: (v: number | null) => void }) {
  const [value, setValue] = useState<number | null>(null);
  return (
    <ThemeProvider>
      <EffortPicker
        variant={variant}
        value={value}
        accessibilityLabel="Effort"
        onChange={(v) => {
          setValue(v);
          onChange(v);
        }}
      />
    </ThemeProvider>
  );
}

test('a set effort: tap a number, see what it means, hold to clear', async () => {
  const onChange = jest.fn();
  await render(<Harness variant="set" onChange={onChange} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Effort 8' }));
  expect(onChange).toHaveBeenLastCalledWith(8);
  expect(screen.getByRole('button', { name: 'Effort 8' }).props.accessibilityState).toMatchObject({ selected: true });
  expect(screen.getByText('8 · 2 reps left in the tank')).toBeTruthy();
  await fireEvent(screen.getByRole('button', { name: 'Effort 8' }), 'longPress');
  expect(onChange).toHaveBeenLastCalledWith(null);
});

test('a class effort uses the session scale wording', async () => {
  const onChange = jest.fn();
  await render(<Harness variant="class" onChange={onChange} />);
  await fireEvent.press(screen.getByRole('button', { name: '9, Very, very hard' }));
  expect(onChange).toHaveBeenLastCalledWith(9);
  expect(screen.getByText('Very, very hard')).toBeTruthy();
  expect(screen.getByText('Could barely speak')).toBeTruthy();
});
