import React, { useState } from 'react';
import { useStore, useDispatch } from '../store';
import { genId, getCurrentDate, addMonths, addDays, formatDateShort } from '../utils';
import { PHASE_TEMPLATES, PHASE_TYPES } from '../constants';

export default function QuickPlanModal({ projectId, onClose }) {
  const { team } = useStore();
  const dispatch = useDispatch();
  const [templateIdx, setTemplateIdx] = useState(0);
  const [personId, setPersonId] = useState(team[0]?.id ?? '');
  const [startDate, setStartDate] = useState(getCurrentDate());

  const template = PHASE_TEMPLATES[templateIdx];

  // Preview the phases that will be created (date-based)
  const preview = [];
  let cursor = startDate;
  for (const p of template.phases) {
    const endDate = addDays(addMonths(cursor, p.months), -1);
    preview.push({ type: p.type, startMonth: cursor, endMonth: endDate, months: p.months });
    cursor = addDays(endDate, 1);
  }
  const totalMonths = preview.reduce((s, p) => s + p.months, 0);

  function handleApply() {
    for (const p of preview) {
      dispatch({
        type: 'ADD_PHASE',
        payload: {
          projectId,
          phase: {
            id: genId(),
            personIds: [personId],
            type: p.type,
            startMonth: p.startMonth,
            endMonth: p.endMonth,
            intensityOverride: null,
          },
        },
      });
    }
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Quick Plan — Apply Template</h2>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Template</label>
            <div className="template-list">
              {PHASE_TEMPLATES.map((t, i) => (
                <button
                  key={i}
                  className={`template-card ${templateIdx === i ? 'active' : ''}`}
                  onClick={() => setTemplateIdx(i)}
                >
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
            <div className="template-preview-header">Preview — {totalMonths} months total</div>
            {preview.map((p, i) => {
              const phaseInfo = PHASE_TYPES[p.type];
              return (
                <div key={i} className="template-preview-row">
                  <span className="template-preview-type">{phaseInfo.label}</span>
                  <span className="template-preview-weight">{phaseInfo.weight}%</span>
                  <span className="template-preview-range">{formatDateShort(p.startMonth)} → {formatDateShort(p.endMonth)}</span>
                  <span className="template-preview-dur">{p.months}mo</span>
                </div>
              );
            })}
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
