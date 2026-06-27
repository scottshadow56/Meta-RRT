import React, { useState, useEffect, useMemo } from 'react';
import { DimensionCount, Premise, TrainingStats, SolverResult, Vector, AbstractRelationMapping } from './types';
import { solveRelations, getBasisRelations, generateAbstractMapping, describeAbstractVector, translateTextToAbstract } from './utils/engine';
import Visualizer from './components/Visualizer';
import TrainingWorkspace from './components/TrainingWorkspace';
import SandboxWorkspace from './components/SandboxWorkspace';
import AnalyticsPanel from './components/AnalyticsPanel';
import ContextProjector from './components/ContextProjector';
import AbstractRelationsCodex from './components/AbstractRelationsCodex';
import { Brain, Compass, Layers, Activity, FileText, Zap, Sparkles, Trophy, Network, Sun, Moon, Shuffle } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'rrt_neural_stats_v1';

const defaultStats: TrainingStats = {
  score: 0,
  streak: 0,
  accuracy: 0,
  totalAnswered: 0,
  totalCorrect: 0,
  averageTimeMs: 0,
  history: []
};

export default function App() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'training' | 'sandbox' | 'analytics'>('training');
  const [isTrainingSubmitted, setIsTrainingSubmitted] = useState<boolean>(false);
  const [theme, setTheme] = useState<'dark' | 'light' | 'cyan'>('dark');

  useEffect(() => {
    document.body.classList.remove('dark', 'theme-cyan', 'light');
    if (theme === 'dark') {
      document.body.classList.add('dark');
    } else if (theme === 'cyan') {
      document.body.classList.add('theme-cyan');
    } else {
      document.body.classList.add('light');
    }
  }, [theme]);

  // Workout mode selection inside Training tab
  const [workoutMode, setWorkoutMode] = useState<'classic' | 'context' | 'analogy'>('classic');
  const [contextBaseVector, setContextBaseVector] = useState<number[]>([1,0,0,0]);
  const [contextProjectedVector, setContextProjectedVector] = useState<number[]>([1,0,0,0]);
  const [contextBaseRelationName, setContextBaseRelationName] = useState<string>('NORTHEAST');
  const [contextProjectedRelationName, setContextProjectedRelationName] = useState<string>('NORTHEAST');
  const [contextActiveModifiers, setContextActiveModifiers] = useState<number[]>([1,1,1,1]);
  const [contextDimension, setContextDimension] = useState<DimensionCount>(2);
  const [contextNodeDefinitions, setContextNodeDefinitions] = useState<any[]>([]);
  const [contextVehicles, setContextVehicles] = useState<any[]>([]);
  const [contextQueryNode, setContextQueryNode] = useState<string>('');
  const [contextQueryTarget, setContextQueryTarget] = useState<string>('');
  const [contextSelectedAnswerText, setContextSelectedAnswerText] = useState<string>('');
  const [contextSelectedAnswerLetter, setContextSelectedAnswerLetter] = useState<string>('');
  const [contextIsSubmitted, setContextIsSubmitted] = useState<boolean>(false);

  // Dimensional Space setting
  const [dimension, setDimension] = useState<DimensionCount>(2);

  // Abstract Relations State
  const [abstractRelationsEnabled, setAbstractRelationsEnabled] = useState<boolean>(false);
  const [abstractMapping, setAbstractMapping] = useState<AbstractRelationMapping>(() => generateAbstractMapping());

  // Relation Scrambler State
  const [scrambleComponentOrder, setScrambleComponentOrder] = useState<boolean>(false);

  // Constraints/Premises list
  const [premises, setPremises] = useState<Premise[]>([]);

  // Basis relations of the currently selected dimension
  const [basisRelations, setBasisRelations] = useState<Record<string, Vector>>({});

  // Active hover highlighting of constraint vectors inside visualizer
  const [highlightedPremiseId, setHighlightedPremiseId] = useState<string | null>(null);

  // UI state for statistics loaded from localStorage
  const [stats, setStats] = useState<TrainingStats>(defaultStats);

  // Initialize statistics from localStorage
  useEffect(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        setStats(JSON.parse(cached));
      }
    } catch (err) {
      console.warn("Could not load analytics cache", err);
    }
  }, []);

  // Sync stats updates
  const handleUpdateStats = (newStats: TrainingStats) => {
    setStats(newStats);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newStats));
    } catch (err) {
      console.warn("Could not write analytics cache", err);
    }
  };

  const handleResetStats = () => {
    if (window.confirm("Are you sure you want to flush all neural logs and reset your training metrics? This cannot be undone.")) {
      handleUpdateStats(defaultStats);
    }
  };

  // Keep basis relations mapping synchronized when the dimension counts change
  useEffect(() => {
    const defaults = getBasisRelations(dimension);
    let finalBasis = defaults;
    if (abstractRelationsEnabled) {
      finalBasis = {};
      for (const [key, vec] of Object.entries(defaults)) {
        const abstractName = describeAbstractVector(vec, abstractMapping, dimension, scrambleComponentOrder);
        finalBasis[abstractName] = vec;
      }
    }
    setBasisRelations(finalBasis);
    
    // Clear out of bounds premises when dimension is downscaled
    setPremises(prev => prev.filter(p => {
      const vec = finalBasis[p.relation];
      return vec && vec.length === dimension;
    }));
  }, [dimension, abstractRelationsEnabled, abstractMapping, scrambleComponentOrder]);

  const handleUpdateContextDetails = (details: {
    dimension: DimensionCount;
    baseVector: number[];
    projectedVector: number[];
    baseRelationName: string;
    projectedRelationName: string;
    activeModifiers: number[];
    nodeDefinitions: any[];
    contextVehicles: any[];
    queryNode?: string;
    queryTarget?: string;
    selectedAnswerText?: string;
    selectedAnswerLetter?: string;
    isSubmitted?: boolean;
  }) => {
    setContextDimension(details.dimension);
    setContextBaseVector(details.baseVector);
    setContextProjectedVector(details.projectedVector);
    setContextBaseRelationName(details.baseRelationName);
    setContextProjectedRelationName(details.projectedRelationName);
    setContextActiveModifiers(details.activeModifiers);
    setContextNodeDefinitions(details.nodeDefinitions || []);
    setContextVehicles(details.contextVehicles || []);
    setContextQueryNode(details.queryNode || '');
    setContextQueryTarget(details.queryTarget || '');
    setContextSelectedAnswerText(details.selectedAnswerText || '');
    setContextSelectedAnswerLetter(details.selectedAnswerLetter || '');
    setContextIsSubmitted(!!details.isSubmitted);
  };

  // Run Constraint Solver Dynamically
  const solverResult = useMemo(() => {
    return solveRelations(premises, basisRelations, dimension);
  }, [premises, basisRelations, dimension]);

  // Handle switching tabs
  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    // Flush sandbox coordinates when switching to sandbox vs training to keep contexts decoupled
    if (tab === 'sandbox') {
      setPremises([]);
      setDimension(2);
    }
  };

  // Questions answered today and average response time for today
  const todayStats = useMemo(() => {
    const todayStr = new Date().toLocaleDateString();
    const todayItems = stats.history.filter(h => new Date(h.timestamp).toLocaleDateString() === todayStr);
    const answeredCount = todayItems.length;
    const correctCount = todayItems.filter(h => h.correct).length;
    
    let avgSpeedSec = 0;
    if (answeredCount > 0) {
      const totalTimeMs = todayItems.reduce((acc, h) => acc + (h.timeMs || 0), 0);
      avgSpeedSec = Number((totalTimeMs / answeredCount / 1000).toFixed(1));
    }
    
    return {
      answeredCount,
      correctCount,
      avgSpeedSec,
    };
  }, [stats.history]);

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text flex flex-col antialiased selection:bg-theme-comp selection:text-theme-bg font-sans md:border-8 border-theme-comp">
      
      {/* Upper Brand Info line */}
      <header className="border-b border-theme-comp bg-theme-bg sticky top-0 z-50 px-4 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Logo & Meta */}
          <div className="flex items-center gap-4">
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl font-bold tracking-tighter col-span-1">RRT.ENGINE</h1>
              <span className="font-serif italic text-sm opacity-60 sm:inline hidden">Relational Reasoning Training</span>
            </div>
            <div className="flex items-center gap-1 border border-theme-comp bg-theme-card p-0.5 font-mono text-[9px] font-bold">
              {(['dark', 'light', 'cyan'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`px-2 py-1 select-none cursor-pointer uppercase transition-all ${
                    theme === t
                      ? 'bg-theme-comp text-theme-bg'
                      : 'hover:bg-theme-comp/10 text-theme-text/80'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => {
                const newState = !abstractRelationsEnabled;
                setAbstractRelationsEnabled(newState);
                if (newState) {
                  setAbstractMapping(generateAbstractMapping());
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 border font-mono text-[9px] font-extrabold uppercase transition-all cursor-pointer select-none rounded-none ${
                abstractRelationsEnabled
                  ? 'bg-amber-600 border-amber-600 text-white'
                  : 'border-theme-comp/40 hover:bg-theme-comp/10 text-theme-text/80 bg-theme-card'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Abstract Relations: {abstractRelationsEnabled ? "ON" : "OFF"}</span>
            </button>

            <button
              onClick={() => setScrambleComponentOrder(prev => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 border font-mono text-[9px] font-extrabold uppercase transition-all cursor-pointer select-none rounded-none ${
                scrambleComponentOrder
                  ? 'bg-purple-600 border-purple-600 text-white'
                  : 'border-theme-comp/40 hover:bg-theme-comp/10 text-theme-text/80 bg-theme-card'
              }`}
              title="Scrambles the presentation order of compound/multi-dimensional relations (e.g. East-After-Above-North vs North-East-Above-After)"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Relation Scrambler: {scrambleComponentOrder ? "ON" : "OFF"}</span>
            </button>
          </div>

          {/* Quick HUD tracker */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-sans">
            <div className="flex items-center gap-1.5 bg-theme-card border border-theme-comp px-3 py-1.5 font-bold">
              <Activity className="w-3.5 h-3.5 text-theme-comp" />
              <span>Today: <strong className="font-mono text-theme-accent">{todayStats.answeredCount}</strong> Answered <span className="opacity-40">|</span> <span className="text-theme-text/85">Speed:</span> <strong className="font-mono text-theme-accent">{todayStats.avgSpeedSec}s</strong></span>
            </div>
            <div className="flex items-center gap-1.5 bg-theme-card border border-theme-comp px-3 py-1.5 font-bold">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Streak: <strong className="font-mono text-theme-accent">{stats.streak}</strong></span>
            </div>
            <div className="bg-theme-comp text-theme-bg px-3 py-1.5 text-[11px] font-mono leading-none tracking-wider uppercase font-bold">
              ENTITY_SYNC_OK
            </div>
          </div>
        </div>
      </header>

      {/* Main Container Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 flex flex-col gap-6">
        
        {/* Sub-tabs workspace router */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-theme-comp pb-4">
          <div className="flex flex-wrap gap-2">
            <button
              id="tab-training-btn"
              onClick={() => handleTabChange('training')}
              className={`flex items-center gap-2 px-4 py-2 border border-theme-comp text-xs font-sans font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                activeTab === 'training'
                  ? 'bg-theme-comp text-theme-bg'
                  : 'bg-theme-card text-theme-text hover:bg-theme-comp/10'
              }`}
            >
              <Brain className="w-4 h-4" />
              Relational Workouts
            </button>

            <button
              id="tab-sandbox-btn"
              onClick={() => handleTabChange('sandbox')}
              className={`flex items-center gap-2 px-4 py-2 border border-theme-comp text-xs font-sans font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                activeTab === 'sandbox'
                  ? 'bg-theme-comp text-theme-bg'
                  : 'bg-theme-card text-theme-text hover:bg-theme-comp/10'
              }`}
            >
              <Layers className="w-4 h-4" />
              Engine Sandbox
            </button>

            <button
              id="tab-analytics-btn"
              onClick={() => handleTabChange('analytics')}
              className={`flex items-center gap-2 px-4 py-2 border border-theme-comp text-xs font-sans font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-theme-comp text-theme-bg'
                  : 'bg-theme-card text-theme-text hover:bg-theme-comp/10'
              }`}
            >
              <Activity className="w-4 h-4" />
              Neuro-Metrics
            </button>
          </div>

          <div className="text-[11px] text-theme-text font-mono flex items-center gap-2 border border-theme-comp px-3 py-1.5 bg-theme-card">
            <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse"></span>
            <span>Current Canvas: <strong>{activeTab === 'training' && (workoutMode === 'context' || workoutMode === 'analogy') ? contextDimension : dimension}D Coordinate Matrix (I)</strong></span>
          </div>
        </div>

        {/* Dynamic Matrix Visualizer Split (Only shown for training/sandbox to represent spatial vectors) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Action workspace left column */}
          <div className={`${activeTab === 'analytics' ? 'lg:col-span-12' : 'lg:col-span-7'} flex flex-col gap-6`}>
            {activeTab === 'training' && (
              <TrainingWorkspace
                stats={stats}
                onUpdateStats={handleUpdateStats}
                basisRelations2D={getBasisRelations(2)}
                basisRelations3D={getBasisRelations(3)}
                basisRelations4D={getBasisRelations(4)}
                setDimension={setDimension}
                setSelectedPremises={setPremises}
                setHighlightedPremiseId={setHighlightedPremiseId}
                workoutMode={workoutMode}
                setWorkoutMode={setWorkoutMode}
                onUpdateContextDetails={handleUpdateContextDetails}
                isSubmitted={isTrainingSubmitted}
                setIsSubmitted={setIsTrainingSubmitted}
                abstractRelationsEnabled={abstractRelationsEnabled}
                abstractMapping={abstractMapping}
                onRegenerateAbstractMapping={setAbstractMapping}
                scrambleComponentOrder={scrambleComponentOrder}
              />
            )}

            {activeTab === 'sandbox' && (
              <SandboxWorkspace
                dimension={dimension}
                setDimension={setDimension}
                premises={premises}
                setPremises={setPremises}
                basisRelations={basisRelations}
                onUpdateBasis={setBasisRelations}
                solverResult={solverResult}
                setHighlightedPremiseId={setHighlightedPremiseId}
                abstractRelationsEnabled={abstractRelationsEnabled}
                abstractMapping={abstractMapping}
                onRegenerateAbstractMapping={setAbstractMapping}
                scrambleComponentOrder={scrambleComponentOrder}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsPanel
                stats={stats}
                onResetStats={handleResetStats}
              />
            )}
          </div>

          {/* Interactive visualizer right column */}
          {(activeTab === 'training' || activeTab === 'sandbox') && (
            <div className="lg:col-span-5 flex flex-col h-full self-stretch min-h-[400px]">
              {abstractRelationsEnabled && (
                <AbstractRelationsCodex
                  dimension={activeTab === 'training' && (workoutMode === 'context' || workoutMode === 'analogy') ? contextDimension : dimension}
                  mapping={abstractMapping}
                  onRegenerate={() => setAbstractMapping(generateAbstractMapping())}
                />
              )}
              {activeTab === 'training' && !isTrainingSubmitted ? (
                <div className="flex flex-col flex-1 border border-dashed border-theme-comp bg-theme-bg/60 p-6 items-center justify-center text-center select-none min-h-[400px] h-full shadow-inner">
                  <Compass className="w-12 h-12 text-theme-comp/30 shrink-0 mb-3 animate-pulse" />
                  <span className="font-mono text-xs text-theme-text/60 uppercase font-bold tracking-wider">Spatial Map Locked</span>
                  <p className="text-[11px] text-theme-text/80 font-sans max-w-[240px] leading-relaxed mt-2">
                    Submit your answer to this relational deduction query to materialize the spatial network maps.
                  </p>
                </div>
              ) : activeTab === 'training' && (workoutMode === 'context' || workoutMode === 'analogy') ? (
                <ContextProjector
                  dimension={contextDimension}
                  baseVector={contextBaseVector}
                  projectedVector={contextProjectedVector}
                  baseRelationName={contextBaseRelationName}
                  projectedRelationName={contextProjectedRelationName}
                  activeModifiers={contextActiveModifiers}
                  nodeDefinitions={contextNodeDefinitions}
                  contextVehicles={contextVehicles}
                  queryNode={contextQueryNode}
                  queryTarget={contextQueryTarget}
                  selectedAnswerText={contextSelectedAnswerText}
                  selectedAnswerLetter={contextSelectedAnswerLetter}
                  isSubmitted={contextIsSubmitted}
                />
              ) : (
                <Visualizer
                  entities={solverResult.entities}
                  premises={premises}
                  dimension={activeTab === 'training' ? dimension : dimension}
                  basisRelations={basisRelations}
                  highlightedPremiseId={highlightedPremiseId}
                />
              )}
            </div>
          )}

        </div>

      </main>

      {/* Page bottom styling margin footer */}
      <footer className="border-t border-theme-comp bg-theme-comp py-5 text-center text-[10px] text-theme-bg font-mono mt-auto relative z-10 uppercase tracking-wider">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <span>RRT Neural Framework • Active Engine Module V1.0 (Relative Vectors)</span>
          <span className="flex items-center gap-1.5">
            <Network className="w-3.5 h-3.5" />
            Designed to track cognitive daily progression with absolute dimensional coordinate mapping.
          </span>
        </div>
      </footer>

    </div>
  );
}

// Simple BookOpen helper since we need manual manual icons
function BookOpen(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
