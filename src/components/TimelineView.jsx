import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { getMonthRange, getCurrentMonth, getCurrentDate, getPersonPhases, stackBars, monthDiff, getPhaseIntensity, calculateLoad, addMonths, monthLabelShort, dateOffset, dateOffsetEnd, getPhasePersonIds } from '../utils';
import { PHASE_TYPES, MONTH_WIDTH, BAR_HEIGHT, BAR_GAP, ROW_PADDING } from '../constants';
import { addToast } from '../toast';

export default function TimelineView({ viewStart, viewEnd, whatIfProject, onAddPhase, onEditPhase, onDragUpdate, finderMatches }) {
  const { team, projects } = useStore();
  const months = useMemo(() => getMonthRange(viewStart, viewEnd), [viewStart, viewEnd]);
  const now = getCurrentMonth();
  const today = getCurrentDate();

  const deadlines = useMemo(() => {
    const all = [...projects];
    if (whatIfProject) all.push(whatIfProject);
    return all.filter(p => p.deadline && p.deadline >= viewStart && p.deadline <= viewEnd)
      .map(p => ({ projectId: p.id, name: p.name, color: p.color, month: p.deadline, offset: monthDiff(viewStart, p.deadline) }));
  }, [projects, whatIfProject, viewStart, viewEnd]);

  const gridWidth = months.length * MONTH_WIDTH;

  return (
    <div className="timeline-view">
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

        {now >= viewStart && now <= viewEnd && (
          <div className="current-month-line" style={{ left: `calc(var(--label-width) + ${dateOffset(viewStart, today) * MONTH_WIDTH}px)` }} />
        )}

        {deadlines.map(d => (
          <div key={d.projectId} className="deadline-line" style={{ left: `calc(var(--label-width) + ${d.offset * MONTH_WIDTH + MONTH_WIDTH - 2}px)`, borderColor: d.color }}>
            <span className="deadline-label" style={{ color: d.color }}>{d.name}</span>
          </div>
        ))}

        {team.map(person => (
          <PersonRow
            key={person.id}
            person={person}
            projects={projects}
            whatIfProject={whatIfProject}
            months={months}
            viewStart={viewStart}
            gridWidth={gridWidth}
            now={now}
            onAddPhase={onAddPhase}
            onEditPhase={onEditPhase}
            onDragUpdate={onDragUpdate}
            finderMatches={finderMatches}
          />
        ))}
      </div>
    </div>
  );
}

