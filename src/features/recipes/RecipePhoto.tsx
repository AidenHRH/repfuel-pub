import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useDb } from '@/database/DatabaseProvider';
import { getRecipePhoto, removeRecipePhoto, setRecipePhoto } from '@/database/repositories/recipePhotoRepository';
import { safely } from '@/features/safely';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';

/**
 * A recipe's picture: the owner's own photo for `photoRef` if there is one, else `fallback` (TheMealDB's), else a
 * placeholder; with Add a photo / Change photo (camera or gallery) and Remove photo.
 */
export function RecipePhoto({ photoRef, name, fallback = null }: { photoRef: string; name: string; fallback?: string | null }) {
  const db = useDb();
  const { colors } = useTheme();
  const [photo, setPhoto] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRecipePhoto(db, photoRef).then(
      (uri) => !cancelled && setPhoto(uri),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [db, photoRef]);

  const pick = async (from: 'camera' | 'gallery') => {
    setChoosing(false);
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.7 };
    if (from === 'camera' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) return;
    const result = await (from === 'camera'
      ? ImagePicker.launchCameraAsync(options)
      : ImagePicker.launchImageLibraryAsync(options));
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;
    const uri = await safely('save that photo', () => setRecipePhoto(db, photoRef, asset.uri));
    if (uri) setPhoto(uri);
  };

  const shown = photo ?? fallback;
  return (
    <>
      {shown ? (
        <Image
          source={{ uri: shown }}
          accessibilityLabel={photo ? `${name}, your photo` : `${name}, photo from TheMealDB`}
          contentFit="cover"
          style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radii.hero }}
        />
      ) : (
        <View
          style={{
            width: '100%',
            aspectRatio: 16 / 9,
            borderRadius: radii.hero,
            backgroundColor: colors.card,
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.xs,
          }}>
          <Text variant="callout" color="text2">
            No photo yet
          </Text>
          <Text variant="caption" color="text2">
            Take one when you make it
          </Text>
        </View>
      )}
      <Button variant="secondary" label={photo ? 'Change photo' : 'Add a photo'} onPress={() => setChoosing(true)} />

      <Sheet visible={choosing} title={photo ? 'Change photo' : 'Add a photo'} onClose={() => setChoosing(false)}>
        <Button label="Take a photo" onPress={() => void pick('camera')} />
        <Button variant="secondary" label="Choose from gallery" onPress={() => void pick('gallery')} />
        {photo ? (
          <Button
            variant="plain"
            label="Remove photo"
            onPress={async () => {
              setChoosing(false);
              await safely('remove that photo', () => removeRecipePhoto(db, photoRef));
              setPhoto(null);
            }}
          />
        ) : null}
      </Sheet>
    </>
  );
}
