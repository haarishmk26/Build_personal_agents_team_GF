import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = neon(process.env.DATABASE_URL);
const migrationDir = join(process.cwd(), "packages", "database", "migrations");
await sql`create table if not exists schema_migration (name text primary key, applied_at timestamptz not null default now())`;
for (const name of (await readdir(migrationDir)).filter((file) => file.endsWith(".sql")).sort()) {
  const applied = await sql`select name from schema_migration where name=${name}`;
  if (applied.length) continue;
  const statements = (await readFile(join(migrationDir, name), "utf8")).split(";").map((statement) => statement.trim()).filter(Boolean);
  for (const statement of statements) await sql.query(statement);
  await sql`insert into schema_migration (name) values (${name})`;
  console.log(`Applied ${name}`);
}
console.log("Database schema is current.");