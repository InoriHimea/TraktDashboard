import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import * as schema from "./schema.js";

export * from "./schema.js";
export { schema };

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
    if (!_db) {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) throw new Error("DATABASE_URL is not set");
        const client = postgres(connectionString, { max: 10 });
        _db = drizzle(client, { schema });
    }
    return _db;
}

export type Db = ReturnType<typeof getDb>;

export async function runMigrations() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    const client = postgres(connectionString, { max: 1 });
    const db = drizzle(client, { schema });
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const migrationsFolder = resolve(__dirname, "../drizzle");
    await migrate(db, { migrationsFolder });
    await client.end();
}
