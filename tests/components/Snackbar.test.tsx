import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { Snackbar } from '@/components/Snackbar';
import { ThemeProvider } from '@/theme/ThemeProvider';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('actions call their handlers', async () => {
  const undo = jest.fn();
  await render(
    <ThemeProvider>
      <Snackbar message="Logged Overnight oats" actions={[{ label: 'Undo', onPress: undo }]} onTimeout={() => {}} />
    </ThemeProvider>,
  );
  expect(screen.getByText('Logged Overnight oats')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
  expect(undo).toHaveBeenCalledTimes(1);
});

test('it times out once after 4.5 seconds', async () => {
  const onTimeout = jest.fn();
  await render(
    <ThemeProvider>
      <Snackbar message="Logged" actions={[]} onTimeout={onTimeout} />
    </ThemeProvider>,
  );
  await act(async () => jest.advanceTimersByTime(4400));
  expect(onTimeout).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(200));
  expect(onTimeout).toHaveBeenCalledTimes(1);
});

test('a new message restarts the timer', async () => {
  const onTimeout = jest.fn();
  const view = await render(
    <ThemeProvider>
      <Snackbar message="Logged A" actions={[]} onTimeout={onTimeout} />
    </ThemeProvider>,
  );
  await act(async () => jest.advanceTimersByTime(4000));
  await view.rerender(
    <ThemeProvider>
      <Snackbar message="Logged B" actions={[]} onTimeout={onTimeout} />
    </ThemeProvider>,
  );
  await act(async () => jest.advanceTimersByTime(4000));
  expect(onTimeout).not.toHaveBeenCalled();
});
