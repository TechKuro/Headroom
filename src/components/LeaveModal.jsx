import React, { useState } from 'react';
import { useStore, useDispatch } from '../store';
import { getCurrentMonth, addMonths, getMonthRange, getPersonCapacity } from '../utils';

export default function LeaveModal({ person, onClose }) {
  const { capacityOverrides } = useStore();
  const dispatch = useDispatch();
  const now = getCurrentMonth();
  const [startMonth, setStartMonth] = useState(now);
  const [endMonth, setEndMonth] = useState(now);
  const [capacity, setCapacity] = useState(0);

  function handleApply() {
    const months = getMonthRange(startMonth, endMonth < startMonth ? startMonth : endMonth);
    const batch = months.map(m => ({
      key: `${person.id}-${m}`,
      value: capacity,
    }));
    dispatch({ type: 'SET_CAPACITY_OVERRIDES_BATCH', payload: batch });
    onClose();
  }

  function handleClearAll() {
    // Remove all capacity overrides for this person in the visible range
    const months = getMonthRange(addMonths(now, -6), addMonths(now, 18));
    const batch = months.map(m => ({
      key: `${person.id}-${m}`,
      value: 100, // will be deleted
    }));
    dispatch({ type: 'SET_CAPACITY_OVERRIDES_BATCH', payload: batch });
    onClose();
  }

  // Show existing overrides for this person
  const existing = [];
  const visibleMonths = getMonthRange(addMonths(now, -3), addMonths(now, 12));
  for (const m of visibleMonths) {
    const cap = getPersonCapacity(person.id, m, capacityOverrides);
    if (cap < 100) existing.push({ month: m, capacity: cap });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Leave / Reduced Capacity — {person.name}</h2>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {existing.length > 0 && (
            <div className="leave-existing">
              <div className="leave-existing-header">
                <span className="leave-existing-title">Current overrides</span>
                <button className="text-btn-sm" onClick={handleClearAll}>Clear all</button>
              </div>
              <div className="leave-chips">
                {existing.map(e => (
                  <span key={e.month} className="leave-chip">
                    {e.month}: {e.capacity}%
                    <button className="leave-chip-x" onClick={() => dispatch({ type: 'REMOVE_CAPACITY_OVERRIDE', payload: `${person.id}-${e.month}` })}>×</button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>From</label>
              <input type="month" value={startMonth} onChange={e => setStartMonth(e.target.value)} className="form-input" />
            </div>
            <div className="form-group">
              <label>To</label>
              <input type="month" value={endMonth} onChange={e => setEndMonth(e.target.value)} className="form-input" />
            </div>
          </div>

          <div className="form-group">
            <label>Available capacity</label>
            <div className="capacity-presets">
              <button className={`preset-btn ${capacity === 0 ? 'active' : ''}`} onClick={() => setCapacity(0)}>0% (Off)</button>
              <button className={`preset-btn ${capacity === 25 ? 'active' : ''}`} onClick={() => setCapacity(25)}>25%</button>
              <button className={`preset-btn ${capacity === 50 ? 'active' : ''}`} onClick={() => setCapacity(50)}>50%</button>
              <button className={`preset-btn ${capacity === 75 ? 'active' : ''}`} onClick={() => setCapacity(75)}>75%</button>
            </div>
            <div className="intensity-slider">
              <input type="range" min="0" max="100" step="5" value={capacity} onChange={e => setCapacity(Number(e.target.value))} />
              <span className="intensity-value">{capacity}%</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div className="modal-spacer" />
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleApply}>Apply</button>
        </div>
      </div>
    </div>
  );
}
