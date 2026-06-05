// GET  /api/docs        → list all documents (shared workspace)
// POST /api/docs         → create a new document { name, data } → { id, name, updated_at }
import { sql, ensureSchema, readBody } from '../_lib/db.js';
import { requireUser } from '../_lib/auth.js';

export default async function handler(req, res) {
  try {
    const user = await requireUser(req);
    await ensureSchema();

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, name, updated_at, updated_by
        FROM documents
        ORDER BY updated_at DESC
      `;
      return res.status(200).json({ documents: rows });
    }

    if (req.method === 'POST') {
      const { name, data } = await readBody(req);
      if (!name || typeof data === 'undefined') {
        return res.status(400).json({ error: 'name and data are required' });
      }
      const id = String(Date.now()) + Math.random().toString(36).slice(2, 8);
      const rows = await sql`
        INSERT INTO documents (id, name, data, updated_by)
        VALUES (${id}, ${name}, ${JSON.stringify(data)}::jsonb, ${user.email})
        RETURNING id, name, updated_at
      `;
      return res.status(201).json(rows[0]);
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
