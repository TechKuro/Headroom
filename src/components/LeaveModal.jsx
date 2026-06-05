import React, { useState } from 'react';
import { useStore, useDispatch } from '../store';
import { getCurrentDate, addDays, getWorkingDayRange, isSlotAvailable } from '../utils';
import { HALVES } from '../constants';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayLabel = d => { const dt = new Date(d + 'T12:00:00'); return `${DOW[dt.getDay()]} ${dt.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dt.getMonth()]}`; };

export default function LeaveModal({ person, onClose }) {
  const { capacityOverrides } = useStore();
  const dispatch = useDispatch();
  const today = getCurrentDate();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [half, setHalf] = useState('both'); // 'am' | 'pm' | 'both'

  function setLeave(off) {
    const halves = half === 'both' ? HALVES : [half];
    const days = getWorkingDayRange(startDate, endDate < startDate ? startDate : endDate);
    const entries = [];
    for (const date of days) for (const h of halves) entries.push({ personId: person.id, date, half: h, off });
    dispatch({ type: 'SET_SLOT_LEAVE_BATCH', payload: entries });
    onClose();
  }

  // Existing leave for this person across the next few weeks.
  const existing = [];
  for (const date of getWorkingDayRange(today, addDays(today, 27))) {
    for (const h of HALVES) {
      if (!isSlotAvailable(person.id, date, h, capacityOverrides)) existing.push({ date, half: h });
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Leave — {person.name}</h2>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {existing.length > 0 && (
            <div className="leave-existing">
              <div className="leave-existing-header">
                <span className="leave-existing-title">On leave ({existing.length} half-days)</span>
              </div>
              <div className="leave-chips">
                {existing.map(e => (
                  <span key={`${e.date}-${e.half}`} className="leave-chip">
                    {dayLabel(e.date)} {e.half.toUpperCase()}
                    <button className="leave-chip-x" onClick={() => dispatch({ type: 'SET_SLOT_LEAVE', payload: { personId: person.id, date: e.date, half: e.half, off: false } })}>×</button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>From</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="form-input" />
            </div>
            <div className="form-group">
              <label>To</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="form-input" />
            </div>
          </div>

          <div className="form-group">
            <label>Which halves</label>
            <div className="capacity-presets">
              <button className={`preset-btn ${half === 'both' ? 'active' : ''}`} onClick={() => setHalf('both')}>Full day</button>
              <button className={`preset-btn ${half === 'am' ? 'active' : ''}`} onClick={() => setHalf('am')}>AM only</button>
              <button className={`preset-btn ${half === 'pm' ? 'active' : ''}`} onClick={() => setHalf('pm')}>PM only</button>
            </div>
            <span className="form-hint">Working days only (Mon–Fri).</span>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setLeave(false)}>Clear leave in range</button>
          <div className="modal-spacer" />
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => setLeave(true)}>Mark as leave</button>
        </div>
      </div>
    </div>
  );
}
