// Audit trail for R&D AI calls. Records who called what, the model, the
// resulting score/RAG and token usage — never the prompt or the API key.
import { sql } from './db.js';

let ensured = false;
export async function ensureRdAuditSchema() {
  if (ensured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS rd_ai_audit (
      id            BIGSERIAL PRIMARY KEY,
      rnd_project_id TEXT,
      kind          TEXT NOT NULL,        -- 'coach' | 'assess'
      section       TEXT,
      model         TEXT,
      score         NUMERIC,
      rag_status    TEXT,
      input_tokens  INTEGER,
      output_tokens INTEGER,
      called_by     TEXT,
      called_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      detail        JSONB
    )`;
  ensured = true;
}

// Best-effort: auditing must never block or fail the user's request.
export async function recordRdAiCall({ rndProjectId, kind, section, model, score, ragStatus, usage, calledBy, detail }) {
  try {
    await sql`
      INSERT INTO rd_ai_audit
        (rnd_project_id, kind, section, model, score, rag_status, input_tokens, output_tokens, called_by, detail)
      VALUES
        (${rndProjectId || null}, ${kind}, ${section || null}, ${model || null},
         ${score ?? null}, ${ragStatus || null},
         ${usage?.prompt_tokens ?? usage?.input_tokens ?? null},
         ${usage?.completion_tokens ?? usage?.output_tokens ?? null},
         ${calledBy || null}, ${JSON.stringify(detail || {})}::jsonb)`;
  } catch { /* swallow — audit is not on the critical path */ }
}
