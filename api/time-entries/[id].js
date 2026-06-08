// PUT    /api/time-entries/:id  { hours, description, status }  → update / confirm
// DELETE /api/time-entries/:id                                   → remove a draft
import { sql, ensureTimeSchema, readBody } from '../_lib/db.js';
import { requireUser } from '../_lib/auth.js';

export default async function handler(req, res) {
  try {
    const user = await requireUser(req);
    await ensureTimeSchema();
    const id = req.query?.id || new URL(req.url, 'http://x').pathname.split('/').pop();

    const existing = await sql`SELECT status FROM time_entries WHERE id = ${id}`;
    if (existing.length === 0) return res.status(404).json({ error: 'Not found' });
    const current = existing[0].status;

    if (req.method === 'PUT') {
      // Advisory immutability now; hard server-enforced once auth/roles land.
      if (current === 'authorised' || current === 'locked') {
        return res.status(409).json({ error: 'Entry is authorised/locked — create an adjusting entry instead.' });
      }
      const { hours, description, status } = await readBody(req);
      const confirming = status === 'confirmed';
      const rows = await sql`
        UPDATE time_entries SET
          hours        = COALESCE(${hours ?? null}, hours),
          description  = COALESCE(${description ?? null}, description),
          status       = COALESCE(${status ?? null}, status),
          confirmed_at = CASE WHEN ${confirming} THEN now() ELSE confirmed_at END,
          confirmed_by = CASE WHEN ${confirming} THEN ${user.name} ELSE confirmed_by END,
          updated_at   = now()
        WHERE id = ${id}
        RETURNING *`;
      return res.status(200).json(rows[0]);
    }

    if (req.method === 'DELETE') {
      if (current !== 'draft') {
        return res.status(409).json({ error: 'Only draft entries can be deleted; confirmed time is corrected via adjusting entries.' });
      }
      await sql`DELETE FROM time_entries WHERE id = ${id}`;
      return res.status(204).end();
    }

    res.setHeader('Allow', 'PUT, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
