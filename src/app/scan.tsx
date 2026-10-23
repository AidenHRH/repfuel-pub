import { CameraView, useCameraPermissions, type BarcodeType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { BarcodeIcon, TorchIcon } from '@/components/icons';
import { ListGroup } from '@/components/ListGroup';
import { ModalScreen } from '@/components/ModalScreen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useDb } from '@/database/DatabaseProvider';
import { saveProductFood } from '@/database/repositories/barcodeRepository';
import { recordUse } from '@/database/repositories/tourRepository';
import { pickIngredient } from '@/features/nutrition/ingredientPick';
import { safely } from '@/features/safely';
import { barcodeFromJpegBase64, choosePictureSize } from '@/services/barcodeFromPhoto';
import { lookupBarcode, type BarcodeOutcome } from '@/services/barcodeLookup';
import type { FoodDraft } from '@/services/food-provider/types';
import { getFoodProvider } from '@/services/foodProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';

type Problem = Extract<BarcodeOutcome, { kind: 'not_found' | 'error' | 'invalid' }>;

const FOOD_BARCODES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e'];

/** Rejects if `promise` takes longer than `ms`, so nothing on screen can spin forever. */
function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${what} took too long`)), ms))]);
}

const PROBLEM_COPY: Record<string, { title: string; message: string }> = {
  not_found: {
    title: 'Not in Open Food Facts yet',
    message: 'Add it from the label once and RepFuel will remember this barcode.',
  },
  offline: {
    title: 'No internet connection',
    message: 'The barcode is kept. Try again when you have signal, or enter it yourself.',
  },
  timeout: {
    title: 'Open Food Facts didn’t answer',
    message: 'The barcode is kept. Try again, or enter it yourself.',
  },
  server: {
    title: 'Open Food Facts is having trouble',
    message: 'The barcode is kept. Try again later, or enter it yourself.',
  },
  invalid: {
    title: 'That doesn’t look like a food barcode',
    message: 'Food barcodes are 8 to 14 digits, under the stripes.',
  },
};

/** Name, calories and protein known: ready to use without checking the label first. */
function isComplete(draft: FoodDraft): boolean {
  return !!draft.name && draft.nutrients.kcal !== null && draft.nutrients.proteinG !== null;
}

export default function ScanScreen() {
  const db = useDb();
  const router = useRouter();
  // The meal picked in Log food, passed on to wherever the barcode leads; or, with `for=ingredient`, a meal being
  // built, which gets the food back.
  const { meal, for: purpose } = useLocalSearchParams<{ meal?: string; for?: string }>();
  const forIngredient = purpose === 'ingredient';
  const forMeal = forIngredient ? { for: 'ingredient' } : meal ? { meal } : {};
  const { colors } = useTheme();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  // The camera scans live by itself; a photo read by RepFuel's own reader is the fallback.
  const camera = useRef<CameraView>(null);
  const typeBox = useRef<ComponentRef<typeof TextInput>>(null);
  const [torch, setTorch] = useState(false);
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);
  const [snapping, setSnapping] = useState(false);
  const [photoHint, setPhotoHint] = useState<string | null>(null);

  // Coming back from Android settings: pick up a permission granted there.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void getPermission();
    });
    return () => subscription.remove();
  }, [getPermission]);
  const [typed, setTyped] = useState('');
  const [looking, setLooking] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  // The camera reports the same code many times a second; only the first one counts.
  const busy = useRef(false);

  const handleCode = async (raw: string) => {
    if (busy.current) return;
    busy.current = true;
    setProblem(null);
    setLooking(raw.trim());
    const outcome = await lookupBarcode(db, getFoodProvider(), raw).catch(
      (): BarcodeOutcome => ({
        kind: 'error',
        reason: 'server',
        barcode: raw.trim(),
      }),
    );
    setLooking(null);
    // Noted for tips about features not used lately.
    if (outcome.kind !== 'error') void recordUse(db, 'scan').catch(() => undefined);

    if (forIngredient && (outcome.kind === 'saved' || (outcome.kind === 'draft' && isComplete(outcome.draft)))) {
      const food =
        outcome.kind === 'saved'
          ? outcome.food
          : await safely('save this product', () => saveProductFood(db, { barcode: outcome.barcode, draft: outcome.draft }));
      if (food) pickIngredient(food.id);
      router.back();
      return;
    }
    if (outcome.kind === 'saved') {
      router.replace({
        pathname: '/food/log',
        params: { id: outcome.food.id, ...forMeal },
      });
      return;
    }
    if (outcome.kind === 'draft') {
      // Calories and protein known: straight to how much. Otherwise check the product against the label first.
      router.replace({
        pathname: isComplete(outcome.draft) ? '/food/log' : '/food/new',
        params: {
          barcode: outcome.barcode,
          draft: JSON.stringify(outcome.draft),
          cached: outcome.fromCache ? '1' : '0',
          ...forMeal,
        },
      });
      return;
    }
    setProblem(outcome);
    busy.current = false;
  };

  // Take a photo and read the barcode in it with RepFuel's own reader (no Google Play services needed).
  const snapBarcode = async () => {
    if (!camera.current || snapping || busy.current) return;
    setSnapping(true);
    setPhotoHint(null);
    try {
      const photo = await withTimeout(
        camera.current.takePictureAsync({ quality: 0.7, base64: true, exif: false }),
        15_000,
        'The photo',
      );
      // Let the spinner show before the (brief) decoding work starts.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const code = photo?.base64 ? barcodeFromJpegBase64(photo.base64) : null;
      if (code) onScanned({ data: code });
      else setPhotoHint('No barcode in that photo. Hold the pack flat, fill the box with the stripes, and tap again.');
    } catch (e) {
      setPhotoHint(`Couldn’t read the photo: ${(e as Error)?.message || 'unknown problem'}. You can type the number below.`);
    } finally {
      setSnapping(false);
    }
  };

  const onScanned = ({ data }: { data: string }) => {
    if (busy.current) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    void handleCode(data);
  };

  // A moderate photo size keeps reading the barcode quick.
  const onCameraReady = () => {
    camera.current
      ?.getAvailablePictureSizesAsync()
      .then((sizes) => setPictureSize(choosePictureSize(sizes)))
      .catch(() => undefined);
  };

  const problemCopy = problem ? PROBLEM_COPY[problem.kind === 'error' ? problem.reason : problem.kind] : null;
  const problemBarcode = problem && problem.kind !== 'invalid' ? problem.barcode : null;

  return (
    <ModalScreen title="Scan barcode" closeLabel="Close" onClose={() => router.back()}>
      {permission?.granted ? (
        <View
          style={{
            height: 360,
            borderRadius: radii.hero,
            overflow: 'hidden',
            backgroundColor: '#000000',
          }}>
          <CameraView
            ref={camera}
            style={{ flex: 1 }}
            facing="back"
            enableTorch={torch}
            pictureSize={pictureSize}
            onCameraReady={onCameraReady}
            barcodeScannerSettings={{ barcodeTypes: FOOD_BARCODES }}
            onBarcodeScanned={looking || problem ? undefined : onScanned}
          />
          <Viewfinder />
          <View
            pointerEvents="none"
            style={{ position: 'absolute', bottom: spacing.xl, left: 0, right: 0, alignItems: 'center', gap: 2 }}>
            <Text variant="headline" style={{ color: '#FFFFFF' }}>
              Point at the barcode
            </Text>
            <Text variant="callout" style={{ color: '#E5E5EA' }}>
              It scans by itself
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Torch"
            accessibilityState={{ selected: torch }}
            onPress={() => setTorch((on) => !on)}
            style={{
              position: 'absolute',
              top: spacing.md,
              right: spacing.md,
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: torch ? '#FFFFFF' : 'rgba(0,0,0,0.55)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <TorchIcon color={torch ? '#000000' : '#FFFFFF'} size={18} />
          </Pressable>
          {snapping || looking ? (
            <View style={{ position: 'absolute', top: spacing.md, left: spacing.md }}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          ) : null}
        </View>
      ) : (
        <Card hero style={{ alignItems: 'center', gap: spacing.sm }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: colors.well,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <BarcodeIcon color={colors.pro} />
          </View>
          <Text variant="headline" style={{ textAlign: 'center' }}>
            {permission && !permission.canAskAgain ? 'Camera is turned off for RepFuel' : 'Scan with your camera'}
          </Text>
          <Text variant="callout" color="text2" style={{ textAlign: 'center' }}>
            {permission && !permission.canAskAgain
              ? 'Turn on camera access in Android settings, or type the barcode below.'
              : 'RepFuel only uses the camera to read barcodes. Nothing is recorded or uploaded.'}
          </Text>
          {permission && !permission.canAskAgain ? (
            <Button
              variant="secondary"
              label="Open settings"
              onPress={() => void Linking.openSettings()}
              style={{ marginTop: spacing.sm }}
            />
          ) : (
            <Button label="Allow camera" onPress={() => void requestPermission()} style={{ marginTop: spacing.sm }} />
          )}
        </Card>
      )}

      {photoHint ? (
        <Text variant="callout" color="text2" style={{ paddingHorizontal: spacing.xs }}>
          {photoHint}
        </Text>
      ) : null}
      {permission?.granted ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.xl }}>
          <Button
            variant="plain"
            label="Take a photo instead"
            accessibilityLabel="Take a photo of the barcode"
            disabled={snapping || !!looking}
            onPress={() => void snapBarcode()}
          />
          <Button variant="plain" label="Type the number" onPress={() => typeBox.current?.focus()} />
        </View>
      ) : null}

      {looking ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            justifyContent: 'center',
          }}>
          <ActivityIndicator color={colors.pro} />
          <Text variant="callout" color="text2" numeric>
            Looking up {looking}…
          </Text>
        </View>
      ) : null}

      {problem && problemCopy ? (
        <Card style={{ gap: spacing.sm }}>
          <Text variant="headline">{problemCopy.title}</Text>
          <Text variant="callout" color="text2">
            {problemCopy.message}
          </Text>
          {problemBarcode ? (
            <Text variant="caption" color="text2" numeric>
              Barcode {problemBarcode}
            </Text>
          ) : null}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: spacing.sm,
              marginTop: spacing.sm,
            }}>
            {problem.kind === 'error' ? <Button label="Retry" onPress={() => void handleCode(problem.barcode)} /> : null}
            {problemBarcode ? (
              <Button
                variant={problem.kind === 'error' ? 'secondary' : 'primary'}
                label="Enter it yourself"
                onPress={() =>
                  router.replace({
                    pathname: '/food/new',
                    params: { barcode: problemBarcode, ...forMeal },
                  })
                }
              />
            ) : null}
            <Button variant="plain" label="Scan again" onPress={() => setProblem(null)} />
          </View>
        </Card>
      ) : null}

      <ListGroup title="Or type it" footer="Product data comes from Open Food Facts. You check it before anything is saved.">
        <TextField
          inputRef={typeBox}
          label="Barcode"
          accessibilityLabel="Barcode number"
          value={typed}
          onChangeText={setTyped}
          keyboardType="number-pad"
          placeholder="e.g. 5056000000017"
        />
        <View style={{ padding: spacing.md }}>
          <Button
            variant="secondary"
            label="Look up"
            disabled={!typed.trim() || !!looking}
            onPress={() => void handleCode(typed)}
          />
        </View>
      </ListGroup>
    </ModalScreen>
  );
}

function Viewfinder() {
  const corner = {
    position: 'absolute' as const,
    width: 28,
    height: 28,
    borderColor: '#FFFFFF',
  };
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <View style={{ width: 240, height: 130 }}>
        <View
          style={{
            ...corner,
            top: 0,
            left: 0,
            borderTopWidth: 3,
            borderLeftWidth: 3,
            borderTopLeftRadius: 8,
          }}
        />
        <View
          style={{
            ...corner,
            top: 0,
            right: 0,
            borderTopWidth: 3,
            borderRightWidth: 3,
            borderTopRightRadius: 8,
          }}
        />
        <View
          style={{
            ...corner,
            bottom: 0,
            left: 0,
            borderBottomWidth: 3,
            borderLeftWidth: 3,
            borderBottomLeftRadius: 8,
          }}
        />
        <View
          style={{
            ...corner,
            bottom: 0,
            right: 0,
            borderBottomWidth: 3,
            borderRightWidth: 3,
            borderBottomRightRadius: 8,
          }}
        />
      </View>
    </View>
  );
}
