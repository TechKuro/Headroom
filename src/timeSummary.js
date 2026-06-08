import { useState, useEffect } from 'react';
import { api } from './api';

// Shared, cached view of delivered hours per project (confirmed/authorised/
// locked time). Several views need it to show derived progress, so we fetch
// once and share the result rather than each view hitting the API. Mirrors the
// tiny pub/sub shape used by toast.js / confirm.js.

let cache = null;       // { [projectId]: hours } once loaded, else null
let inflight = null;    // de-dupes concurrent first loads
const subs = new Set();

// Refetch and notify subscribers. Call after time is confirmed so progress
// updates without a reload. Swallows errors (returns the last good cache).
export async function refreshProjectHours() {
  if (inflight) return inflight;
  inflight = api.timeSummary()
    .then(res => {
      const map = {};
      for (const r of res.summary || []) map[r.tracker_project_id] = Number(r.hours) || 0;
      cache = map;
      subs.forEach(fn => fn(cache));
      return map;
    })
    .catch(() => cache || {})
    .finally(() => { inflight = null; });
  return inflight;
}

// Hook: returns { hoursByProject, loading }. Loads on first use.
export function useProjectHours() {
  const [hoursByProject, setHours] = useState(cache);
  const [loading, setLoading] = useState(cache == null);

  useEffect(() => {
    const fn = map => { setHours(map); setLoading(false); };
    subs.add(fn);
    if (cache == null) refreshProjectHours().then(() => setLoading(false));
    else setLoading(false);
    return () => { subs.delete(fn); };
  }, []);

  return { hoursByProject: hoursByProject || {}, loading };
}
