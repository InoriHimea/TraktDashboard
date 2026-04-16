import postgres from 'postgres';
import * as schema from './schema.js';
export * from './schema.js';
export { schema };
export declare function getDb(): import("drizzle-orm/postgres-js").PostgresJsDatabase<Record<string, unknown>> & {
    $client: postgres.Sql<{}>;
};
export type Db = ReturnType<typeof getDb>;
//# sourceMappingURL=index.d.ts.map