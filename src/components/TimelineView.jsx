import React, { useMemo, useState } from 'react';
import { useStore, useDispatch } from '../store';
import { getWorkingDayRange, getCurrentDate, getPersonSlotMap, isSlotAvailable, genId } from '../utils';
import { SLOT_WIDTH, DAY_WIDTH, HALVES } from '../constants';
import { addToast } from '../toast';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function dayLabel(date) {
  const dt = new Date(date + 'T12:00:00');
  return `${DOW[dt.getDay()]} ${dt.getDate()}`;
}

// The Timeline is the half-day allocation grid: people × (working day × AM/PM).
// Pick the project you're allocating, then click a person's slot to add/remove
// them. A slot already claimed by another project shows that colour; clicking
// adds the selected project on top (a double-booking, flagged red).
export default function TimelineView({ viewStart, viewEnd, whatIfProject, finderMatches }) {
  const { team, projects } = useStore();
  const dispatch = useDispatch();
  const days = useMemo(() => getWorkingDayRange(viewStart, viewEnd), [viewStart, viewEnd]);
  const today = getCurrentDate();
  const allProjects = whatIfProject ? [...projects, whatIfProject] : projects;
  const gridWidth = days.length * DAY_WIDTH;

  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? null);
  const selected = projects.find(p => p.id === selectedProjectId) || projects[0] || null;

  function toggleSlot(person, date, half) {
    if (!selected) { addToast('Add a project first to allocate work.', 'warn'); return; }
    const phase = (selected.phases || []).find(ph =>
      (ph.slots || []).some(s => s.personId === person.id && s.date === date && s.half === half));
    if (phase) {
      dispatch({ type: 'DEALLOCATE_SLOT', payload: { projectId: selected.id, phaseId: phase.id, personId: person.id, date, half } });
    } else if (selected.phases?.length) {
      dispatch({ type: 'ALLOCATE_SLOT', payload: { projectId: selected.id, phaseId: selected.phases[0].id, personId: person.id, date, half } });
    } else {
      dispatch({ type: 'ADD_PHASE', payload: { projectId: selected.id, phase: {
        id: genId(), type: 'active-build', slots: [{ personId: person.id, date, half }],
        personIds: [person.id], startMonth: date, endMonth: date,
      } } });
    }
  }

  const todayIdx = days.indexOf(today);

  return (
    <div className="timeline-view">
      <div className="alloc-toolbar">
        <span className="alloc-toolbar-label">Allocating to</span>
        <select className="alloc-project-select" value={selected?.id || ''} onChange={e => setSelectedProjectId(e.target.value)}>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {selected && <span className="project-dot" style={{ background: selected.color }} />}
        <span className="alloc-hint">Click a half-day cell to add / remove this person.</span>
      </div>

      <div className="timeline-scroll">
        <div className="alloc-header" style={{ width: gridWidth }}>
          <div className="timeline-label-col">Team Member</div>
          <div className="alloc-days">
            {days.map(d => (
              <div key={d} className={`alloc-day ${d === today ? 'current' : ''}`} style={{ width: DAY_WIDTH }}>
                <div className="alloc-day-label">{dayLabel(d)}</div>
                <div className="alloc-halves">
                  <span style={{ width: SLOT_WIDTH }}>AM</span>
                  <span style={{ width: SLOT_WIDTH }}>PM</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {todayIdx >= 0 && (
          <div className="current-month-line" style={{ left: `calc(var(--label-width) + ${todayIdx * DAY_WIDTH}px)` }} />
        )}

        {team.length === 0 ? (
          <div className="empty-state"><p>Add team members to allocate work.</p></div>
        ) : team.map(person => (
          <PersonRow
            key={person.id}
            person={person}
            allProjects={allProjects}
            days={days}
            gridWidth={gridWidth}
            today={today}
            finderSlots={finderMatches?.[person.id]}
            onToggle={toggleSlot}
          />
        ))}
      </div>
    </div>
  );
}

const PersonRow = React.memo(function PersonRow({ person, allProjects, days, gridWidth, today, finderSlots, onToggle }) {
  const slotMap = useMemo(() => getPersonSlotMap(person.id, allProjects), [person.id, allProjects]);

  let filled = 0, doubleBooked = 0;
  for (const date of days) for (const half of HALVES) {
    const n = (slotMap.get(`${date}|${half}`) || []).length;
    if (n > 0) filled++;
    if (n > 1) doubleBooked++;
  }

  return (
    <div className="alloc-row">
      <div className="timeline-label-col person-label">
        <span className="person-name">{person.name}</span>
        <span className="alloc-fill">{filled}/{days.length * HALVES.length}</span>
        {doubleBooked > 0 && <span className="load-badge over">⚠ {doubleBooked}</span>}
      </div>
      <div className="alloc-cells" style={{ width: gridWidth }}>
        {days.map(date => HALVES.map(half => {
          const key = `${date}|${half}`;
          const claims = slotMap.get(key) || [];
          const over = claims.length > 1;
          const avail = isSlotAvailable(person.id, date, half);
          const title = claims.length
            ? `${claims.map(c => c.projectName).join(' + ')} — ${dayLabel(date)} ${half.toUpperCase()}${over ? ' (double-booked)' : ''}`
            : `${avail ? 'Free' : 'On leave'} — ${dayLabel(date)} ${half.toUpperCase()}`;
          return (
            <button
              key={key}
              className={`alloc-cell ${half === 'pm' ? 'day-end' : ''} ${over ? 'over' : ''} ${!avail ? 'leave' : ''} ${date === today ? 'current' : ''} ${finderSlots?.has(key) ? 'finder-match' : ''}`}
              style={{ width: SLOT_WIDTH, background: claims.length && !over ? claims[0].projectColor : undefined }}
              title={title}
              onClick={() => onToggle(person, date, half)}
            />
          );
        }))}
      </div>
    </div>
  );
});
