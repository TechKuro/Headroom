import React, { useState, useEffect, useCallback } from 'react';
import { useStore, useDispatch, useHistory } from './store';
import Sidebar from './components/Sidebar';
import TimelineView from './components/TimelineView';
import HeatmapView from './components/HeatmapView';
import ProjectView from './components/ProjectView';
import PhaseModal from './components/PhaseModal';
import WhatIfBar from './components/WhatIfBar';
import ExportImport from './components/ExportImport';
import AvailabilityFinder from './components/AvailabilityFinder';
import DocumentBar from './components/DocumentBar';
import Toasts from './components/Toasts';
import { getCurrentMonth, addMonths } from './utils';
import * as docManager from './docManager';

export default function App() {
  const store = useStore();
  const dispatch = useDispatch();
  const { canUndo, canRedo } = useHistory();
  const [view, setView] = useState('timeline');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [phaseModal, setPhaseModal] = useState(null);
  const [whatIfProject, setWhatIfProject] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [finderOpen, setFinderOpen] = useState(false);
  const [finderMatches, setFinderMatches] = useState(null);
  const [activeDocId, setActiveDocId] = useState(() => docManager.getActiveDocId());

  const now = getCurrentMonth();
  const [viewStart, setViewStart] = useState(addMonths(now, -2));
  const viewEnd = addMonths(viewStart, 17);

  function scrollTimeline(dir) {
    setViewStart(prev => addMonths(prev, dir * 3));
  }

  // Drag-update callback for phase bars (works for both normal and what-if)
  const handleDragUpdate = useCallback((projectId, phaseId, updates, isWhatIf) => {
    if (isWhatIf) {
      setWhatIfProject(prev => ({
        ...prev,
        phases: prev.phases.map(ph => ph.id === phaseId ? { ...ph, ...updates } : ph),
      }));
    } else {
      dispatch({ type: 'UPDATE_PHASE', payload: { projectId, phase: { id: phaseId, ...updates } } });
    }
  }, [dispatch]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e) {
      // Ctrl+Z / Cmd+Z = undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
      }
      // Ctrl+Y / Cmd+Shift+Z = redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        dispatch({ type: 'REDO' });
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [dispatch]);

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
        </div>

        <DocumentBar activeDocId={activeDocId} setActiveDocId={setActiveDocId} />

        <nav className="view-tabs">
          <button className={`tab ${view === 'timeline' ? 'active' : ''}`} onClick={() => setView('timeline')}>Timeline</button>
          <button className={`tab ${view === 'heatmap' ? 'active' : ''}`} onClick={() => setView('heatmap')}>Heatmap</button>
          <button className={`tab ${view === 'project' ? 'active' : ''}`} onClick={() => setView('project')}>Project</button>
        </nav>

        <div className="header-right">
          {/* Undo / Redo */}
          <div className="undo-redo">
            <button className="icon-btn" onClick={() => dispatch({ type: 'UNDO' })} disabled={!canUndo} title="Undo (Ctrl+Z)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            </button>
            <button className="icon-btn" onClick={() => dispatch({ type: 'REDO' })} disabled={!canRedo} title="Redo (Ctrl+Y)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/></svg>
            </button>
          </div>

          <div className="header-divider" />

          {/* Availability Finder toggle */}
          <button
            className={`icon-btn ${finderOpen ? 'active-tool' : ''}`}
            onClick={() => { setFinderOpen(f => !f); if (finderOpen) setFinderMatches(null); }}
            title="Availability Finder"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>

          <div className="header-divider" />

          {/* Timeline nav */}
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

      {finderOpen && (
        <AvailabilityFinder
          viewStart={viewStart}
          viewEnd={viewEnd}
          whatIfProject={whatIfProject}
          onResult={setFinderMatches}
          onClose={() => { setFinderOpen(false); setFinderMatches(null); }}
        />
      )}

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
              onDragUpdate={handleDragUpdate}
              finderMatches={finderMatches}
            />
          )}
          {view === 'heatmap' && (
            <HeatmapView
              viewStart={viewStart}
              viewEnd={viewEnd}
              whatIfProject={whatIfProject}
              finderMatches={finderMatches}
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
              onDragUpdate={handleDragUpdate}
            />
          )}
        </main>
      </div>

      <Toasts />

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
