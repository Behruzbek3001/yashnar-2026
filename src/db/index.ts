import fs from 'node:fs';
import path from 'node:path';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import * as schema from './schema.ts';

type AppDatabase = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

declare global {
  var _postgresPool: Pool | undefined;
  var _pgliteClient: PGlite | undefined;
  var _yashnarSchemaReady: Promise<void> | undefined;
}

const useExternalPostgres = Boolean(process.env.SQL_HOST);

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15000,
    });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

export const createPglite = () => {
  if (!global._pgliteClient) {
    const preferredDir =
      process.env.YASHNAR_PGDATA_DIR || path.resolve(process.cwd(), 'private_storage', 'pgdata');
    let dataDir = preferredDir;
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.accessSync(dataDir, fs.constants.W_OK);
    } catch {
      dataDir = '/tmp/yashnar-pgdata';
      fs.mkdirSync(dataDir, { recursive: true });
    }
    global._pgliteClient = new PGlite(dataDir);
  }
  return global._pgliteClient;
};

const pool = useExternalPostgres ? createPool() : null;
const pgliteClient = useExternalPostgres ? null : createPglite();

export const db: NodePgDatabase<typeof schema> = (
  useExternalPostgres
    ? drizzlePg(pool!, { schema })
    : drizzlePglite(pgliteClient!, { schema })
) as unknown as NodePgDatabase<typeof schema>;

type SqlRunner = {
  query: (sql: string) => Promise<{ rows: Array<{ count: string }> }>;
  exec: (sql: string) => Promise<unknown>;
};

async function applyDrizzleSchemaToPglite(client: PGlite): Promise<void> {
  await client.waitReady;
  return applyDdl({
    query: (sql) => client.query<{ count: string }>(sql),
    exec: (sql) => client.exec(sql),
  });
}

async function applyDrizzleSchemaToPostgres(p: Pool): Promise<void> {
  return applyDdl({
    query: (sql) => p.query<{ count: string }>(sql),
    exec: (sql) => p.query(sql),
  });
}

async function applyDdl(client: SqlRunner): Promise<void> {
  const existing = await client.query(
    `SELECT count(*)::text AS count
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  );
  const tableCount = Number(existing.rows[0]?.count ?? 0);
  if (tableCount >= 32) {
    return;
  }

  const ddlPath = path.resolve(process.cwd(), 'src', 'db', 'schema-ddl.sql');
  const rawSql = fs.readFileSync(ddlPath, 'utf8');
  const statements = rawSql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    try {
      await client.exec(`${stmt};`);
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      // Ignore already-exists errors for idempotent partial recovery
      if (code === '42P07' || code === '42710') {
        continue;
      }
      throw err;
    }
  }
}

export async function ensureSchemaReady(): Promise<void> {
  if (!global._yashnarSchemaReady) {
    const apply = useExternalPostgres
      ? applyDrizzleSchemaToPostgres(pool!)
      : applyDrizzleSchemaToPglite(pgliteClient!);
    global._yashnarSchemaReady = apply.catch((err) => {
      global._yashnarSchemaReady = undefined;
      throw err;
    });
  }
  return global._yashnarSchemaReady;
}

export { pool, pgliteClient };
export type { AppDatabase };
