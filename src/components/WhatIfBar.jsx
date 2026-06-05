import React, { useMemo } from 'react';
import { useStore, useDispatch } from '../store';
import { PROJECT_COLORS } from '../constants';
import { getWhatIfImpact, formatHours, formatCurrency, formatSignedCurrency } from '../utils';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayLabel = d => { const dt = new Date(d + 'T12:00:00'); return `${DOW[dt.getDay()]} ${dt.getDate()}`; };

export default function WhatIfBar({ whatIfProject, setWhatIfProject }) {
  const dispatch = useDispatch();
  const { projects, team, settings } = useStore();
  const blendedRate = settings?.blendedRate ?? 110;

  const estimatedValue = whatIfProject.initiative?.estimatedValue ?? 0;

  const impact = useMemo(
    () => getWhatIfImpact(whatIfProject, { projects, team, blendedRate }),
    [whatIfProject, projects, team, blendedRate],
  );

  function updateField(field, value) {
    setWhatIfProject(prev => ({ ...prev, [field]: value }));
  }

  function updateValue(value) {
    setWhatIfProject(prev => ({ ...prev, initiative: { ...(prev.initiative || {}), estimatedValue: value } }));
  }

  function commit() {
    const { isWhatIf, ...project } = whatIfProject;
    const cleanProject = {
      ...project,
      id: project.id.replace('what-if-', ''),
      name: whatIfProject.name.trim() || 'Unnamed Project',
    };
    dispatch({ type: 'ADD_PROJECT', payload: cleanProject });
    setWhatIfProject(null);
  }

  function discard() {
    if (whatIfProject.phases.length > 0 && !confirm(`Discard "${whatIfProject.name}" and its ${whatIfProject.phases.length} phase(s)?`)) return;
    setWhatIfProject(null);
  }

  return (
    <div className="what-if-bar">
      <div className="what-if-indicator">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span>What-If Mode</span>
      </div>
      <div className="what-if-fields">
        <input
          value={whatIfProject.name}
          onChange={e => updateField('name', e.target.value)}
          placeholder="Project name…"
          className="what-if-input"
        />
        <input
          type="month"
          value={whatIfProject.deadline}
          onChange={e => updateField('deadline', e.target.value)}
          className="what-if-input month-input"
          placeholder="Deadline"
        />
        <input
          type="number"
          min="0"
          value={estimatedValue || ''}
          onChange={e => updateValue(e.target.value === '' ? 0 : Math.max(0, Math.round(Number(e.target.value)) || 0))}
          className="what-if-input value-input"
          placeholder="Est. value £"
          title="Estimated value — drives projected ROI"
        />
        <div className="color-picker-inline">
          {PROJECT_COLORS.slice(0, 6).map(c => (
            <button
              key={c}
              className={`color-swatch-sm ${whatIfProject.color === c ? 'active' : ''}`}
              style={{ background: c }}
              onClick={() => updateField('color', c)}
            />
          ))}
        </div>
      </div>
      <div className="what-if-meta">
        <span className="phase-count">{whatIfProject.phases.length} phase{whatIfProject.phases.length !== 1 ? 's' : ''}</span>
        {whatIfProject.phases.length > 0 && (
          <div className="what-if-impact">
            <span className="wii-stat" title="Added labour hours">+{formatHours(impact.addedHours)}</span>
            <span className="wii-stat" title="Added labour cost">+{formatCurrency(impact.addedCost)}</span>
            {estimatedValue > 0 && (
              <span className={`wii-stat ${impact.roi >= 0 ? 'pos' : 'neg'}`} title="Projected ROI (value − labour cost)">
                {formatSignedCurrency(impact.roi)} ROI
              </span>
            )}
            {impact.overloadedPeople.length > 0 && (
              <span
                className="wii-warn"
                title={impact.overloadedPeople.map(p => `${p.name}: ${p.days.map(dayLabel).join(', ')}`).join('\n')}
              >
                ⚠ Overloads {impact.overloadedPeople.map(p => p.name).join(', ')}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="what-if-actions">
        <button className="btn btn-sm btn-success" onClick={commit} disabled={!whatIfProject.name.trim()}>
          Commit Project
        </button>
        <button className="btn btn-sm btn-ghost" onClick={discard}>Discard</button>
      </div>
    </div>
  );
}
