import React, { useState } from 'react';
import { useDispatch } from '../store';
import { PROJECT_COLORS } from '../constants';

export default function WhatIfBar({ whatIfProject, setWhatIfProject }) {
  const dispatch = useDispatch();
  const [name, setName] = useState(whatIfProject.name);
  const [deadline, setDeadline] = useState(whatIfProject.deadline);

  function updateName(val) {
    setName(val);
    setWhatIfProject(prev => ({ ...prev, name: val }));
  }

  function updateDeadline(val) {
    setDeadline(val);
    setWhatIfProject(prev => ({ ...prev, deadline: val }));
  }

  function updateColor(color) {
    setWhatIfProject(prev => ({ ...prev, color }));
  }

  function commit() {
    const { isWhatIf, ...project } = whatIfProject;
    // Generate a clean id
    const cleanProject = {
      ...project,
      id: project.id.replace('what-if-', ''),
      name: name || 'Unnamed Project',
    };
    dispatch({ type: 'ADD_PROJECT', payload: cleanProject });
    setWhatIfProject(null);
  }

  function discard() {
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
          value={name}
          onChange={e => updateName(e.target.value)}
          placeholder="Project name…"
          className="what-if-input"
        />
        <input
          type="month"
          value={deadline}
          onChange={e => updateDeadline(e.target.value)}
          className="what-if-input month-input"
          placeholder="Deadline"
        />
        <div className="color-picker-inline">
          {PROJECT_COLORS.slice(0, 6).map(c => (
            <button
              key={c}
              className={`color-swatch-sm ${whatIfProject.color === c ? 'active' : ''}`}
              style={{ background: c }}
              onClick={() => updateColor(c)}
            />
          ))}
        </div>
      </div>
      <div className="what-if-meta">
        <span className="phase-count">{whatIfProject.phases.length} phase{whatIfProject.phases.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="what-if-actions">
        <button className="btn btn-sm btn-success" onClick={commit} disabled={!name.trim()}>
          Commit Project
        </button>
        <button className="btn btn-sm btn-ghost" onClick={discard}>Discard</button>
      </div>
    </div>
  );
}
