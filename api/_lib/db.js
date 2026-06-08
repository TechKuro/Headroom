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

let timeSchemaReady = false;

// The R&D actuals layer — confirmed time, separate from the planning blob.
// Later-phase columns (rnd_project_id, classification, authorised_*, etc.) are
// present now as nullable so the shape is stable; they're populated in P2–P3.
export async function ensureTimeSchema() {
  if (timeSchemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS time_entries (
      id                 TEXT PRIMARY KEY,
      person_id          TEXT NOT NULL,
      person_name        TEXT,
      work_date          DATE NOT NULL,
      hours              NUMERIC(5,2) NOT NULL DEFAULT 0,
      description        TEXT,
      tracker_project_id TEXT,
      rnd_project_id     TEXT,
      work_package_id    TEXT,
      classification     TEXT,
      funding_source     TEXT,
      source_slots       JSONB,
      status             TEXT NOT NULL DEFAULT 'draft',
      confirmed_at       TIMESTAMPTZ,
      confirmed_by       TEXT,
      authorised_at      TIMESTAMPTZ,
      authorised_by      TEXT,
      locked_at          TIMESTAMPTZ,
      adjusts_entry_id   TEXT,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by         TEXT,
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS time_entries_person_date ON time_entries (person_id, work_date)`;
  timeSchemaReady = true;
}

// Vercel's Node runtime usually pre-parses JSON bodies, but fall back to
// reading the stream so this works regardless of runtime/content-type.
export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
