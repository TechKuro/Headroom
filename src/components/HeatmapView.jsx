import React, { useMemo } from 'react';
import { useStore } from '../store';
import { getWorkingDayRange, getCurrentDate, getPersonSlotMap, isSlotAvailable } from '../utils';
import { SLOT_WIDTH, DAY_WIDTH, HALVES } from '../constants';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function dayLabel(date) {
  const dt = new Date(date + 'T12:00:00');
  return `${DOW[dt.getDay()]} ${dt.getDate()}`;
}

// Over-commitment view: per engineer × half-day, across ALL projects. Green =
// committed, red = double-booked (claimed by more than one project that half).
export default function HeatmapView({ viewStart, viewEnd, whatIfProject, finderMatches }) {
  const { team, projects, capacityOverrides } = useStore();
  const days = useMemo(() => getWorkingDayRange(viewStart, viewEnd), [viewStart, viewEnd]);
  const today = getCurrentDate();
  const allProjects = whatIfProject ? [...projects, whatIfProject] : projects;
  const gridWidth = days.length * DAY_WIDTH;

  // One slot map per person (single pass), reused for cells + summary.
  const maps = useMemo(() => {
    const m = {};
    for (const person of team) m[person.id] = getPersonSlotMap(person.id, allProjects);
    return m;
  }, [team, allProjects]);

  const summary = useMemo(() => team.map(person => {
    const map = maps[person.id];
    let committed = 0, doubleBooked = 0;
    for (const date of days) for (const half of HALVES) {
      const n = (map.get(`${date}|${half}`) || []).length;
      if (n > 0) committed++;
      if (n > 1) doubleBooked++;
    }
    const total = days.length * HALVES.length;
    return { person, committed, doubleBooked, free: total - committed, total };
  }), [team, days, maps]);

  const todayIdx = days.indexOf(today);

  return (
    <div className="heatmap-view">
      <div className="oc-legend">
        <span><span className="oc-key" style={{ background: '#16a34a' }} /> Committed</span>
        <span><span className="oc-key" style={{ background: '#dc2626' }} /> Double-booked</span>
        <span><span className="oc-key oc-key-leave" /> On leave</span>
      </div>

      <div className="timeline-scroll">
        <div className="alloc-header" style={{ width: gridWidth }}>
          <div className="timeline-label-col">Team Member</div>
          <div className="alloc-days">
            {days.map(d => (
              <div key={d} className={`alloc-day ${d === today ? 'current' : ''}`} style={{ width: DAY_WIDTH }}>
                <div className="alloc-day-label">{dayLabel(d)}</div>
                <div className="alloc-halves"><span style={{ width: SLOT_WIDTH }}>AM</span><span style={{ width: SLOT_WIDTH }}>PM</span></div>
              </div>
            ))}
          </div>
        </div>

        {todayIdx >= 0 && (
          <div className="current-month-line" style={{ left: `calc(var(--label-width) + ${todayIdx * DAY_WIDTH}px)` }} />
        )}

        {team.length === 0 ? (
          <div className="empty-state"><p>Add team members to see over-commitment.</p></div>
        ) : team.map(person => (
          <div key={person.id} className="alloc-row">
            <div className="timeline-label-col person-label">
              <span className="person-name">{person.name}</span>
            </div>
            <div className="alloc-cells" style={{ width: gridWidth }}>
              {days.map(date => HALVES.map(half => {
                const claims = maps[person.id].get(`${date}|${half}`) || [];
                const over = claims.length > 1;
                const avail = isSlotAvailable(person.id, date, half, capacityOverrides);
                const bg = !avail && claims.length === 0 ? undefined
                  : over ? '#dc2626'
                  : claims.length === 1 ? '#16a34a'
                  : undefined;
                const title = claims.length
                  ? `${claims.map(c => c.projectName).join(' + ')} — ${dayLabel(date)} ${half.toUpperCase()}${over ? ' · DOUBLE-BOOKED' : ''}${!avail ? ' · on leave' : ''}`
                  : `${avail ? 'Free' : 'On leave'} — ${dayLabel(date)} ${half.toUpperCase()}`;
                return (
                  <div
                    key={`${date}|${half}`}
                    className={`oc-cell ${half === 'pm' ? 'day-end' : ''} ${!avail ? 'leave' : ''} ${date === today ? 'current' : ''} ${finderMatches?.[person.id]?.has(`${date}|${half}`) ? 'finder-match' : ''}`}
                    style={{ width: SLOT_WIDTH, background: bg }}
                    title={title}
                  >
                    {over ? claims.length : ''}
                  </div>
                );
              }))}
            </div>
          </div>
        ))}
      </div>

      {/* Per-person summary over the visible fortnight */}
      <div className="util-summary">
        <div className="util-header">Commitment — {days.length} working days shown</div>
        {summary.map(({ person, committed, doubleBooked, free, total }) => (
          <div key={person.id} className="util-row">
            <span className="util-name">{person.name}</span>
            <div className="util-bar-track">
              <div className="util-bar-fill" style={{ width: `${(committed / total) * 100}%`, background: doubleBooked ? '#dc2626' : '#16a34a' }} />
            </div>
            <span className="util-avg">{committed}/{total} halves</span>
            <span className={`util-peak ${doubleBooked ? 'over' : ''}`}>{doubleBooked} double-booked</span>
            <span className="util-free">{free} free</span>
          </div>
        ))}
      </div>
    </div>
  );
}
