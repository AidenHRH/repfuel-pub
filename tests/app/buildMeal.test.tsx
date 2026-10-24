import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { entriesForDay } from '@/database/repositories/foodLogRepository';
import type { FoodDraft, FoodProvider, LookupResult } from '@/services/food-provider/types';

import { finishBasket } from '../helpers/basket';
import { migratedDb, seedRegulars } from '../helpers/seed';

let mockDb: Db;
const mockResults: LookupResult[] = [];
const mockLookup = jest.fn(async (_code: string) => mockResults.shift() ?? ({ status: 'not_found' } as LookupResult));
const mockCamera: { onBarcodeScanned?: (r: { type: string; data: string }) => void; torch?: boolean } = {};
const mockPermission = { current: { granted: true, canAskAgain: true, status: 'granted' } };
const mockGetPermission = jest.fn(async () => mockPermission.current);

jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));
jest.mock('@/services/foodProvider', () => ({ getFoodProvider: (): FoodProvider => ({ lookup: mockLookup }) }));
// Google's scanner (Play services): off unless a test turns it on.
const mockModern: {
  available: boolean;
  listener?: (r: { type: string; data: string }) => void;
  launch: (options: unknown) => Promise<void>;
} = { available: false, launch: jest.fn(async () => undefined) };
const mockPhoto = {
  take: jest.fn(async (): Promise<{ uri: string; base64?: string }> => ({ uri: 'file:///photo.jpg', base64: 'PHOTO' })),
  read: jest.fn((_base64: string): string | null => null),
};
jest.mock('@/services/barcodeFromPhoto', () => ({ barcodeFromJpegBase64: (b64: string) => mockPhoto.read(b64) }));
jest.mock('expo-camera', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const CameraView = React.forwardRef(
    (
      props: { onBarcodeScanned?: (r: { type: string; data: string }) => void; enableTorch?: boolean },
      ref: React.Ref<unknown>,
    ) => {
      mockCamera.onBarcodeScanned = props.onBarcodeScanned;
      mockCamera.torch = !!props.enableTorch;
      React.useImperativeHandle(ref, () => ({
        takePictureAsync: () => mockPhoto.take(),
        getAvailablePictureSizesAsync: async () => ['4000x3000', '1920x1080', '640x480'],
      }));
      return null;
    },
  );
  Object.defineProperty(CameraView, 'isModernBarcodeScannerAvailable', { get: () => mockModern.available });
  Object.assign(CameraView, {
    launchScanner: (options: unknown) => mockModern.launch(options),
    onModernBarcodeScanned: (listener: (r: { type: string; data: string }) => void) => {
      mockModern.listener = listener;
      return { remove: () => (mockModern.listener = undefined) };
    },
  });
  return {
    CameraView,
    useCameraPermissions: () => [mockPermission.current, jest.fn(), mockGetPermission],
  };
});

const appDir = path.resolve(__dirname, '../../src/app');

const fusilli: FoodDraft = {
  name: 'Fusilli',
  brand: 'Shop',
  basis: 'per_100g',
  servingSize: 75,
  packSize: 500,
  nutrients: { kcal: 359, proteinG: 12, carbsG: 72, fatG: 1.5, fibreG: 3 },
  missing: [],
};
const tuna: FoodDraft = {
  name: 'Tuna chunks',
  brand: 'Shop',
  basis: 'per_100g',
  servingSize: null,
  packSize: 145,
  nutrients: { kcal: 109, proteinG: 25, carbsG: 0, fatG: 1, fibreG: 0 },
  missing: [],
};

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T17:30:00Z'), advanceTimers: true }); // 18:30 London: dinner
  mockDb = await migratedDb();
  mockResults.length = 0;
});
afterEach(() => jest.useRealTimers());

async function openBuildMeal() {
  await renderRouter(appDir, { initialUrl: '/' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Log food' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Build a meal' }));
  await screen.findByRole('header', { name: 'Build a meal' });
}

async function scanIngredient(code: string) {
  await fireEvent.press(screen.getByRole('button', { name: 'Scan ingredient' }));
  await screen.findByRole('header', { name: 'Scan barcode' });
  await fireEvent.changeText(screen.getByLabelText('Barcode number'), code);
  await fireEvent.press(screen.getByRole('button', { name: 'Look up' }));
}

