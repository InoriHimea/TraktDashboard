// Debug script to check stillPath in database
import { getDb } from '@trakt-dashboard/db';
import { episodes, shows } from '@trakt-dashboard/db/schema';
import { eq } from 'drizzle-orm';

const db = getDb();

// Check a few episodes
const results = await db
  .select({
    episodeId: episodes.id,
    showTitle: shows.title,
    seasonNumber: episodes.seasonNumber,
    episodeNumber: episodes.episodeNumber,
    episodeTitle: episodes.title,
    stillPath: episodes.stillPath,
  })
  .from(episodes)
  .innerJoin(shows, eq(episodes.showId, shows.id))
  .limit(10);

console.log('Sample episodes with stillPath:');
console.table(results);

// Count episodes with and without stillPath
const [withStill] = await db
  .select({ count: episodes.id })
  .from(episodes)
  .where(episodes.stillPath !== null);

const [total] = await db
  .select({ count: episodes.id })
  .from(episodes);

console.log(`\nEpisodes with stillPath: ${withStill?.count || 0}`);
console.log(`Total episodes: ${total?.count || 0}`);
