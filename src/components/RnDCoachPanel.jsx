import React, { useState } from 'react';
import { RAG_STATUSES } from '../constants';

// Renders one AI section-review result (score, issues, suggested rewrite).
// `onApply` (optional) swaps the suggested wording into the field.
export default function RnDCoachPanel({ result, onApply }) {
  const [applied, setApplied] = useState(false);
  if (!result) return null;

  const rag = result.ragStatus || 'amber';
  return (
    <div className="rnd-coach">
      <div className="rnd-coach-head">
        <span className="rnd-coach-title">AI section review</span>
        <span className={`badge badge-rag-${rag}`}>{RAG_STATUSES[rag]?.label || rag}{result.score != null ? ` · ${result.score}/10` : ''}</span>
      </div>
      {result.scoreLabel && <p className="rnd-coach-label">{result.scoreLabel}</p>}
      {(result.issues || []).map((iss, i) => (
        <div key={i} className="rnd-coach-issue">
          <span className={`rnd-coach-sev ${iss.severity === 'high' ? 'high' : 'med'}`}>{(iss.severity || 'note').toUpperCase()}</span>
          <span> {iss.issue}</span>
          {iss.suggestion && <div className="rnd-coach-sugg">→ {iss.suggestion}</div>}
        </div>
      ))}
      {result.coachingNote && <p className="rnd-coach-note">{result.coachingNote}</p>}
      {result.suggestedRewrite && (
        <div className="rnd-coach-rewrite">
          <div className="rnd-coach-rewrite-label">Suggested wording — review before applying</div>
          <p className="rnd-coach-rewrite-text">{result.suggestedRewrite}</p>
          {onApply && (
            applied
              ? <span className="rnd-coach-applied">✓ Applied</span>
              : <button className="btn btn-secondary btn-sm" onClick={() => { onApply(result.suggestedRewrite); setApplied(true); setTimeout(() => setApplied(false), 3000); }}>Apply suggested wording</button>
          )}
        </div>
      )}
    </div>
  );
}
