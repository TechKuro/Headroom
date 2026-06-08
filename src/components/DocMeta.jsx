import React, { useEffect, useState } from 'react';
import * as docs from '../docManager';

// Compact "edited by X · 4m ago" indicator for the shared workspace.
function ago(iso) {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function DocMeta() {
  const [, tick] = useState(0);

  useEffect(() => {
    // Re-render on conflict/reload events and on a slow interval (relative time).
    const unsub = docs.subscribeConflict(() => tick(n => n + 1));
    const t = setInterval(() => tick(n => n + 1), 20000);
    return () => { unsub(); clearInterval(t); };
  }, []);

  const meta = docs.getActiveDocMeta();
  if (!meta || !meta.updatedBy) return null;

  return (
    <span className="doc-meta" title={`Last saved ${new Date(meta.updatedAt).toLocaleString('en-GB')}`}>
      edited by {meta.updatedBy} · {ago(meta.updatedAt)}
    </span>
  );
}
