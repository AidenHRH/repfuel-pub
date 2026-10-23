import { EXERCISE_GUIDES, UNMATCHED } from '@/data/exerciseGuides';
import { exerciseId, STARTER_EXERCISES } from '@/database/seed/exercises';
import { findVideoUrl, guideFor, photoUrl, youTubeId } from '@/domain/howTo';

const ID = 'dQw4w9WgXcQ';

test('YouTube links in all their usual shapes give the video id', () => {
  for (const link of [
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=30s`,
    `https://m.youtube.com/watch?feature=share&v=${ID}`,
    `https://youtu.be/${ID}?si=abc123`,
    `https://www.youtube.com/shorts/${ID}`,
    `  youtu.be/${ID}  `,
  ]) {
    expect(youTubeId(link)).toBe(ID);
  }
});

test('anything else is not a YouTube video', () => {
  for (const link of [
    'https://vimeo.com/12345',
    'bench press',
    `https://youtu.be/${ID.slice(1)}`,
    'https://www.youtube.com/@SomeGym',
    '',
  ]) {
    expect(youTubeId(link)).toBeNull();
  }
});

test('Find a video searches YouTube for how to do it', () => {
  expect(findVideoUrl('Barbell bench press')).toBe('https://www.youtube.com/results?search_query=how+to+barbell+bench+press');
});

test('bench press has its photos and steps', () => {
  const guide = guideFor('ex_barbell_bench_press')!;
  expect(guide.images).toHaveLength(2);
  expect(guide.steps.length).toBeGreaterThan(2);
  expect(photoUrl(guide.images[0])).toBe(
    'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg',
  );
  expect(guideFor('ex_burpee')).toBeNull();
  expect(guideFor('custom_123')).toBeNull();
});

test('every built-in exercise has a guide or is knowingly without one', () => {
  for (const [name] of STARTER_EXERCISES) {
    const id = exerciseId(name);
    expect([id in EXERCISE_GUIDES, UNMATCHED.includes(id)]).toEqual(expect.arrayContaining([true, false]));
  }
  expect(Object.keys(EXERCISE_GUIDES).length + UNMATCHED.length).toBe(STARTER_EXERCISES.length);
});
