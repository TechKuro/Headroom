import React, { useEffect, useState } from 'react';
import { useStore, useDispatch } from '../store';
import * as docs from '../docManager';
import { addToast } from '../toast';

// Shown when another user has saved over the plan we're editing (shared, last-
// write-wins workspace). Lets the user reload the other person's version or
// overwrite it with their own — autosave is paused until they choose.
export default function ConflictBanner() {
  const state = useStore();
  const dispatch = useDispatch();
  const [conflict, setConflict] = useState(() => docs.getConflict());
  const [busy, setBusy] = useState(false);

  useEffect(() => docs.subscribeConflict(setConflict), []);

  if (!conflict) return null;

  const who = conflict.updatedBy || 'Someone';

  async function reload() {
    setBusy(true);
    try {
      const data = await docs.reloadActive();
      dispatch({ type: 'LOAD_DOCUMENT', payload: data });
      addToast('Reloaded the latest version.', 'success');
    } catch {
      addToast('Couldn’t reload — check your connection and try again.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function keepMine() {
    setBusy(true);
    try {
      await docs.overwriteActive(state);
      addToast('Your version was saved.', 'success');
    } catch {
      addToast('Couldn’t save your version — check your connection and try again.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="conflict-banner" role="alert">
      <svg className="conflict-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span className="conflict-msg">
        {conflict.kind === 'save'
          ? <><strong>{who}</strong> edited this plan since you opened it — your latest changes weren’t saved.</>
          : <><strong>{who}</strong> just updated this plan.</>}
      </span>
      <div className="conflict-actions">
        <button className="btn btn-primary btn-sm" onClick={reload} disabled={busy}>Reload theirs</button>
        <button className="btn btn-secondary btn-sm" onClick={keepMine} disabled={busy}>
          {conflict.kind === 'save' ? 'Overwrite with mine' : 'Keep mine'}
        </button>
      </div>
    </div>
  );
}
