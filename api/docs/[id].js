// GET    /api/docs/:id  → full document { id, name, data, updated_at, updated_by }
// PUT    /api/docs/:id  → upsert. Body { data, name?, lastKnownUpdatedAt? }.
//                          name-only body renames without touching data.
//                          Last-write-wins, but returns 409 + current doc if the
//                          server copy is newer than lastKnownUpdatedAt (stale guard).
// DELETE /api/docs/:id  → remove
import { sql, ensureSchema, readBody } from '../_lib/db.js';
import { requireUser } from '../_lib/auth.js';

export default async function handler(req, res) {
  try {
    const user = await requireUser(req);
    await ensureSchema();

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, name, data, updated_at, updated_by FROM documents WHERE id = ${id}
      `;
      if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(rows[0]);
    }

    if (req.method === 'PUT') {
      const { name, data, lastKnownUpdatedAt } = await readBody(req);
      const existing = await sql`SELECT updated_at FROM documents WHERE id = ${id}`;

      // Rename only (no data payload).
      if (typeof data === 'undefined') {
        if (typeof name !== 'string') {
          return res.status(400).json({ error: 'data or name required' });
        }
        if (existing.length === 0) return res.status(404).json({ error: 'Not found' });
        const rows = await sql`
          UPDATE documents SET name = ${name}, updated_at = now(), updated_by = ${user.email}
          WHERE id = ${id} RETURNING id, name, updated_at
        `;
        return res.status(200).json(rows[0]);
      }

      // Create if missing (client-chosen id).
      if (existing.length === 0) {
        const rows = await sql`
          INSERT INTO documents (id, name, data, updated_by)
          VALUES (${id}, ${name || 'Untitled'}, ${JSON.stringify(data)}::jsonb, ${user.email})
          RETURNING id, name, updated_at
        `;
        return res.status(200).json(rows[0]);
      }

      // Stale-write guard for the shared workspace.
      if (lastKnownUpdatedAt && new Date(existing[0].updated_at) > new Date(lastKnownUpdatedAt)) {
        const current = await sql`
          SELECT id, name, data, updated_at, updated_by FROM documents WHERE id = ${id}
        `;
        return res.status(409).json({ error: 'stale', current: current[0] });
      }

      const rows = await sql`
        UPDATE documents
        SET data = ${JSON.stringify(data)}::jsonb,
            name = COALESCE(${name ?? null}, name),
            updated_at = now(),
            updated_by = ${user.email}
        WHERE id = ${id}
        RETURNING id, name, updated_at
      `;
      return res.status(200).json(rows[0]);
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM documents WHERE id = ${id}`;
      return res.status(204).end();
    }

    res.setHeader('Allow', 'GET, PUT, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
