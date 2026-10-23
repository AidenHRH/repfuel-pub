import { act, render } from '@testing-library/react-native';
import * as SystemUI from 'expo-system-ui';

import appConfig from '../../app.json';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { palettes } from '@/theme/tokens';

jest.mock('expo-system-ui', () => ({ setBackgroundColorAsync: jest.fn(async () => undefined) }));

test('the native root background starts dark, so no white flashes behind the app', () => {
  expect(appConfig.expo.backgroundColor).toBe(palettes.dark.bg);
});

test('switching theme repaints the native root background to match', async () => {
  let api: ReturnType<typeof useTheme> | undefined;
  function Probe() {
    api = useTheme();
    return null;
  }
  await render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
  expect(SystemUI.setBackgroundColorAsync).toHaveBeenLastCalledWith(palettes.dark.bg);

  await act(async () => api!.setTheme('light'));
  expect(SystemUI.setBackgroundColorAsync).toHaveBeenLastCalledWith(palettes.light.bg);
});
