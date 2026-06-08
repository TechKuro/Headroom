// GET /api/time-entries/summary
//   → delivered (non-draft) hours per project, summed across everyone.
// Powers the Overview's derived progress: confirmed engineer time ÷ planned
// work. "Delivered" = confirmed, authorised or locked (drafts excluded).
import { sql, ensureTimeSchema } from '../_lib/db.js';
import { requireUser } from '../_lib/auth.js';

export default async function handler(req, res) {
  try {
    await requireUser(req);
    await ensureTimeSchema();
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const rows = await sql`
      SELECT tracker_project_id, COALESCE(SUM(hours), 0)::float AS hours
      FROM time_entries
      WHERE status IN ('confirmed', 'authorised', 'locked')
      GROUP BY tracker_project_id`;
    return res.status(200).json({ summary: rows });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: status >= 500 ? 'Server error' : err.message });
  }
}
