import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../store';
import { getWorkingDayRange, findAvailableSlots } from '../utils';

export default function AvailabilityFinder({ viewStart, viewEnd, whatIfProject, onResult, onClose }) {
  const { team, projects, capacityOverrides } = useStore();
  const [duration, setDuration] = useState(2);

  const days = useMemo(() => getWorkingDayRange(viewStart, viewEnd), [viewStart, viewEnd]);

  const matches = useMemo(() => {
    return findAvailableSlots(team, days, projects, whatIfProject, capacityOverrides, duration);
  }, [team, days, projects, whatIfProject, capacityOverrides, duration]);

  useEffect(() => { onResult(matches); }, [matches, onResult]);

  const matchCount = Object.keys(matches).length;

  return (
    <div className="finder-bar">
      <div className="finder-indicator">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span>Find Availability</span>
      </div>
      <div className="finder-fields">
        <div className="finder-field">
          <label>Free days needed</label>
          <div className="finder-duration">
            <button className="icon-btn-sm" onClick={() => setDuration(d => Math.max(1, d - 1))}>−</button>
            <span className="finder-dur-value">{duration} day{duration !== 1 ? 's' : ''}</span>
            <button className="icon-btn-sm" onClick={() => setDuration(d => Math.min(10, d + 1))}>+</button>
          </div>
        </div>
      </div>
      <div className="finder-result">
        {matchCount > 0 ? (
          <span className="finder-match-text">
            {matchCount} of {team.length} have {duration} free day{duration !== 1 ? 's' : ''} — highlighted below
          </span>
        ) : (
          <span className="finder-no-match">No one has {duration} consecutive free working day{duration !== 1 ? 's' : ''}</span>
        )}
      </div>
      <button className="icon-btn" onClick={onClose} title="Close finder">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  );
}
