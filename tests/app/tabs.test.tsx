import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';

jest.mock('@/database/expoDb', () => ({
  openExpoDb: async () => jest.requireActual('../helpers/testDb').createTestDb(),
}));

const appDir = path.resolve(__dirname, '../../src/app');

async function renderApp() {
  await renderRouter(appDir, { initialUrl: '/' });
  // The root layout waits for fonts before rendering anything.
  await screen.findByRole('button', { name: /^Choose a day/ });
}

describe('tab navigation', () => {
  test('shows all five tabs and opens on Today', async () => {
    await renderApp();

    ['Summary', 'Nutrition', 'Workouts', 'Progress', 'Settings'].forEach((label, i) => {
      // Screen readers announce each tab as "<name>, tab, <n> of 5".
      expect(screen.getByLabelText(`${label}, tab, ${i + 1} of 5`)).toBeTruthy();
    });
    expect(screen).toHavePathname('/');
  });

  test('Today shows real totals (zero logged against the saved target), never sample data', async () => {
    await renderApp();

    expect(await screen.findByText('Nothing logged yet today')).toBeTruthy();
    expect(screen.getByText('2,500 left')).toBeTruthy();
    expect(screen.getByLabelText('Calories 0 of 2,500. Protein 0 of 145 grams.')).toBeTruthy();
  });

  test('tapping the Workouts tab opens Workouts with an honest empty state', async () => {
    await renderApp();

    await fireEvent.press(screen.getByLabelText(/^Workouts, tab/));

    expect(await screen.findByRole('header', { name: 'Workouts' })).toBeTruthy();
    expect(await screen.findByText('No training yet')).toBeTruthy();
    expect(screen).toHavePathname('/workouts');
  });
});
