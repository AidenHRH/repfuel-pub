import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';
import { AppState } from 'react-native';

import type { Db } from '@/database/Db';
import { createFood, listFoods } from '@/database/repositories/foodRepository';
import type { FoodProvider, LookupResult } from '@/services/food-provider/types';

import { migratedDb } from '../helpers/seed';

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

const wheyDraft = {
  name: 'Whey Protein Chocolate',
  brand: 'Test Nutrition',
  basis: 'per_100g' as const,
  servingSize: 25,
  nutrients: { kcal: 400, proteinG: 76, carbsG: null, fatG: 6.1, fibreG: null },
  missing: ['carbsG' as const, 'fibreG' as const],
};

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T08:00:00Z'), advanceTimers: true });
  mockDb = await migratedDb();
  mockResults.length = 0;
  mockLookup.mockClear();
  mockGetPermission.mockClear();
  mockPermission.current = { granted: true, canAskAgain: true, status: 'granted' };
  mockModern.available = false;
  mockModern.launch = jest.fn(async () => undefined);
});
afterEach(() => jest.useRealTimers());

async function typeBarcode(code: string) {
  await renderRouter(appDir, { initialUrl: '/' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Log food' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Scan barcode' }));
  await screen.findByRole('header', { name: 'Scan barcode' });
  await fireEvent.changeText(screen.getByLabelText('Barcode number'), code);
  await fireEvent.press(screen.getByRole('button', { name: 'Look up' }));
}

test('scan a product with calories and protein, pick an amount and log it; it is saved for next time', async () => {
  mockResults.push({ status: 'found', draft: wheyDraft });
  await typeBarcode('5056000000017');

  await screen.findByRole('header', { name: 'Whey Protein Chocolate' });
  expect(screen.getByText('1 serving = 25 g')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Amount'), '30');
  await fireEvent.press(screen.getByRole('button', { name: /^Log 30 g · / }));

  expect(await screen.findByLabelText('Calories 120 of 2,500. Protein 23 of 145 grams.')).toBeTruthy();
  expect((await listFoods(mockDb, { search: 'whey' }))[0]).toMatchObject({
    barcode: '5056000000017',
    dataSource: 'open_food_facts',
  });
});

test('a barcode you already saved goes straight to logging, without a lookup', async () => {
  await createFood(mockDb, {
    name: 'My shake',
    brand: null,
    barcode: '5056000000017',
    basis: 'per_serving',
    servingSize: 30,
    servingUnit: 'g',
    nutrients: { kcal: 120, proteinG: 24, carbsG: 3, fatG: 1.5, fibreG: null },
    dataSource: 'manual',
    notes: null,
  });
  await typeBarcode('5056000000017');
  await screen.findByRole('header', { name: 'My shake' });
  expect(mockLookup).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: /^Log 1 serving · / }));
  expect(await screen.findByLabelText('Calories 120 of 2,500. Protein 24 of 145 grams.')).toBeTruthy();
});

test('an unknown product keeps the barcode for entering it yourself', async () => {
  mockResults.push({ status: 'not_found' });
  await typeBarcode('1234567890128');
  expect(await screen.findByText('Not in Open Food Facts yet')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Enter it yourself' }));
  await screen.findByRole('header', { name: 'New food' });
  expect(screen.getByText('Barcode 1234567890128')).toBeTruthy();
});

test('no signal offers Retry and keeps the barcode', async () => {
  mockResults.push({ status: 'error', reason: 'offline' }, { status: 'found', draft: wheyDraft });
  await typeBarcode('5056000000017');
  expect(await screen.findByText('No internet connection')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByRole('header', { name: 'Whey Protein Chocolate' })).toBeTruthy();
  expect(mockLookup).toHaveBeenCalledTimes(2);
});

test('the camera reporting the same barcode many times only looks it up once', async () => {
  mockResults.push({ status: 'found', draft: wheyDraft });
  await renderRouter(appDir, { initialUrl: '/scan' });
  await screen.findByRole('header', { name: 'Scan barcode' });
  await act(async () => {
    mockCamera.onBarcodeScanned?.({ type: 'ean13', data: '5056000000017' });
    mockCamera.onBarcodeScanned?.({ type: 'ean13', data: '5056000000017' });
    mockCamera.onBarcodeScanned?.({ type: 'ean13', data: '5056000000017' });
  });
  await screen.findByRole('header', { name: 'Whey Protein Chocolate' });
  expect(mockLookup).toHaveBeenCalledTimes(1);
});

test('after turning the camera on in Android settings, coming back re-checks permission', async () => {
  mockPermission.current = { granted: false, canAskAgain: false, status: 'denied' };
  const listeners: ((state: string) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    listeners.push(listener as (state: string) => void);
    return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
  });
  await renderRouter(appDir, { initialUrl: '/scan' });
  expect(await screen.findByText('Camera is turned off for RepFuel')).toBeTruthy();

  await act(async () => listeners.forEach((l) => l('active')));
  expect(mockGetPermission).toHaveBeenCalled();
});

