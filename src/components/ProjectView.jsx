import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '../store';
import { getMonthRange, getCurrentMonth, getCurrentDate, monthDiff, addMonths, getPhaseIntensity, stackBars, monthLabelShort, dateOffset, dateOffsetEnd, getPhasePersonIds } from '../utils';
import { PHASE_TYPES, MONTH_WIDTH, BAR_HEIGHT, BAR_GAP, ROW_PADDING } from '../constants';

export default function ProjectView({ viewStart, viewEnd, selectedProjectId, setSelectedProjectId, whatIfProject, onAddPhase, onEditPhase, onDragUpdate }) {
  const { team, projects } = useStore();
  const months = useMemo(() => getMonthRange(viewStart, viewEnd), [viewStart, viewEnd]);
  const now = getCurrentMonth();

  const allProjects = useMemo(() => {
    const list = [...projects];
    if (whatIfProject) list.push(whatIfProject);
    return list;
  }, [projects, whatIfProject]);

  const project = allProjects.find(p => p.id === selectedProjectId) || allProjects[0];

  if (!project) {
    return (
      <div className="empty-state">
        <p>No projects yet. Add one in the sidebar to get started.</p>
      </div>
    );
  }

  // Group phases by person — a phase with multiple personIds appears under each person
  const phasesByPerson = useMemo(() => {
    const map = {};
    for (const ph of project.phases) {
      const pids = getPhasePersonIds(ph);
      for (const pid of pids) {
        if (!map[pid]) map[pid] = [];
        map[pid].push({ ...ph, projectId: project.id, projectName: project.name, projectColor: project.color, isWhatIf: project.isWhatIf || false });
      }
    }
    return map;
  }, [project]);

  const involvedPeople = team.filter(m => phasesByPerson[m.id]);
  const uninvolved = team.filter(m => !phasesByPerson[m.id]);
  const gridWidth = months.length * MONTH_WIDTH;

  // Deadline
  const deadlineOffset = project.deadline && project.deadline >= viewStart && project.deadline <= viewEnd
    ? monthDiff(viewStart, project.deadline)
    : null;

  return (
    <div className="project-view">
      <div className="project-view-header">
        <select
          value={project.id}
          onChange={e => setSelectedProjectId(e.target.value)}
          className="project-select"
          style={{ borderColor: project.color }}
        >
          {allProjects.map(p => (
            <option key={p.id} value={p.id}>{p.name}{p.isWhatIf ? ' (What-If)' : ''}</option>
          ))}
        </select>
        <span className="project-dot-lg" style={{ background: project.color }} />
        {project.deadline && <span className="project-deadline">Deadline: {monthLabelShort(project.deadline)}</span>}
        <button className="text-btn-sm" onClick={() => onAddPhase(project.id)}>+ Add Phase</button>
      </div>

      <div className="timeline-scroll">
        <div className="timeline-header" style={{ width: gridWidth }}>
          <div className="timeline-label-col">Team Member</div>
          <div className="timeline-months">
            {months.map(m => (
              <div key={m} className={`timeline-month-cell ${m === now ? 'current' : ''}`} style={{ width: MONTH_WIDTH }}>
                {monthLabelShort(m)}
              </div>
            ))}
          </div>
        </div>

        {/* Current month */}
        {now >= viewStart && now <= viewEnd && (
          <div className="current-month-line" style={{ left: `calc(var(--label-width) + ${monthDiff(viewStart, now) * MONTH_WIDTH + MONTH_WIDTH / 2}px)` }} />
        )}

        {/* Deadline */}
        {deadlineOffset != null && (
          <div className="deadline-line" style={{ left: `calc(var(--label-width) + ${deadlineOffset * MONTH_WIDTH + MONTH_WIDTH - 2}px)`, borderColor: project.color }}>
            <span className="deadline-label" style={{ color: project.color }}>Deadline</span>
          </div>
        )}

        {/* Involved people */}
        {involvedPeople.map(person => (
          <ProjectPersonRow
            key={person.id}
            person={person}
            bars={phasesByPerson[person.id] || []}
            project={project}
            months={months}
            viewStart={viewStart}
            gridWidth={gridWidth}
            now={now}
            onAddPhase={onAddPhase}
            onEditPhase={onEditPhase}
            onDragUpdate={onDragUpdate}
          />
        ))}

        {/* Uninvolved people (dimmed) */}
        {uninvolved.map(person => (
          <div key={person.id} className="timeline-row dimmed" style={{ minHeight: BAR_HEIGHT + ROW_PADDING * 2 }}>
            <div className="timeline-label-col person-label">
              <span className="person-name">{person.name}</span>
            </div>
            <div className="timeline-cells" style={{ width: gridWidth }}>
              {months.map(m => (
                <div key={m} className={`timeline-cell ${m === now ? 'current' : ''}`} style={{ width: MONTH_WIDTH }}
                  onClick={() => {
                    const clickDate = `${m}-01`;
                    onAddPhase(project.id, { personIds: [person.id], startMonth: clickDate, endMonth: clickDate });
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectPersonRow({ person, bars: rawBars, project, months, viewStart, gridWidth, now, onAddPhase, onEditPhase, onDragUpdate }) {
  const { bars: stacked, rowCount } = useMemo(() => stackBars(rawBars), [rawBars]);
  const rowHeight = Math.max(1, rowCount) * (BAR_HEIGHT + BAR_GAP) + ROW_PADDING * 2;
  const [drag, setDrag] = useState(null);

  useEffect(() => {
    if (!drag) return;
    function onMouseMove(e) {
      const deltaX = e.clientX - drag.startX;
      const dm = Math.round(deltaX / MONTH_WIDTH);
      let ns, ne;
      if (drag.mode === 'left') { ns = addMonths(drag.origStart, dm); ne = drag.origEnd; if (ns > ne) ns = ne; }
      else if (drag.mode === 'right') { ns = drag.origStart; ne = addMonths(drag.origEnd, dm); if (ne < ns) ne = ns; }
      else { ns = addMonths(drag.origStart, dm); ne = addMonths(drag.origEnd, dm); }
      setDrag(prev => ({ ...prev, previewStart: ns, previewEnd: ne }));
    }
    function onMouseUp() {
      if (drag.previewStart !== undefined && (drag.previewStart !== drag.origStart || drag.previewEnd !== drag.origEnd))
        onDragUpdate(drag.projectId, drag.phaseId, { startMonth: drag.previewStart, endMonth: drag.previewEnd }, drag.isWhatIf);
      setDrag(null);
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
  }, [drag, onDragUpdate]);

  function startDrag(e, bar, mode) {
    e.stopPropagation(); e.preventDefault();
    setDrag({ phaseId: bar.id, projectId: bar.projectId, isWhatIf: bar.isWhatIf, mode, startX: e.clientX, origStart: bar.startMonth, origEnd: bar.endMonth });
  }

  return (
    <div className="timeline-row" style={{ minHeight: rowHeight }}>
      <div className="timeline-label-col person-label"><span className="person-name">{person.name}</span></div>
      <div className="timeline-cells" style={{ width: gridWidth }}>
        {months.map(m => (
          <div key={m} className={`timeline-cell ${m === now ? 'current' : ''}`} style={{ width: MONTH_WIDTH }}
            onClick={() => {
              const clickDate = `${m}-01`;
              onAddPhase(project.id, { personIds: [person.id], startMonth: clickDate, endMonth: clickDate });
            }} />
        ))}
        {stacked.map(bar => {
          const isDragging = drag && drag.phaseId === bar.id;
          const bs = isDragging && drag.previewStart ? drag.previewStart : bar.startMonth;
          const be = isDragging && drag.previewEnd ? drag.previewEnd : bar.endMonth;

          const startOff = dateOffset(viewStart, bs);
          const endOff = dateOffsetEnd(viewStart, be);
          const totalMonths = months.length;

          if (endOff < 0 || startOff > totalMonths) return null;

          const clampedStart = Math.max(0, startOff);
          const clampedEnd = Math.min(totalMonths, endOff);
          const left = clampedStart * MONTH_WIDTH;
          let width = Math.max((clampedEnd - clampedStart) * MONTH_WIDTH - 4, 30);
          if (bar._nextStart) {
            const ceiling = dateOffset(viewStart, bar._nextStart) * MONTH_WIDTH - left - 4;
            if (ceiling < width) width = Math.max(0, ceiling);
          }
          const top = ROW_PADDING + bar._row * (BAR_HEIGHT + BAR_GAP);
          const intensity = getPhaseIntensity(bar); const pi = PHASE_TYPES[bar.type];
          return (
            <div key={bar.id} className={`phase-bar ${bar.isWhatIf ? 'what-if' : ''} ${isDragging ? 'dragging' : ''}`}
              style={{ left, top, width, height: BAR_HEIGHT, background: project.color, opacity: 0.4 + (intensity / 100) * 0.6 }}
              title={`${pi?.label || bar.type} (${intensity}%)`}
              onClick={e => { e.stopPropagation(); if (!isDragging) onEditPhase(project.id, bar); }}>
              <div className="drag-handle drag-handle-left" onMouseDown={e => startDrag(e, bar, 'left')} />
              <span className="bar-label" onMouseDown={e => startDrag(e, bar, 'move')} style={{ cursor: 'grab' }}>
                {pi?.label || bar.type}<span className="bar-phase">{intensity}%</span>
              </span>
              <div className="drag-handle drag-handle-right" onMouseDown={e => startDrag(e, bar, 'right')} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
