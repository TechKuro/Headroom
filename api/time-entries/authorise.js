// POST /api/time-entries/authorise  { ids: [...] }
// Manager action: move confirmed entries → authorised (counts toward claims).
import { sql, ensureTimeSchema, readBody } from '../_lib/db.js';
import { requireUser } from '../_lib/auth.js';

export default async function handler(req, res) {
  try {
    const user = await requireUser(req);
    await ensureTimeSchema();
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const { ids } = await readBody(req);
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids[] is required' });
    if (ids.length > 1000) return res.status(400).json({ error: 'too many ids (max 1000)' });

    const rows = await sql`
      UPDATE time_entries
      SET status = 'authorised', authorised_at = now(), authorised_by = ${user.name},
          updated_by = ${user.name}, updated_at = now()
      WHERE id = ANY(${ids}::text[]) AND status = 'confirmed'
      RETURNING *`;
    for (const r of rows) {
      await sql`INSERT INTO time_entry_audit (entry_id, action, changed_by) VALUES (${r.id}, 'authorise', ${user.name})`;
    }
    return res.status(200).json({ entries: rows, authorised: rows.length });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: status >= 500 ? 'Server error' : err.message });
  }
}
