import { readFile } from "node:fs/promises";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing from .env.local.");
  process.exitCode = 1;
} else {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: true }
  });
  try {
    const sql = await readFile(new URL("../supabase/migrations/001_trip_parliament.sql", import.meta.url), "utf8");
    await client.connect();
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");
    console.log("Trip Parliament Supabase migration applied.");
  } catch (error) {
    try { await client.query("rollback"); } catch { /* Connection may not be open. */ }
    const message = error instanceof Error ? error.message : String(error);
    const safe = message.replaceAll(process.env.DATABASE_URL, "[redacted]");
    console.error(`Migration failed: ${safe}`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}
