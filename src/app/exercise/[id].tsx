import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/Button';
import { ListGroup } from '@/components/ListGroup';
import { ModalScreen } from '@/components/ModalScreen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useDb } from '@/database/DatabaseProvider';
import { getExercise, setExerciseVideo } from '@/database/repositories/exerciseRepository';
import type { Exercise } from '@/domain/exercises';
import { findVideoUrl, guideFor, photoUrl, youTubeId } from '@/domain/howTo';
import { YouTubePlayer } from '@/features/workouts/YouTubePlayer';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';

const POSITIONS = ['start', 'end'];

/**
 * How to do an exercise: start and end photos and numbered steps from Free Exercise DB (built-in exercises), and the
 * owner's own YouTube video, which plays here once its link is added.
 */
export default function HowToScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const router = useRouter();
  const { colors } = useTheme();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [adding, setAdding] = useState(false);
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enlarged, setEnlarged] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getExercise(db, id).then(
      (e) => !cancelled && setExercise(e),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [db, id]);

  if (!exercise)
    return (
      <ModalScreen title="" onClose={() => router.back()}>
        {null}
      </ModalScreen>
    );

  const guide = guideFor(exercise.id);
  const videoId = exercise.videoUrl ? youTubeId(exercise.videoUrl) : null;
  const saveVideo = async (url: string | null) => {
    try {
      await setExerciseVideo(db, exercise.id, url);
      setExercise({ ...exercise, videoUrl: url?.trim() || null });
      setAdding(false);
      setLink('');
      setError(null);
    } catch (e) {
      setError(e instanceof RangeError ? e.message : 'Couldn’t save that. Try again.');
    }
  };

  return (
    <ModalScreen title={exercise.name} onClose={() => router.back()}>
      {guide ? (
        <>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {guide.images.slice(0, 2).map((path, i) => (
              <Pressable
                key={path}
                accessibilityRole="button"
                accessibilityHint="Shows the photo larger"
                onPress={() => setEnlarged(path)}
                style={{ flex: 1 }}>
                <Image
                  source={{ uri: photoUrl(path) }}
                  accessibilityLabel={`${exercise.name}, ${POSITIONS[i]}`}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={150}
                  style={{ aspectRatio: 1, borderRadius: radii.card, backgroundColor: colors.well }}
                />
              </Pressable>
            ))}
          </View>
          <Text variant="caption" color="text2" style={{ paddingHorizontal: spacing.xs }}>
            Steps and photos: Free Exercise DB
          </Text>
          <ListGroup title="Steps" footer={`Works: ${guide.primaryMuscles.join(', ')}`}>
            <View style={{ padding: spacing.lg, gap: spacing.md }}>
              {guide.steps.map((step, i) => (
                <Text key={i}>{`${i + 1}. ${step}`}</Text>
              ))}
            </View>
          </ListGroup>
        </>
      ) : (
        <Text variant="callout" color="text2" style={{ paddingHorizontal: spacing.xs }}>
          No guide for this one yet
        </Text>
      )}

      <ListGroup title="Video">
        <View style={{ padding: spacing.md, gap: spacing.sm }}>
          {videoId ? (
            <>
              <YouTubePlayer videoId={videoId} />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button variant="secondary" label="Change video" onPress={() => setAdding(true)} style={{ flex: 1 }} />
                <Button variant="secondary" label="Remove video" onPress={() => void saveVideo(null)} style={{ flex: 1 }} />
              </View>
            </>
          ) : (
            <>
              <Text variant="callout" color="text2">
                Find a video you like (from a gym, coach or any channel you trust), copy its link and add it here. It plays in
                RepFuel from then on.
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  variant="secondary"
                  label="Find a video"
                  onPress={() => void WebBrowser.openBrowserAsync(findVideoUrl(exercise.name)).catch(() => undefined)}
                  style={{ flex: 1 }}
                />
                <Button variant="secondary" label="Add a video" onPress={() => setAdding(true)} style={{ flex: 1 }} />
              </View>
            </>
          )}
          {adding ? (
            <View style={{ gap: spacing.sm }}>
              <View style={{ backgroundColor: colors.well, borderRadius: radii.card }}>
                <TextField
                  label="YouTube link"
                  value={link}
                  onChangeText={(text) => {
                    setLink(text);
                    setError(null);
                  }}
                  placeholder="https://youtu.be/…"
                  autoFocus
                />
              </View>
              {error ? (
                <Text variant="callout" color="danger">
                  {error}
                </Text>
              ) : null}
              <Button label="Save video" onPress={() => void saveVideo(link)} disabled={!link.trim()} />
            </View>
          ) : null}
        </View>
      </ListGroup>

      <Sheet visible={!!enlarged} title={exercise.name} onClose={() => setEnlarged(null)} closeLabel="Done">
        {enlarged ? (
          <Image
            source={{ uri: photoUrl(enlarged) }}
            contentFit="contain"
            cachePolicy="memory-disk"
            style={{ width: '100%', aspectRatio: 1, borderRadius: radii.card }}
          />
        ) : null}
      </Sheet>
    </ModalScreen>
  );
}
