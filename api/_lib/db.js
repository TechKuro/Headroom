// Neon Postgres access for the serverless API.
// The whole Headroom document is stored as a single JSONB blob, mirroring the
// shape the client already serializes ({ team, projects, capacityOverrides, settings }).
import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.DATABASE_URL);

let schemaReady = false;

export async function ensureSchema() {
  if (schemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS documents (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      data        JSONB NOT NULL,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_by  TEXT
    )
  `;
  schemaReady = true;
}

// Vercel's Node runtime usually pre-parses JSON bodies, but fall back to
// reading the stream so this works regardless of runtime/content-type.
export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
