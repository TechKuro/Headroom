import React, { useState, useEffect, useRef } from 'react';
import { useStore, useDispatch } from '../store';
import { genId, getCurrentDate, getWorkingDayRange, addDays } from '../utils';
import { PHASE_TEMPLATES, PHASE_TYPES, HALVES } from '../constants';
import { useFocusTrap } from '../a11y';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayLabel = d => { const dt = new Date(d + 'T12:00:00'); return `${DOW[dt.getDay()]} ${dt.getDate()}`; };

export default function QuickPlanModal({ projectId, onClose }) {
  const { team } = useStore();
  const dispatch = useDispatch();
  const [templateIdx, setTemplateIdx] = useState(0);
  const [personId, setPersonId] = useState(team[0]?.id ?? '');
  const [startDate, setStartDate] = useState(getCurrentDate());
  const modalRef = useRef(null);
  useFocusTrap(modalRef);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const template = PHASE_TEMPLATES[templateIdx];
  const totalDays = template.phases.reduce((s, p) => s + p.days, 0);

  // Lay each template phase across N consecutive working days from the start.
  const allDays = getWorkingDayRange(startDate, addDays(startDate, totalDays * 2 + 14));
  let idx = 0;
  const preview = template.phases.map(p => {
    const span = allDays.slice(idx, idx + p.days);
    idx += p.days;
    return { type: p.type, days: p.days, span, start: span[0], end: span[span.length - 1] };
  });

  function handleApply() {
    if (!personId) { onClose(); return; }
    for (const p of preview) {
      if (!p.span.length) continue;
      const slots = p.span.flatMap(date => HALVES.map(half => ({ personId, date, half })));
      dispatch({
        type: 'ADD_PHASE',
        payload: {
          projectId,
          phase: { id: genId(), personIds: [personId], type: p.type, startMonth: p.start, endMonth: p.end, slots },
        },
      });
    }
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="quickplan-modal-title"
        ref={modalRef} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="quickplan-modal-title">Quick Plan — Apply Template</h2>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Template</label>
            <div className="template-list">
              {PHASE_TEMPLATES.map((t, i) => (
                <button key={i} className={`template-card ${templateIdx === i ? 'active' : ''}`} onClick={() => setTemplateIdx(i)}>
                  <span className="template-name">{t.name}</span>
                  <span className="template-desc">{t.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Default assignee</label>
              <select value={personId} onChange={e => setPersonId(e.target.value)} className="form-select">
                {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Start date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="form-input" />
            </div>
          </div>

          <div className="template-preview">
            <div className="template-preview-header">Preview — {totalDays} working days, both halves filled</div>
            {preview.map((p, i) => (
              <div key={i} className="template-preview-row">
                <span className="template-preview-type">{PHASE_TYPES[p.type].label}</span>
                <span className="template-preview-range">{p.start ? `${dayLabel(p.start)} → ${dayLabel(p.end)}` : '—'}</span>
                <span className="template-preview-dur">{p.days}d</span>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <div className="modal-spacer" />
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleApply}>Apply {preview.length} Phases</button>
        </div>
      </div>
    </div>
  );
}
