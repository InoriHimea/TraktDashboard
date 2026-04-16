import './load-env.js';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const connectionString = process.env.DATABASE_URL;
if (!connectionString)
    throw new Error('DATABASE_URL is not set');
const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);
console.log('Running migrations...');
await migrate(db, {
    migrationsFolder: path.join(__dirname, '../../../packages/db/drizzle'),
});
console.log('Migrations complete');
await client.end();
//# sourceMappingURL=migrate.js.map