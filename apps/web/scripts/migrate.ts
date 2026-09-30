import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "postgres://poster:poster@localhost:5432/poster";
const client = postgres(url, { max: 1 });
await migrate(drizzle({ client }), { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
console.log("Migraciones aplicadas");
await client.end();
