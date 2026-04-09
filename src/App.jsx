import React, { useState } from 'react';
import { useStore } from './store';
import Sidebar from './components/Sidebar';
import TimelineView from './components/TimelineView';
import HeatmapView from './components/HeatmapView';
import ProjectView from './components/ProjectView';
import PhaseModal from './components/PhaseModal';
import WhatIfBar from './components/WhatIfBar';
import ExportImport from './components/ExportImport';
import { getCurrentMonth, addMonths } from './utils';

export default function App() {
  const store = useStore();
  const [view, setView] = useState('timeline');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [phaseModal, setPhaseModal] = useState(null); // { projectId, phase?, presets? }
  const [whatIfProject, setWhatIfProject] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const now = getCurrentMonth();
  const [viewStart, setViewStart] = useState(addMonths(now, -2));
  const viewEnd = addMonths(viewStart, 17);

  function scrollTimeline(dir) {
    setViewStart(prev => addMonths(prev, dir * 3));
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <button className="icon-btn sidebar-toggle" onClick={() => setSidebarOpen(s => !s)} title="Toggle sidebar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <h1 className="app-title">Headroom</h1>
          <span className="app-subtitle">Capacity Planner</span>
        </div>

        <nav className="view-tabs">
          <button className={`tab ${view === 'timeline' ? 'active' : ''}`} onClick={() => setView('timeline')}>Timeline</button>
          <button className={`tab ${view === 'heatmap' ? 'active' : ''}`} onClick={() => setView('heatmap')}>Heatmap</button>
          <button className={`tab ${view === 'project' ? 'active' : ''}`} onClick={() => setView('project')}>Project</button>
        </nav>

        <div className="header-right">
          <div className="timeline-nav">
            <button className="icon-btn" onClick={() => scrollTimeline(-1)} title="Earlier">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button className="text-btn" onClick={() => setViewStart(addMonths(now, -2))} title="Jump to today">Today</button>
            <button className="icon-btn" onClick={() => scrollTimeline(1)} title="Later">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          <ExportImport />
        </div>
      </header>

      {whatIfProject && <WhatIfBar whatIfProject={whatIfProject} setWhatIfProject={setWhatIfProject} />}

      <div className="app-body">
        {sidebarOpen && (
          <Sidebar
            selectedProjectId={selectedProjectId}
            setSelectedProjectId={setSelectedProjectId}
            setView={setView}
            onAddPhase={(projectId, presets) => setPhaseModal({ projectId, phase: null, presets })}
            onEditPhase={(projectId, phase) => setPhaseModal({ projectId, phase })}
            whatIfProject={whatIfProject}
            setWhatIfProject={setWhatIfProject}
          />
        )}

        <main className="main-content">
          {view === 'timeline' && (
            <TimelineView
              viewStart={viewStart}
              viewEnd={viewEnd}
              whatIfProject={whatIfProject}
              onAddPhase={(projectId, presets) => setPhaseModal({ projectId, phase: null, presets })}
              onEditPhase={(projectId, phase) => setPhaseModal({ projectId, phase })}
            />
          )}
          {view === 'heatmap' && (
            <HeatmapView
              viewStart={viewStart}
              viewEnd={viewEnd}
              whatIfProject={whatIfProject}
            />
          )}
          {view === 'project' && (
            <ProjectView
              viewStart={viewStart}
              viewEnd={viewEnd}
              selectedProjectId={selectedProjectId}
              setSelectedProjectId={setSelectedProjectId}
              whatIfProject={whatIfProject}
              onAddPhase={(projectId, presets) => setPhaseModal({ projectId, phase: null, presets })}
              onEditPhase={(projectId, phase) => setPhaseModal({ projectId, phase })}
            />
          )}
        </main>
      </div>

      {phaseModal && (
        <PhaseModal
          projectId={phaseModal.projectId}
          phase={phaseModal.phase}
          presets={phaseModal.presets}
          whatIfProject={whatIfProject}
          setWhatIfProject={setWhatIfProject}
          onClose={() => setPhaseModal(null)}
        />
      )}
    </div>
  );
}
