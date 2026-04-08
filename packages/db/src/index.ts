import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema.js'

export * from './schema.js'
export { schema }

let _db: ReturnType<typeof drizzle> | null = null

export function getDb() {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) throw new Error('DATABASE_URL is not set')
    const client = postgres(connectionString, { max: 10 })
    _db = drizzle(client, { schema })
  }
  return _db
}

export type Db = ReturnType<typeof getDb>
