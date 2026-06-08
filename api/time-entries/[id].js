// PUT    /api/time-entries/:id  { hours, description, status }  → update / confirm
// DELETE /api/time-entries/:id                                   → remove a draft
import { sql, ensureTimeSchema, readBody, clampHours } from '../_lib/db.js';
import { requireUser } from '../_lib/auth.js';

// This endpoint only moves entries between draft/confirmed. authorised/locked
// are reached via the (future) authorisation flow, so they record an authoriser.
const ALLOWED_STATUS = ['draft', 'confirmed'];

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
      const nextStatus = status && ALLOWED_STATUS.includes(status) ? status : null;
      const hoursVal = hours == null ? null : clampHours(hours);
      const confirming = nextStatus === 'confirmed';
      const rows = await sql`
        UPDATE time_entries SET
          hours        = COALESCE(${hoursVal}, hours),
          description  = COALESCE(${description ?? null}, description),
          status       = COALESCE(${nextStatus}, status),
          confirmed_at = CASE WHEN ${confirming} THEN now() ELSE confirmed_at END,
          confirmed_by = CASE WHEN ${confirming} THEN ${user.name} ELSE confirmed_by END,
          updated_by   = ${user.name},
          updated_at   = now()
        WHERE id = ${id}
        RETURNING *`;
      await sql`INSERT INTO time_entry_audit (entry_id, action, changed_by, detail)
                VALUES (${id}, 'update', ${user.name}, ${JSON.stringify({ status: nextStatus, hours: hoursVal })}::jsonb)`;
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
    const status = err.status || 500;
    return res.status(status).json({ error: status >= 500 ? 'Server error' : err.message });
  }
}
