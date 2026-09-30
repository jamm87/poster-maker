import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pgClient?: postgres.Sql };

function client() {
  if (!globalForDb.pgClient) {
    globalForDb.pgClient = postgres(env().DATABASE_URL, { max: 10, prepare: false });
  }
  return globalForDb.pgClient;
}

export const db = drizzle({ client: client(), schema });
export type Db = typeof db;
export { schema };
