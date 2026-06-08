// GET  /api/time-entries?from=YYYY-MM-DD&to=YYYY-MM-DD[&personId=]
//        → list actual time entries in a date range (shared workspace)
// POST /api/time-entries  { entries: [...] }  → bulk-create (seed / confirm new)
import { sql, ensureTimeSchema, readBody } from '../_lib/db.js';
import { requireUser } from '../_lib/auth.js';

const newId = () => String(Date.now()) + Math.random().toString(36).slice(2, 8);

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
      const out = [];
      for (const e of entries) {
        if (!e.personId || !e.workDate) {
          return res.status(400).json({ error: 'each entry needs personId and workDate' });
        }
        const status = e.status === 'confirmed' ? 'confirmed' : 'draft';
        const confirming = status === 'confirmed';
        const rows = await sql`
          INSERT INTO time_entries
            (id, person_id, person_name, work_date, hours, description, tracker_project_id,
             source_slots, status, confirmed_at, confirmed_by, created_by)
          VALUES
            (${newId()}, ${e.personId}, ${e.personName || null}, ${e.workDate},
             ${Number(e.hours) || 0}, ${e.description || null}, ${e.trackerProjectId || null},
             ${JSON.stringify(e.sourceSlots || [])}::jsonb, ${status},
             ${confirming ? new Date().toISOString() : null}, ${confirming ? user.name : null},
             ${user.name})
          RETURNING *`;
        out.push(rows[0]);
      }
      return res.status(201).json({ entries: out });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