const PersonRow = React.memo(function PersonRow({ person, projects, whatIfProject, months, viewStart, gridWidth, now, onAddPhase, onEditPhase, onDragUpdate, finderMatches }) {
  const bars = useMemo(() => getPersonPhases(person.id, projects, whatIfProject), [person.id, projects, whatIfProject]);
  const { bars: stacked, rowCount } = useMemo(() => stackBars(bars), [bars]);
  const rowHeight = Math.max(1, rowCount) * (BAR_HEIGHT + BAR_GAP) + ROW_PADDING * 2;
  const currentLoad = useMemo(() => calculateLoad(person.id, now, projects, whatIfProject), [person.id, now, projects, whatIfProject]);

  // Drag state
  const [drag, setDrag] = useState(null);

  useEffect(() => {
    if (!drag) return;
    function onMouseMove(e) {
      const deltaX = e.clientX - drag.startX;
      const deltaMonths = Math.round(deltaX / MONTH_WIDTH);
      let newStart, newEnd;
      if (drag.mode === 'left') {
        newStart = addMonths(drag.origStart, deltaMonths);
        newEnd = drag.origEnd;
        if (newStart > newEnd) newStart = newEnd;
      } else if (drag.mode === 'right') {
        newStart = drag.origStart;
        newEnd = addMonths(drag.origEnd, deltaMonths);
        if (newEnd < newStart) newEnd = newStart;
      } else {
        newStart = addMonths(drag.origStart, deltaMonths);
        newEnd = addMonths(drag.origEnd, deltaMonths);
      }
      setDrag(prev => ({ ...prev, previewStart: newStart, previewEnd: newEnd }));
    }
    function onMouseUp() {
      if (drag.previewStart !== undefined && (drag.previewStart !== drag.origStart || drag.previewEnd !== drag.origEnd)) {
        onDragUpdate(drag.projectId, drag.phaseId, { startMonth: drag.previewStart, endMonth: drag.previewEnd }, drag.isWhatIf);
      }
      setDrag(null);
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
  }, [drag, onDragUpdate]);

  function startDrag(e, bar, mode) {
    e.stopPropagation();
    e.preventDefault();
    setDrag({
      phaseId: bar.id, projectId: bar.projectId, isWhatIf: bar.isWhatIf,
      mode, startX: e.clientX, origStart: bar.startMonth, origEnd: bar.endMonth,
    });
  }

  const personFinderMonths = finderMatches?.[person.id];
  const today = getCurrentDate();

  return (
    <div className="timeline-row" style={{ minHeight: rowHeight }}>
      <div className="timeline-label-col person-label">
        <span className="person-name">{person.name}</span>
        {currentLoad > 0 && (
          <span className={`load-badge ${currentLoad > 100 ? 'over' : currentLoad > 80 ? 'warn' : 'ok'}`}>
            {currentLoad}%
          </span>
        )}
      </div>
      <div className="timeline-cells" style={{ width: gridWidth }}>
        {months.map(m => (
          <div
            key={m}
            className={`timeline-cell ${m === now ? 'current' : ''} ${personFinderMonths?.has(m) ? 'finder-match' : ''}`}
            style={{ width: MONTH_WIDTH }}
            onClick={() => {
              if (projects.length > 0) {
                const clickDate = `${m}-01`;
                onAddPhase(projects[0].id, { personIds: [person.id], startMonth: clickDate, endMonth: clickDate });
              } else {
                addToast('Add a project first to start planning phases.', 'warn');
              }
            }}
          />
        ))}
        {stacked.map(bar => {
          const isDragging = drag && drag.phaseId === bar.id;
          const barStart = isDragging && drag.previewStart ? drag.previewStart : bar.startMonth;
          const barEnd = isDragging && drag.previewEnd ? drag.previewEnd : bar.endMonth;

          const startOff = dateOffset(viewStart, barStart);
          const endOff = dateOffsetEnd(viewStart, barEnd);
          const totalMonths = months.length;

          if (endOff < 0 || startOff > totalMonths) return null;

          const clampedStart = Math.max(0, startOff);
          const clampedEnd = Math.min(totalMonths, endOff);
          const left = clampedStart * MONTH_WIDTH;
          let width = Math.max((clampedEnd - clampedStart) * MONTH_WIDTH - 2, 30);
          if (bar._nextStart && (bar._nextStart >= bar.endMonth || bar._nextProjectId === bar.projectId)) {
            const ceiling = dateOffset(viewStart, bar._nextStart) * MONTH_WIDTH - left - 2;
            if (ceiling < width) width = Math.max(0, ceiling);
          }
          const top = ROW_PADDING + bar._row * (BAR_HEIGHT + BAR_GAP);
          const intensity = getPhaseIntensity(bar);
          const phaseInfo = PHASE_TYPES[bar.type];
          const assignees = getPhasePersonIds(bar);
          const otherNames = assignees.length > 1
            ? assignees.filter(id => id !== person.id).map(id => {
                const p = (bar._team || []).find(t => t.id === id);
                return p?.name;
              }).filter(Boolean)
            : [];

          return (
            <div
              key={bar.id}
              className={`phase-bar ${bar.isWhatIf ? 'what-if' : ''} ${isDragging ? 'dragging' : ''} ${bar.isHeld ? 'held' : ''}`}
              style={{
                left, top, width, height: BAR_HEIGHT,
                background: bar.isHeld ? 'var(--text-3)' : bar.projectColor,
                opacity: bar.isHeld ? 0.35 : (0.4 + (intensity / 100) * 0.6),
              }}
              title={`${bar.projectName} — ${phaseInfo?.label || bar.type} (${intensity}%)${bar.isHeld ? ' [HELD]' : ''}${isDragging ? `\n${barStart} → ${barEnd}` : ''}`}
              onClick={(e) => { e.stopPropagation(); if (!isDragging) onEditPhase(bar.projectId, bar); }}
            >
              {/* Left drag handle */}
              <div className="drag-handle drag-handle-left" onMouseDown={e => startDrag(e, bar, 'left')} />
              <span className="bar-label" onMouseDown={e => startDrag(e, bar, 'move')} style={{ cursor: 'grab' }}>
                {bar.projectName}
                <span className="bar-phase">{phaseInfo?.short || bar.type}</span>
              </span>
              {/* Right drag handle */}
              <div className="drag-handle drag-handle-right" onMouseDown={e => startDrag(e, bar, 'right')} />
            </div>
          );
        })}
      </div>
    </div>
  );
});