test('a product missing protein asks for it, since protein is required', async () => {
  mockResults.push({
    status: 'found',
    draft: { ...wheyDraft, nutrients: { ...wheyDraft.nutrients, proteinG: null }, missing: ['proteinG', 'carbsG', 'fibreG'] },
  });
  await typeBarcode('5056000000017');
  await screen.findByRole('header', { name: 'Check product' });
  expect(screen.getByText(/Add protein from the label/)).toBeTruthy();
  expect(screen.getByText(/Not listed: carbs, fibre/)).toBeTruthy();
});

test('a per-100 g food with a known scoop size offers servings', async () => {
  await createFood(mockDb, {
    name: 'Whey tub',
    brand: null,
    barcode: '5056000000017',
    basis: 'per_100g',
    servingSize: 25,
    servingUnit: 'g',
    nutrients: { kcal: 400, proteinG: 80, carbsG: 8, fatG: 6, fibreG: null },
    dataSource: 'open_food_facts',
    notes: null,
  });
  await typeBarcode('5056000000017');
  await screen.findByRole('header', { name: 'Whey tub' });
  expect(screen.getByText('1 serving = 25 g')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '2' }));
  await fireEvent.press(screen.getByRole('button', { name: /^Log 50 g · / }));
  expect(await screen.findByLabelText('Calories 200 of 2,500. Protein 40 of 145 grams.')).toBeTruthy();
});

test('part of a scanned product can be logged, e.g. half a bar', async () => {
  await createFood(mockDb, {
    name: 'Chocolate bar',
    brand: null,
    barcode: '5000159461122',
    basis: 'per_100g',
    servingSize: 45,
    servingUnit: 'g',
    nutrients: { kcal: 520, proteinG: 7, carbsG: 58, fatG: 29, fibreG: null },
    dataSource: 'open_food_facts',
    notes: null,
  });
  await typeBarcode('5000159461122');
  await screen.findByRole('header', { name: 'Chocolate bar' });
  await fireEvent.press(screen.getByRole('button', { name: '½' }));
  await fireEvent.press(screen.getByRole('button', { name: /^Log 22\.5 g · / }));
  expect(await screen.findByLabelText('Calories 117 of 2,500. Protein 2 of 145 grams.')).toBeTruthy();
});

test('the camera reads a barcode from a photo with RepFuel’s own reader', async () => {
  mockResults.push({ status: 'found', draft: wheyDraft });
  mockPhoto.read.mockReturnValueOnce(null).mockReturnValueOnce('5056000000017');
  await renderRouter(appDir, { initialUrl: '/scan' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Take a photo of the barcode' }));
  expect(await screen.findByText(/No barcode in that photo/)).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Take a photo of the barcode' }));
  expect(await screen.findByRole('header', { name: 'Whey Protein Chocolate' })).toBeTruthy();
  expect(mockPhoto.read).toHaveBeenLastCalledWith('PHOTO');
});

test('a photo that never arrives gives up and says so, instead of spinning forever', async () => {
  mockPhoto.take.mockImplementationOnce(() => new Promise(() => undefined));
  await renderRouter(appDir, { initialUrl: '/scan' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Take a photo of the barcode' }));
  await act(async () => jest.advanceTimersByTime(16_000));
  expect(await screen.findByText(/The photo took too long/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Take a photo of the barcode' })).not.toBeDisabled();
});

test('scanning starts by itself; the photo and typing are small fallbacks, and the torch can be turned on', async () => {
  await renderRouter(appDir, { initialUrl: '/scan' });
  expect(await screen.findByText('It scans by itself')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Take a photo of the barcode' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Try Google’s scanner' })).toBeNull();
  expect(mockCamera.torch).toBe(false);
  await fireEvent.press(screen.getByRole('button', { name: 'Torch' }));
  expect(mockCamera.torch).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Type the number' }));
  expect(screen.getByLabelText('Barcode number')).toBeTruthy();
});