test('tuna pasta: scan each packet, half the pasta bag and a can of tuna, makes 3, log one and keep it', async () => {
  await openBuildMeal();
  mockResults.push({ status: 'found', draft: fusilli });
  await scanIngredient('5000000000011');
  // Back in the meal with the amount open.
  await screen.findByRole('header', { name: 'Fusilli' });
  await fireEvent.press(screen.getByRole('button', { name: '1 pack · 500 g' }));
  await fireEvent.press(screen.getByRole('button', { name: '½' }));
  expect(screen.getByText('250 g of a 500 g pack')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
  expect(await screen.findByRole('button', { name: 'Change Fusilli, 250 g' })).toBeTruthy();

  mockResults.push({ status: 'found', draft: tuna });
  await scanIngredient('5000000000028');
  await screen.findByRole('header', { name: 'Tuna chunks' });
  await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
  expect(await screen.findByRole('button', { name: 'Change Tuna chunks, 145 g' })).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Name'), 'Tuna pasta');
  await fireEvent.press(screen.getByRole('button', { name: 'More portions' }));
  await fireEvent.press(screen.getByRole('button', { name: 'More portions' }));
  expect(screen.getByText('Makes 3 portions')).toBeTruthy();
  // The numbers are for the portion being logged, not the whole pan.
  expect(screen.getByLabelText('Your portion')).toBeTruthy();
  // More than one portion: kept for the rest by default.
  expect(screen.getByLabelText('Save to My meals').props.value).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Log' }));

  await finishBasket();
  expect(await screen.findByText('Logged Tuna pasta')).toBeTruthy();
  const [entry] = await entriesForDay(mockDb, '2026-10-22');
  // (250 g × 3.59 + 145 g × 1.09) / 3
  expect(entry.nutrients.kcal).toBeCloseTo((897.5 + 158.05) / 3, 1);

  // The Logged banner sits where the buttons go for a few seconds.
  await act(async () => jest.advanceTimersByTime(5000));
  await fireEvent.press(await screen.findByRole('button', { name: 'Log food' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Saved meals' }));
  expect(await screen.findByRole('button', { name: 'Log 1 portion of Tuna pasta' })).toBeTruthy();
});

test('a scanned ingredient missing protein is checked first, then lands back in the meal', async () => {
  await openBuildMeal();
  mockResults.push({
    status: 'found',
    draft: { ...tuna, nutrients: { ...tuna.nutrients, proteinG: null }, missing: ['proteinG'] },
  });
  await scanIngredient('5000000000028');
  await screen.findByRole('header', { name: 'Check product' });
  expect(screen.queryByRole('button', { name: 'Save and log' })).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Protein'), '25');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

  await screen.findByRole('header', { name: 'Tuna chunks' });
  await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
  await screen.findByRole('header', { name: 'Build a meal' });
  expect(screen.getByRole('button', { name: 'Change Tuna chunks, 145 g' })).toBeTruthy();
});

test('change an ingredient’s amount in place, or remove it', async () => {
  await seedRegulars(mockDb);
  await openBuildMeal();
  for (const [name, grams] of [
    ['sweet-potato', '100'],
    ['beef', '150'],
  ]) {
    await fireEvent.press(screen.getByRole('button', { name: 'Add ingredient' }));
    await fireEvent.press(await screen.findByRole('button', { name: `Choose ${name}` }));
    await fireEvent.changeText(await screen.findByLabelText('Amount'), grams);
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
  }
  await fireEvent.press(await screen.findByRole('button', { name: 'Change sweet-potato, 100 g' }));
  await fireEvent.changeText(await screen.findByLabelText('Amount'), '150');
  await fireEvent.press(screen.getByRole('button', { name: 'Update' }));

  const rows = (await screen.findAllByRole('button', { name: /^Change / })).map((b) => b.props.accessibilityLabel);
  expect(rows).toEqual(['Change sweet-potato, 150 g', 'Change beef, 150 g']);
  // 150 g × 0.86 + 150 g × 1.37
  expect(screen.getByText('335 kcal')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Remove beef' }));
  expect(screen.queryByRole('button', { name: 'Change beef, 150 g' })).toBeNull();
});

test('loose veg: built-in foods can go in too', async () => {
  await openBuildMeal();
  await fireEvent.press(screen.getByRole('button', { name: 'Add ingredient' }));
  await fireEvent.changeText(await screen.findByLabelText('Search ingredients'), 'onion');
  await fireEvent.press(await screen.findByRole('button', { name: 'Choose Onion' }));
  await screen.findByRole('header', { name: 'Onion' });
  await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
  expect(await screen.findByRole('button', { name: 'Change Onion, 110 g' })).toBeTruthy();
});

test('hold a saved meal to edit it', async () => {
  await seedRegulars(mockDb);
  await renderRouter(appDir, { initialUrl: '/saved-meals' });
  await fireEvent(await screen.findByRole('button', { name: 'Log 1 portion of Overnight oats' }), 'longPress');
  expect(await screen.findByRole('header', { name: 'Edit recipe' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Scan ingredient' })).toBeTruthy();
});
