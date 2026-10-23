import type { Migration } from './index';

// The owner's chosen how-to video for an exercise (a YouTube link). NULL until one is added.
export const exerciseVideo: Migration = {
  version: 16,
  name: 'exercise_video',
  async up(db) {
    await db.exec('ALTER TABLE exercise ADD COLUMN video_url TEXT');
  },
};
