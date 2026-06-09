// POST /api/time-entries/lock  { from, to }
// Close a period: lock all AUTHORISED entries in the date range. Locked entries
// are immutable — corrections are made via adjusting entries. Confirmed-but-not-
// authorised entries are reported back so the manager knows what was left out.
import { sql, ensureTimeSchema, readBody } from '../_lib/db.js';
import { requireManager } from '../_lib/auth.js';

export default async function handler(req, res) {
  try {
    const user = await requireManager(req);
    await ensureTimeSchema();
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const { from, to } = await readBody(req);
    if (!from || !to) return res.status(400).json({ error: 'from and to are required' });

    const locked = await sql`
      UPDATE time_entries
      SET status = 'locked', locked_at = now(), updated_by = ${user.name}, updated_at = now()
      WHERE work_date BETWEEN ${from} AND ${to} AND status = 'authorised'
      RETURNING id`;
    for (const r of locked) {
      await sql`INSERT INTO time_entry_audit (entry_id, action, changed_by) VALUES (${r.id}, 'lock', ${user.name})`;
    }
    const pending = await sql`
      SELECT count(*)::int AS n FROM time_entries
      WHERE work_date BETWEEN ${from} AND ${to} AND status = 'confirmed'`;
    return res.status(200).json({ locked: locked.length, pendingConfirmed: pending[0].n });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: status >= 500 ? 'Server error' : err.message });
  }
}
