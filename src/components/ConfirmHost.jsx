import React, { useState, useEffect, useRef } from 'react';
import { onConfirm } from '../confirm';
import { useFocusTrap } from '../a11y';

// Renders the in-app confirm dialog (one at a time) and resolves its promise.
export default function ConfirmHost() {
  const [req, setReq] = useState(null);
  const modalRef = useRef(null);
  useFocusTrap(modalRef, req);

  useEffect(() => onConfirm(setReq), []);

  useEffect(() => {
    if (!req) return;
    const onKey = e => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req]);

  if (!req) return null;
  const close = result => { req.resolve(result); setReq(null); };

  return (
    <div className="modal-backdrop" onClick={() => close(false)}>
      <div className="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title"
        ref={modalRef} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2 id="confirm-title">{req.title}</h2></div>
        <div className="modal-body"><p className="confirm-message">{req.message}</p></div>
        <div className="modal-footer">
          <div className="modal-spacer" />
          <button className="btn btn-secondary" onClick={() => close(false)}>{req.cancelLabel}</button>
          <button className={`btn ${req.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)} autoFocus>{req.confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
