import { EXERCISE_GUIDES } from '@/data/exerciseGuides';

/** How to do an exercise, from Free Exercise DB: numbered steps, the muscles it works, start and end photos. */
export type ExerciseGuide = { sourceId: string; steps: string[]; primaryMuscles: string[]; images: string[] };

const PHOTOS = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

/** The guide for a built-in exercise, or null (no good match, or one the owner added). */
export function guideFor(exerciseId: string): ExerciseGuide | null {
  return EXERCISE_GUIDES[exerciseId] ?? null;
}

export function photoUrl(path: string): string {
  return `${PHOTOS}${path}`;
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** The video id in a YouTube link (watch, youtu.be or shorts, any extra bits), or null for anything else. */
export function youTubeId(link: string): string | null {
  let url: URL;
  try {
    const text = link.trim();
    url = new URL(/^https?:\/\//.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m)\./, '');
  const id =
    host === 'youtu.be'
      ? url.pathname.slice(1)
      : host === 'youtube.com'
        ? url.pathname === '/watch'
          ? url.searchParams.get('v')
          : url.pathname.startsWith('/shorts/')
            ? url.pathname.slice('/shorts/'.length)
            : null
        : null;
  return id && VIDEO_ID.test(id) ? id : null;
}

/** A YouTube search for how to do an exercise. */
export function findVideoUrl(name: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`how to ${name.toLowerCase()}`).replace(/%20/g, '+')}`;
}

/** The privacy-enhanced embed for a video id. */
export function embedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}`;
}
