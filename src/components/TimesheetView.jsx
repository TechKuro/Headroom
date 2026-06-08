import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useStore } from '../store';
import { api } from '../api';
import { getCurrentDate, addDays, getWorkingDayRange, getPlannedByDayProject, formatHours } from '../utils';
import { MAX_HOURS_PER_DAY } from '../constants';
import { getAccountName } from '../auth/authConfig';
import { addToast } from '../toast';
import { refreshProjectHours } from '../timeSummary';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayLabel = d => { const dt = new Date(d + 'T12:00:00'); return `${DOW[dt.getDay()]} ${dt.getDate()} ${MONTHS[dt.getMonth()]}`; };
const mondayOf = date => { let d = date; while (new Date(d + 'T12:00:00').getDay() !== 1) d = addDays(d, -1); return d; };

const STATUS_LABEL = { unsaved: 'Not saved', draft: 'Draft', confirmed: 'Confirmed', authorised: 'Authorised', locked: 'Locked' };

// R&D Timesheet — the engineer confirms ACTUAL time against the plan. Phase 1:
// pre-fill from the planned half-day slots, edit hours + activity, and confirm.
// Integrity (authorise/lock/audit) is advisory until server enforcement lands.
export default function TimesheetView() {
  const { team, projects } = useStore();
  const me = getAccountName();

  const [personId, setPersonId] = useState(() => {
    const match = team.find(m => me && m.name && m.name.toLowerCase() === me.toLowerCase());
    return match?.id ?? team[0]?.id ?? null;
  });
  const [weekStart, setWeekStart] = useState(() => mondayOf(getCurrentDate()));
  const [entries, setEntries] = useState([]);
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const days = useMemo(() => getWorkingDayRange(weekStart, addDays(weekStart, 4)), [weekStart]);
  const person = team.find(m => m.id === personId);
  const today = getCurrentDate(); // can't confirm time for a day that hasn't happened yet

  const load = useCallback(async () => {
    if (!personId || days.length === 0) return;
    setLoading(true); setError(null);
    try {
      const res = await api.listTimeEntries({ from: days[0], to: days[days.length - 1], personId });
      setEntries(res.entries || []);
      setEdits({});
    } catch (e) {
      setError(e?.message || 'Could not load time entries.');
    } finally {
      setLoading(false);
    }
  }, [personId, days]);

  useEffect(() => { load(); }, [load]);

  const planned = useMemo(() => getPlannedByDayProject(personId, days, projects), [personId, days, projects]);

  // Union of planned (pre-fill) and persisted entries, keyed date|project, with local edits applied.
  const rows = useMemo(() => {
    const byKey = new Map();
    for (const p of planned) {
      const key = `${p.date}|${p.trackerProjectId}`;
      byKey.set(key, {
        key, date: p.date, projectId: p.trackerProjectId, projectName: p.projectName, projectColor: p.projectColor,
        plannedHours: p.hours, hours: p.hours, description: '', status: 'unsaved', id: null,
      });
    }
    for (const e of entries) {
      const date = String(e.work_date).slice(0, 10);
      const key = `${date}|${e.tracker_project_id}`;
      const proj = projects.find(pr => pr.id === e.tracker_project_id);
      const planRow = byKey.get(key);
      byKey.set(key, {
        key, date, projectId: e.tracker_project_id,
        projectName: proj?.name || '(removed project)', projectColor: proj?.color || '#6b7390',
        plannedHours: planRow?.plannedHours ?? null,
        hours: Number(e.hours), description: e.description || '', status: e.status, id: e.id,
      });
    }
    return [...byKey.values()]
      .map(r => ({ ...r, ...(edits[r.key] || {}) }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.projectName.localeCompare(b.projectName)));
  }, [planned, entries, edits, projects]);

  const rowsByDay = useMemo(() => {
    const m = new Map();
    for (const d of days) m.set(d, []);
    for (const r of rows) { if (!m.has(r.date)) m.set(r.date, []); m.get(r.date).push(r); }
    return m;
  }, [rows, days]);

  function setEdit(key, patch) { setEdits(e => ({ ...e, [key]: { ...(e[key] || {}), ...patch } })); }

  const editable = r => r.status !== 'authorised' && r.status !== 'locked';

  // A day is confirmable when it has new hours to save or edits to existing entries.
  const dayConfirmable = dayRows => dayRows.some(r => editable(r) && (
    (!r.id && Number(r.hours) > 0 && r.projectId) || (r.id && edits[r.key])
  ));

  // Confirm (lock in) a single day's rows.
  async function confirmDay(date, dayRows) {
    if (date > today) return; // guard: never confirm a future day
    setLoading(true); setError(null);
    try {
      const toCreate = [];
      const toUpdate = [];
      for (const r of dayRows) {
        if (!editable(r)) continue;
        if (!r.id) {
          if (Number(r.hours) > 0 && r.projectId) {
            toCreate.push({
              personId, personName: person?.name, workDate: r.date, hours: Number(r.hours),
              description: r.description || '', trackerProjectId: r.projectId, status: 'confirmed', sourceSlots: [],
            });
          }
        } else if (edits[r.key]) {
          toUpdate.push({ id: r.id, hours: Number(r.hours), description: r.description, status: 'confirmed' });
        }
      }
      if (toCreate.length) await api.createTimeEntries(toCreate);
      for (const u of toUpdate) await api.updateTimeEntry(u.id, { hours: u.hours, description: u.description, status: u.status });
      const n = toCreate.length + toUpdate.length;
      addToast(`Confirmed ${dayLabel(date)} — ${n} entr${n === 1 ? 'y' : 'ies'}`, 'success');
      await load();
      refreshProjectHours(); // keep Overview/Standup progress in step

    } catch (e) {
      setError(e?.message || 'Save failed.');
      addToast('Save failed — see the message above.', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (team.length === 0) {
    return <div className="empty-state"><p>Add team members before recording time.</p></div>;
  }

  return (
    <div className="timesheet-view">
      <div className="ts-toolbar">
        <div className="ts-who">
          <label>Recording time for</label>
          <select value={personId || ''} onChange={e => setPersonId(e.target.value)} className="alloc-project-select">
            {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="timeline-nav">
          <button className="icon-btn" onClick={() => setWeekStart(w => mondayOf(addDays(w, -7)))} title="Previous week">‹</button>
          <button className="text-btn" onClick={() => setWeekStart(mondayOf(getCurrentDate()))}>This week</button>
          <button className="icon-btn" onClick={() => setWeekStart(w => mondayOf(addDays(w, 7)))} title="Next week">›</button>
        </div>
      </div>

      <div className="ts-advisory">
        Pre-filled from the plan. Adjust your <strong>actual</strong> hours, add an activity note, and
        <strong> Confirm</strong> each day to lock it in. Authorisation &amp; locking are advisory until server enforcement is enabled.
      </div>

      {error && <div className="ts-error">{error}</div>}

      <div className="ts-days">
        {days.map(date => {
          const dayRows = rowsByDay.get(date) || [];
          const total = dayRows.reduce((s, r) => s + (Number(r.hours) || 0), 0);
          const over = total > MAX_HOURS_PER_DAY;
          const isFuture = date > today;
          return (
            <div key={date} className="ts-day">
              <div className="ts-day-head">
                <span className="ts-day-label">{dayLabel(date)}</span>
                <div className="ts-day-right">
                  <span className={`ts-day-total ${over ? 'over' : ''}`}>
                    {formatHours(total)}{over ? ` · over ${MAX_HOURS_PER_DAY}h cap` : ''}
                  </span>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => confirmDay(date, dayRows)}
                    disabled={loading || isFuture || !dayConfirmable(dayRows)}
                    title={isFuture ? "You can't confirm time for a day that hasn't happened yet" : undefined}
                  >
                    {isFuture ? 'Upcoming' : 'Confirm'}
                  </button>
                </div>
              </div>
              {dayRows.length === 0 ? (
                <div className="ts-empty">No planned work.</div>
              ) : dayRows.map(r => (
                <div key={r.key} className="ts-row">
                  <span className="ts-proj"><span className="project-dot" style={{ background: r.projectColor }} />{r.projectName}</span>
                  <input
                    type="number" min="0" max="24" step="0.5" className="ts-hours"
                    value={r.hours}
                    disabled={!editable(r)}
                    onChange={e => setEdit(r.key, { hours: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)) })}
                  />
                  <input
                    type="text" className="ts-desc"
                    placeholder="What did you work on?"
                    value={r.description}
                    disabled={!editable(r)}
                    onChange={e => setEdit(r.key, { description: e.target.value })}
                  />
                  <span className={`badge ts-status ts-status-${r.status}`}>{STATUS_LABEL[r.status] || r.status}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
