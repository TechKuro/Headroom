import React, { useMemo } from 'react';
import { useStore, useDispatch } from '../store';
import { getWorkingDayRange, getCurrentDate, getPersonSlotMap, isSlotAvailable, genId } from '../utils';
import { SLOT_WIDTH, DAY_WIDTH, HALVES } from '../constants';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function dayLabel(date) { const d = new Date(date + 'T12:00:00'); return `${DOW[d.getDay()]} ${d.getDate()}`; }

export default function ProjectView({ viewStart, viewEnd, selectedProjectId, setSelectedProjectId, whatIfProject, onAddPhase }) {
  const { team, projects } = useStore();
  const dispatch = useDispatch();
  const days = useMemo(() => getWorkingDayRange(viewStart, viewEnd), [viewStart, viewEnd]);
  const today = getCurrentDate();

  const allProjects = useMemo(() => (whatIfProject ? [...projects, whatIfProject] : projects), [projects, whatIfProject]);
  const project = allProjects.find(p => p.id === selectedProjectId) || allProjects[0];

  if (!project) {
    return <div className="empty-state"><p>No projects yet. Add one in the sidebar to get started.</p></div>;
  }

  const readOnly = !!project.isWhatIf;
  const gridWidth = days.length * DAY_WIDTH;
  const todayIdx = days.indexOf(today);

  function toggle(person, date, half) {
    if (readOnly) return;
    const phase = (project.phases || []).find(ph =>
      (ph.slots || []).some(s => s.personId === person.id && s.date === date && s.half === half));
    if (phase) {
      dispatch({ type: 'DEALLOCATE_SLOT', payload: { projectId: project.id, phaseId: phase.id, personId: person.id, date, half } });
    } else if (project.phases?.length) {
      dispatch({ type: 'ALLOCATE_SLOT', payload: { projectId: project.id, phaseId: project.phases[0].id, personId: person.id, date, half } });
    } else {
      dispatch({ type: 'ADD_PHASE', payload: { projectId: project.id, phase: {
        id: genId(), type: 'active-build', slots: [{ personId: person.id, date, half }],
        personIds: [person.id], startMonth: date, endMonth: date,
      } } });
    }
  }

  return (
    <div className="project-view">
      <div className="project-view-header">
        <select value={project.id} onChange={e => setSelectedProjectId(e.target.value)} className="project-select" style={{ borderColor: project.color }}>
          {allProjects.map(p => <option key={p.id} value={p.id}>{p.name}{p.isWhatIf ? ' (What-If)' : ''}</option>)}
        </select>
        <span className="project-dot-lg" style={{ background: project.color }} />
        {project.deadline && <span className="project-deadline">Deadline: {dayLabel(project.deadline)}</span>}
        <span className="alloc-hint">{readOnly ? 'What-if is read-only here.' : 'Click a half-day cell to allocate / remove.'}</span>
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

        {team.map(person => (
          <ProjectPersonRow
            key={person.id}
            person={person}
            project={project}
            allProjects={allProjects}
            days={days}
            today={today}
            gridWidth={gridWidth}
            readOnly={readOnly}
            onToggle={toggle}
          />
        ))}
      </div>
    </div>
  );
}

const ProjectPersonRow = React.memo(function ProjectPersonRow({ person, project, allProjects, days, today, gridWidth, readOnly, onToggle }) {
  const slotMap = useMemo(() => getPersonSlotMap(person.id, allProjects), [person.id, allProjects]);
  const hasAny = days.some(d => HALVES.some(h => (slotMap.get(`${d}|${h}`) || []).some(c => c.projectId === project.id)));

  return (
    <div className={`alloc-row ${hasAny ? '' : 'dimmed'}`}>
      <div className="timeline-label-col person-label"><span className="person-name">{person.name}</span></div>
      <div className="alloc-cells" style={{ width: gridWidth }}>
        {days.map(date => HALVES.map(half => {
          const claims = slotMap.get(`${date}|${half}`) || [];
          const onThis = claims.some(c => c.projectId === project.id);
          const over = claims.length > 1;
          const elsewhere = !onThis && claims.length > 0;
          const avail = isSlotAvailable(person.id, date, half);
          const title = onThis
            ? `${project.name} — ${dayLabel(date)} ${half.toUpperCase()}${over ? ' · also booked elsewhere' : ''}`
            : elsewhere ? `Busy: ${claims.map(c => c.projectName).join(', ')} — ${dayLabel(date)} ${half.toUpperCase()}`
            : `${avail ? 'Free' : 'On leave'} — ${dayLabel(date)} ${half.toUpperCase()}`;
          return (
            <button
              key={`${date}|${half}`}
              className={`alloc-cell ${half === 'pm' ? 'day-end' : ''} ${onThis && over ? 'over' : ''} ${elsewhere ? 'busy-elsewhere' : ''} ${!avail ? 'leave' : ''} ${date === today ? 'current' : ''}`}
              style={{ width: SLOT_WIDTH, background: onThis && !over ? project.color : undefined, cursor: readOnly ? 'default' : 'pointer' }}
              title={title}
              onClick={() => onToggle(person, date, half)}
            />
          );
        }))}
      </div>
    </div>
  );
});
