// GET  /api/time-entries?from=YYYY-MM-DD&to=YYYY-MM-DD[&personId=]
//        → list actual time entries in a date range (shared workspace)
// POST /api/time-entries  { entries: [...] }  → bulk-create (seed / confirm new)
import { sql, ensureTimeSchema, readBody, clampHours } from '../_lib/db.js';
import { requireUser } from '../_lib/auth.js';

const newId = () => String(Date.now()) + Math.random().toString(36).slice(2, 8);
const MAX_BULK = 500;

function query(req, key) {
  if (req.query && req.query[key] != null) return req.query[key];
  try { return new URL(req.url, 'http://x').searchParams.get(key); } catch { return null; }
}

export default async function handler(req, res) {
  try {
    const user = await requireUser(req);
    await ensureTimeSchema();

    if (req.method === 'GET') {
      const from = query(req, 'from');
      const to = query(req, 'to');
      const personId = query(req, 'personId');
      if (!from || !to) return res.status(400).json({ error: 'from and to are required' });
      const rows = personId
        ? await sql`SELECT * FROM time_entries WHERE work_date BETWEEN ${from} AND ${to} AND person_id = ${personId} ORDER BY work_date, created_at`
        : await sql`SELECT * FROM time_entries WHERE work_date BETWEEN ${from} AND ${to} ORDER BY work_date, created_at`;
      return res.status(200).json({ entries: rows });
    }

    if (req.method === 'POST') {
      const { entries } = await readBody(req);
      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ error: 'entries[] is required' });
      }
      if (entries.length > MAX_BULK) {
        return res.status(400).json({ error: `too many entries (max ${MAX_BULK})` });
      }
      const out = [];
      for (const e of entries) {
        if (!e.personId || !e.workDate || !e.trackerProjectId) {
          return res.status(400).json({ error: 'each entry needs personId, workDate and trackerProjectId' });
        }
        const hours = clampHours(e.hours);
        const status = e.status === 'confirmed' ? 'confirmed' : 'draft';
        const confirming = status === 'confirmed';
        // Idempotent on the natural key. A re-confirm updates the row instead of
        // duplicating; an already authorised/locked row is left untouched.
        const rows = await sql`
          INSERT INTO time_entries
            (id, person_id, person_name, work_date, hours, description, tracker_project_id,
             source_slots, status, confirmed_at, confirmed_by, created_by, updated_by)
          VALUES
            (${newId()}, ${e.personId}, ${e.personName || null}, ${e.workDate},
             ${hours}, ${e.description || null}, ${e.trackerProjectId},
             ${JSON.stringify(e.sourceSlots || [])}::jsonb, ${status},
             ${confirming ? new Date().toISOString() : null}, ${confirming ? user.name : null},
             ${user.name}, ${user.name})
          ON CONFLICT (person_id, work_date, tracker_project_id) DO UPDATE SET
            hours        = EXCLUDED.hours,
            description  = EXCLUDED.description,
            status       = EXCLUDED.status,
            confirmed_at = CASE WHEN EXCLUDED.status = 'confirmed' THEN now() ELSE time_entries.confirmed_at END,
            confirmed_by = CASE WHEN EXCLUDED.status = 'confirmed' THEN EXCLUDED.confirmed_by ELSE time_entries.confirmed_by END,
            updated_by   = EXCLUDED.updated_by,
            updated_at   = now()
          WHERE time_entries.status IN ('draft', 'confirmed')
          RETURNING *`;
        let row = rows[0];
        if (!row) {
          // Conflict hit an authorised/locked row — return it unchanged.
          const ex = await sql`SELECT * FROM time_entries WHERE person_id = ${e.personId} AND work_date = ${e.workDate} AND tracker_project_id = ${e.trackerProjectId}`;
          row = ex[0];
        } else {
          await sql`INSERT INTO time_entry_audit (entry_id, action, changed_by, detail)
                    VALUES (${row.id}, 'upsert', ${user.name}, ${JSON.stringify({ status, hours })}::jsonb)`;
        }
        if (row) out.push(row);
      }
      return res.status(201).json({ entries: out });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: status >= 500 ? 'Server error' : err.message });
  }
}
