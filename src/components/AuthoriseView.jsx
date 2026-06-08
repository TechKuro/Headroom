import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useStore } from '../store';
import { api } from '../api';
import { getCurrentDate, addDays, getWorkingDayRange, claimableHours, isLateConfirmation, formatHours } from '../utils';
import { MAX_HOURS_PER_DAY } from '../constants';
import { addToast } from '../toast';
import { confirmDialog } from '../confirm';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayLabel = d => { const dt = new Date(d + 'T12:00:00'); return `${DOW[dt.getDay()]} ${dt.getDate()} ${MONTHS[dt.getMonth()]}`; };
const mondayOf = date => { let d = date; while (new Date(d + 'T12:00:00').getDay() !== 1) d = addDays(d, -1); return d; };
const STATUS_LABEL = { draft: 'Draft', confirmed: 'Confirmed', authorised: 'Authorised', locked: 'Locked' };

// Manager-facing authorise/lock view. Confirmed time can be authorised (counts
// toward claims); a period can be locked (immutable). Authorisation/locking are
// advisory until server-enforced roles land. Corrections to authorised/locked
// entries are made as adjusting entries.
export default function AuthoriseView() {
  const { team, projects } = useStore();
  const [weekStart, setWeekStart] = useState(() => mondayOf(getCurrentDate()));
  const [entries, setEntries] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [adjustId, setAdjustId] = useState(null); // entry being adjusted (inline)
  const [adjustHours, setAdjustHours] = useState('');

  const days = useMemo(() => getWorkingDayRange(weekStart, addDays(weekStart, 4)), [weekStart]);
  const from = days[0];
  const to = days[days.length - 1];

  const projName = useCallback(id => projects.find(p => p.id === id)?.name || '(removed project)', [projects]);
  const projColor = useCallback(id => projects.find(p => p.id === id)?.color || '#6b7390', [projects]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.listTimeEntries({ from, to });
      setEntries(res.entries || []);
      setSelected(new Set());
    } catch (e) {
      setError(e?.message || 'Could not load time entries.');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  // Group by person → by day; compute day totals / claimable / over-cap.
  const people = useMemo(() => {
    const byPerson = new Map();
    for (const e of entries) {
      const pid = e.person_id;
      const name = e.person_name || team.find(m => m.id === pid)?.name || pid;
      const rec = byPerson.get(pid) || { id: pid, name, rows: [], dayHours: {} };
      const date = String(e.work_date).slice(0, 10);
      rec.rows.push({ ...e, date });
      rec.dayHours[date] = (rec.dayHours[date] || 0) + Number(e.hours);
      byPerson.set(pid, rec);
    }
    for (const rec of byPerson.values()) {
      rec.rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : projName(a.tracker_project_id).localeCompare(projName(b.tracker_project_id))));
    }
    return [...byPerson.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, team, projName]);

  const confirmedIds = useMemo(() => entries.filter(e => e.status === 'confirmed').map(e => e.id), [entries]);
  const allConfirmedSelected = confirmedIds.length > 0 && confirmedIds.every(id => selected.has(id));

  function toggle(id) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSelected(allConfirmedSelected ? new Set() : new Set(confirmedIds));
  }

  async function authorise() {
    if (selected.size === 0) return;
    setLoading(true); setError(null);
    try {
      const res = await api.authoriseTimeEntries([...selected]);
      addToast(`Authorised ${res.authorised} entr${res.authorised === 1 ? 'y' : 'ies'}`, 'success');
      await load();
    } catch (e) { setError(e?.message || 'Authorise failed.'); }
    finally { setLoading(false); }
  }

  async function lockWeek() {
    const ok = await confirmDialog({
      title: 'Lock period',
      message: `Lock all authorised entries from ${dayLabel(from)} to ${dayLabel(to)}? Locked entries can only be corrected via adjusting entries.`,
      confirmLabel: 'Lock period', danger: true,
    });
    if (!ok) return;
    setLoading(true); setError(null);
    try {
      const res = await api.lockTimePeriod({ from, to });
      addToast(`Locked ${res.locked}${res.pendingConfirmed ? ` · ${res.pendingConfirmed} confirmed but not authorised (left unlocked)` : ''}`, res.pendingConfirmed ? 'warn' : 'success');
      await load();
    } catch (e) { setError(e?.message || 'Lock failed.'); }
    finally { setLoading(false); }
  }

  function startAdjust(e) {
    setAdjustId(e.id);
    setAdjustHours(String(e.hours));
  }

  async function saveAdjust(e) {
    const hours = Number(adjustHours);
    if (!Number.isFinite(hours) || hours < 0) { addToast('Enter valid hours', 'error'); return; }
    setLoading(true); setError(null);
    try {
      await api.createTimeEntries([{
        personId: e.person_id, personName: e.person_name, workDate: e.date, hours,
        description: `Adjustment: ${e.description || ''}`.trim(), trackerProjectId: e.tracker_project_id,
        adjustsEntryId: e.id, sourceSlots: [],
      }]);
      addToast('Adjusting entry created', 'success');
      setAdjustId(null);
      await load();
    } catch (err) { setError(err?.message || 'Adjustment failed.'); }
    finally { setLoading(false); }
  }

  return (
    <div className="authorise-view">
      <div className="ts-toolbar">
        <div className="timeline-nav">
          <button className="icon-btn" onClick={() => setWeekStart(w => mondayOf(addDays(w, -7)))} title="Previous week">‹</button>
          <button className="text-btn" onClick={() => setWeekStart(mondayOf(getCurrentDate()))}>This week</button>
          <button className="icon-btn" onClick={() => setWeekStart(w => mondayOf(addDays(w, 7)))} title="Next week">›</button>
        </div>
        <span className="alloc-hint">{dayLabel(from)} – {dayLabel(to)}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={authorise} disabled={loading || selected.size === 0}>
            Authorise selected ({selected.size})
          </button>
          <button className="btn btn-secondary" onClick={lockWeek} disabled={loading}>Lock week</button>
        </div>
      </div>

      <div className="ts-advisory">
        Authorise confirmed time, then lock the period. Flags: <span className="av-flag">late</span> = confirmed &gt;7 days after the work;
        <span className="av-flag over"> over</span> = day exceeds the {MAX_HOURS_PER_DAY}h claimable cap (only the cap is claimable).
        Authorisation &amp; locking are advisory until server-enforced roles are enabled.
      </div>

      {error && <div className="ts-error">{error}</div>}

      {confirmedIds.length > 0 && (
        <label className="av-selectall">
          <input type="checkbox" checked={allConfirmedSelected} onChange={toggleAll} /> Select all confirmed ({confirmedIds.length})
        </label>
      )}

      {people.length === 0 ? (
        <div className="empty-state"><p>No time entries in this week.</p></div>
      ) : people.map(person => (
        <div key={person.id} className="av-person">
          <div className="av-person-head">{person.name}</div>
          {person.rows.map(e => {
            const dayTotal = person.dayHours[e.date] || 0;
            const over = dayTotal > MAX_HOURS_PER_DAY;
            const late = isLateConfirmation(e.date, e.confirmed_at);
            const selectable = e.status === 'confirmed';
            return (
              <div key={e.id} className={`av-row ${e.adjusts_entry_id ? 'av-adjust' : ''}`}>
                <input type="checkbox" disabled={!selectable} checked={selected.has(e.id)} onChange={() => toggle(e.id)} />
                <span className="av-date">{dayLabel(e.date)}</span>
                <span className="av-proj"><span className="project-dot" style={{ background: projColor(e.tracker_project_id) }} />{projName(e.tracker_project_id)}{e.adjusts_entry_id ? ' (adj.)' : ''}</span>
                <span className="av-hours mono">{formatHours(Number(e.hours))}{over ? ` / ${claimableHours(e.hours, MAX_HOURS_PER_DAY)} claim` : ''}</span>
                <span className="av-desc" title={e.description || ''}>{e.description || <em>no note</em>}</span>
                {late && <span className="av-flag" title={`Confirmed ${e.confirmed_at}`}>late</span>}
                {over && <span className="av-flag over">over</span>}
                <span className={`badge ts-status ts-status-${e.status}`}>{STATUS_LABEL[e.status] || e.status}</span>
                {(e.status === 'authorised' || e.status === 'locked') && (
                  adjustId === e.id ? (
                    <span className="av-adjust-edit">
                      <input type="number" min="0" max="24" step="0.5" className="av-adjust-input" autoFocus
                        value={adjustHours} onChange={ev => setAdjustHours(ev.target.value)}
                        onKeyDown={ev => { if (ev.key === 'Enter') saveAdjust(e); if (ev.key === 'Escape') setAdjustId(null); }} />
                      <button className="btn btn-primary btn-sm" disabled={loading} onClick={() => saveAdjust(e)}>Save</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setAdjustId(null)}>Cancel</button>
                    </span>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={() => startAdjust(e)}>Adjust</button>
                  )
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
