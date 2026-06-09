import React, { useState, useEffect, useCallback } from 'react';
import { useStore, useDispatch, useHistory } from './store';
import Sidebar from './components/Sidebar';
import OverviewView from './components/OverviewView';
import StandupView from './components/StandupView';
import PeopleCostView from './components/PeopleCostView';
import PlanningView from './components/PlanningView';
import TimelineView from './components/TimelineView';
import TimesheetView from './components/TimesheetView';
import AuthoriseView from './components/AuthoriseView';
import RnDView from './components/RnDView';
import HeatmapView from './components/HeatmapView';
import ProjectView from './components/ProjectView';
import PhaseModal from './components/PhaseModal';
import WhatIfBar from './components/WhatIfBar';
import ExportImport from './components/ExportImport';
import AvailabilityFinder from './components/AvailabilityFinder';
import DocumentBar from './components/DocumentBar';
import DocMeta from './components/DocMeta';
import ConflictBanner from './components/ConflictBanner';
import Toasts from './components/Toasts';
import ConfirmHost from './components/ConfirmHost';
import { getCurrentDate, addDays } from './utils';
import { addToast } from './toast';
import * as docManager from './docManager';
import { getAccountName, signOut } from './auth/authConfig';

// Snap a date back to the Monday of its week.
function mondayOf(date) {
  let d = date;
  while (new Date(d + 'T12:00:00').getDay() !== 1) d = addDays(d, -1);
  return d;
}

// The tab lives in the URL hash (e.g. #overview) so a refresh, deploy or SSO
// redirect keeps you on the same view, and views can be bookmarked/shared.
const VIEWS = ['overview', 'planning', 'timeline', 'heatmap', 'project', 'standup', 'people', 'timesheet', 'authorise', 'rnd'];
function viewFromHash() {
  const h = window.location.hash.replace(/^#/, '');
  return VIEWS.includes(h) ? h : 'overview';
}

// The tabs, clustered so the nav reads as groups rather than a flat run of ten.
const NAV_GROUPS = [
  { label: 'Insight', tabs: [['overview', 'Overview'], ['standup', 'Standup'], ['people', 'People & Cost']] },
  { label: 'Plan', tabs: [['planning', 'Planning'], ['timeline', 'Timeline'], ['heatmap', 'Heatmap'], ['project', 'Project']] },
  { label: 'R&D', tabs: [['timesheet', 'Timesheet'], ['authorise', 'Authorise'], ['rnd', 'R&D']] },
];

export default function App() {
  const store = useStore();
  const dispatch = useDispatch();
  const { canUndo, canRedo } = useHistory();
  const blendedRate = store.settings?.blendedRate ?? 110;
  const [view, setView] = useState(viewFromHash);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [phaseModal, setPhaseModal] = useState(null);
  const [whatIfProject, setWhatIfProject] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [finderOpen, setFinderOpen] = useState(false);
  const [finderMatches, setFinderMatches] = useState(null);
  const [activeDocId, setActiveDocId] = useState(() => docManager.getActiveDocId());
  const [theme, setTheme] = useState(() => localStorage.getItem('headroom-theme') || 'dark');

  // Apply the theme to <html> and remember the choice.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('headroom-theme', theme); } catch { /* ignore */ }
  }, [theme]);

  // Keep the URL hash in step with the active tab (skip the default so a fresh
  // load stays at a clean URL until the user navigates).
  useEffect(() => {
    if (viewFromHash() !== view) window.location.hash = view;
  }, [view]);

  // Follow browser back/forward (and any external hash change) back into state.
  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const [viewStart, setViewStart] = useState(() => mondayOf(getCurrentDate()));
  const viewEnd = addDays(viewStart, 27); // four working weeks

  function scrollTimeline(dir) {
    setViewStart(prev => mondayOf(addDays(prev, dir * 7)));
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
      // Ctrl+S / Cmd+S = confirm save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        addToast('Saved', 'success');
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
        <DocMeta />

        <div className="header-right">
          {/* Blended rate — drives cost & ROI across Overview / Standup / People */}
          <div className="rate-control" title="Blended hourly rate used for cost & ROI">
            <label htmlFor="blended-rate">Rate £/h</label>
            <input
              id="blended-rate"
              type="number"
              min="1"
              max="999"
              value={blendedRate}
              onChange={e => {
                const raw = e.target.value;
                if (raw === '') return; // ignore transient empty — rate must stay ≥ 1
                const v = Math.round(Number(raw));
                if (Number.isNaN(v)) return;
                dispatch({ type: 'SET_BLENDED_RATE', payload: Math.max(1, Math.min(999, v)) });
              }}
              className="rate-input"
            />
          </div>

          <div className="header-divider" />

          {/* Light / dark theme toggle */}
          <button
            className="icon-btn"
            onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>

          <div className="header-divider" />

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
            <button className="text-btn" onClick={() => setViewStart(mondayOf(getCurrentDate()))} title="Jump to this week">This week</button>
            <button className="icon-btn" onClick={() => scrollTimeline(1)} title="Later">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          <ExportImport />

          {getAccountName() && (
            <>
              <div className="header-divider" />
              <div className="account-control">
                <span className="account-name" title={getAccountName() || ''}>{getAccountName()}</span>
                <button className="icon-btn" onClick={signOut} title="Sign out">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <nav className="view-nav">
        {NAV_GROUPS.map(g => (
          <div className="nav-group" key={g.label}>
            <span className="nav-group-label">{g.label}</span>
            {g.tabs.map(([key, label]) => (
              <button key={key} className={`tab ${view === key ? 'active' : ''}`} onClick={() => setView(key)}>{label}</button>
            ))}
          </div>
        ))}
      </nav>

      <ConflictBanner />

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
          {view === 'overview' && <OverviewView />}
          {view === 'standup' && <StandupView />}
          {view === 'people' && <PeopleCostView />}
          {view === 'timesheet' && <TimesheetView />}
          {view === 'authorise' && <AuthoriseView />}
          {view === 'rnd' && <RnDView />}
          {view === 'planning' && (
            <PlanningView
              viewStart={viewStart}
              viewEnd={viewEnd}
              whatIfProject={whatIfProject}
              finderMatches={finderMatches}
            />
          )}
          {view === 'timeline' && <TimelineView whatIfProject={whatIfProject} />}
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
      <ConfirmHost />

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
