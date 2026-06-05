import React, { useMemo, useState, useEffect } from 'react';
import { useStore, useDispatch } from '../store';
import {
  getMonthRange, getCurrentMonth, getCurrentDate, addMonths, monthDiff, monthLabelShort,
  dateOffset, dateOffsetEnd, getPersonPhases, stackBars, getProjectLabourSummary, getPhasePersonIds,
} from '../utils';
import { MONTH_WIDTH, BAR_HEIGHT, BAR_GAP, ROW_PADDING } from '../constants';

const SPAN_MONTHS = 6;

// Union of a project's explicit run-window (start → deadline) and the extent of
// its actual allocation, so the bar always covers what's planned.
function projectSpan(project) {
  const dates = [];
  if (project.start) dates.push(project.start);
  if (project.deadline) dates.push(project.deadline);
  for (const ph of project.phases || []) {
    if (ph.startMonth) dates.push(ph.startMonth);
    if (ph.endMonth) dates.push(ph.endMonth);
    for (const s of ph.slots || []) dates.push(s.date);
  }
  if (!dates.length) return null;
  dates.sort();
  return { start: dates[0], end: dates[dates.length - 1] };
}

function weeksBetween(a, b) {
  const days = (new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000;
  return Math.max(1, Math.round(days / 7));
}

// The Timeline is the long-range roadmap (months). Each project is a run-window
// bar you can drag to set its start/end; toggle to a per-person view to see who
// is on what across the months.
export default function TimelineView({ whatIfProject }) {
  const { team, projects, settings } = useStore();
  const blendedRate = settings?.blendedRate ?? 110;
  const [mode, setMode] = useState('projects'); // 'projects' | 'people'
  const [viewStart, setViewStart] = useState(() => getCurrentMonth());

  const months = useMemo(() => getMonthRange(viewStart, addMonths(viewStart, SPAN_MONTHS - 1)), [viewStart]);
  const now = getCurrentMonth();
  const today = getCurrentDate();
  const gridWidth = months.length * MONTH_WIDTH;
  const allProjects = whatIfProject ? [...projects, whatIfProject] : projects;

  return (
    <div className="timeline-view">
      <div className="alloc-toolbar">
        <div className="standup-scope">
          <button className={`ov-filter-btn ${mode === 'projects' ? 'active' : ''}`} onClick={() => setMode('projects')}>Projects</button>
          <button className={`ov-filter-btn ${mode === 'people' ? 'active' : ''}`} onClick={() => setMode('people')}>People</button>
        </div>
        <div className="timeline-nav">
          <button className="icon-btn" onClick={() => setViewStart(m => addMonths(m, -3))} title="Earlier">‹</button>
          <button className="text-btn" onClick={() => setViewStart(getCurrentMonth())}>This month</button>
          <button className="icon-btn" onClick={() => setViewStart(m => addMonths(m, 3))} title="Later">›</button>
        </div>
        <span className="alloc-hint">{mode === 'projects' ? 'Drag a bar to set when a project runs.' : 'Each person’s phases across the months.'}</span>
      </div>

      <div className="timeline-scroll">
        <div className="timeline-header" style={{ width: gridWidth }}>
          <div className="timeline-label-col">{mode === 'projects' ? 'Project' : 'Team Member'}</div>
          <div className="timeline-months">
            {months.map(m => (
              <div key={m} className={`timeline-month-cell ${m === now ? 'current' : ''}`} style={{ width: MONTH_WIDTH }}>
                {monthLabelShort(m)}
              </div>
            ))}
          </div>
        </div>

        {now >= viewStart && now <= months[months.length - 1] && (
          <div className="current-month-line" style={{ left: `calc(var(--label-width) + ${dateOffset(viewStart, today) * MONTH_WIDTH}px)` }} />
        )}

        {mode === 'projects'
          ? projects.map(p => (
              <ProjectRow key={p.id} project={p} viewStart={viewStart} months={months} gridWidth={gridWidth} blendedRate={blendedRate} />
            ))
          : team.map(person => (
              <PeopleRow key={person.id} person={person} allProjects={allProjects} viewStart={viewStart} months={months} gridWidth={gridWidth} />
            ))}

        {mode === 'projects' && projects.length === 0 && <div className="empty-state"><p>Add a project to see the roadmap.</p></div>}
      </div>
    </div>
  );
}

function ProjectRow({ project, viewStart, months, gridWidth, blendedRate }) {
  const dispatch = useDispatch();
  const span = projectSpan(project);
  const [drag, setDrag] = useState(null);
  const totalMonths = months.length;

  useEffect(() => {
    if (!drag) return;
    function onMove(e) {
      const dm = Math.round((e.clientX - drag.startX) / MONTH_WIDTH);
      let ns = drag.origStart, ne = drag.origEnd;
      if (drag.mode === 'left') { ns = addMonths(drag.origStart, dm); if (ns > ne) ns = ne; }
      else if (drag.mode === 'right') { ne = addMonths(drag.origEnd, dm); if (ne < ns) ne = ns; }
      else { ns = addMonths(drag.origStart, dm); ne = addMonths(drag.origEnd, dm); }
      setDrag(prev => ({ ...prev, previewStart: ns, previewEnd: ne }));
    }
    function onUp() {
      if (drag.previewStart && (drag.previewStart !== drag.origStart || drag.previewEnd !== drag.origEnd)) {
        dispatch({ type: 'UPDATE_PROJECT', payload: { id: project.id, start: drag.previewStart, deadline: drag.previewEnd } });
      }
      setDrag(null);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [drag, dispatch, project.id]);

  function startDrag(e, mode) {
    if (!span) return;
    e.stopPropagation(); e.preventDefault();
    setDrag({ mode, startX: e.clientX, origStart: span.start, origEnd: span.end });
  }

  const start = drag?.previewStart || span?.start;
  const end = drag?.previewEnd || span?.end;
  const hours = getProjectLabourSummary(project, blendedRate).totalHours;

  let bar = null;
  if (span) {
    const startOff = dateOffset(viewStart, start);
    const endOff = dateOffsetEnd(viewStart, end);
    if (endOff > 0 && startOff < totalMonths) {
      const left = Math.max(0, startOff) * MONTH_WIDTH;
      const width = Math.max((Math.min(totalMonths, endOff) - Math.max(0, startOff)) * MONTH_WIDTH - 2, 24);
      bar = (
        <div className={`phase-bar ${drag ? 'dragging' : ''}`}
          style={{ left, top: ROW_PADDING, width, height: BAR_HEIGHT, background: project.color }}
          title={`${project.name}: ${start} → ${end} (${weeksBetween(start, end)} wks)`}>
          <div className="drag-handle drag-handle-left" onMouseDown={e => startDrag(e, 'left')} />
          <span className="bar-label" onMouseDown={e => startDrag(e, 'move')} style={{ cursor: 'grab' }}>
            {project.name}<span className="bar-phase">{weeksBetween(start, end)}w</span>
          </span>
          <div className="drag-handle drag-handle-right" onMouseDown={e => startDrag(e, 'right')} />
        </div>
      );
    }
  }

  return (
    <div className="timeline-row" style={{ minHeight: BAR_HEIGHT + ROW_PADDING * 2 }}>
      <div className="timeline-label-col person-label">
        <span className="project-dot" style={{ background: project.color }} />
        <span className="person-name">{project.name}</span>
        {hours > 0 && <span className="alloc-fill">{hours}h</span>}
      </div>
      <div className="timeline-cells" style={{ width: gridWidth }}>
        {!span && <span className="phase-empty-hint">No dates yet — set a deadline or allocate work</span>}
        {bar}
      </div>
    </div>
  );
}

function PeopleRow({ person, allProjects, viewStart, months, gridWidth }) {
  const bars = useMemo(() => getPersonPhases(person.id, allProjects), [person.id, allProjects]);
  const { bars: stacked, rowCount } = useMemo(() => stackBars(bars), [bars]);
  const rowHeight = Math.max(1, rowCount) * (BAR_HEIGHT + BAR_GAP) + ROW_PADDING * 2;
  const totalMonths = months.length;

  return (
    <div className="timeline-row" style={{ minHeight: rowHeight }}>
      <div className="timeline-label-col person-label"><span className="person-name">{person.name}</span></div>
      <div className="timeline-cells" style={{ width: gridWidth }}>
        {stacked.map(bar => {
          const startOff = dateOffset(viewStart, bar.startMonth);
          const endOff = dateOffsetEnd(viewStart, bar.endMonth);
          if (endOff < 0 || startOff > totalMonths) return null;
          const left = Math.max(0, startOff) * MONTH_WIDTH;
          const width = Math.max((Math.min(totalMonths, endOff) - Math.max(0, startOff)) * MONTH_WIDTH - 2, 20);
          const top = ROW_PADDING + bar._row * (BAR_HEIGHT + BAR_GAP);
          const halves = (bar.slots || []).filter(s => s.personId === person.id).length;
          return (
            <div key={bar.id} className={`phase-bar ${bar.isWhatIf ? 'what-if' : ''}`}
              style={{ left, top, width, height: BAR_HEIGHT, background: bar.projectColor }}
              title={`${bar.projectName} — ${halves} half-day${halves !== 1 ? 's' : ''}`}>
              <span className="bar-label">{bar.projectName}<span className="bar-phase">{halves}</span></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
