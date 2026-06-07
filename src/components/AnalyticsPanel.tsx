import React, { useMemo } from 'react';
import { TrainingStats } from '../types';
import { Trophy, TrendingUp, Compass, HeartPulse, Activity, Zap, History, Milestone, BarChart3, Clock } from 'lucide-react';

interface AnalyticsPanelProps {
  stats: TrainingStats;
  onResetStats: () => void;
}

export default function AnalyticsPanel({ stats, onResetStats }: AnalyticsPanelProps) {
  
  // Aggregate history entries by day
  const dailyHistory = useMemo(() => {
    const dailyMap: Record<string, { dateStr: string; timestamp: number; answered: number; correct: number; totalTimeMs: number }> = {};
    
    // Sort chronological first
    const sortedHistory = [...stats.history].sort((a, b) => a.timestamp - b.timestamp);
    
    sortedHistory.forEach(h => {
      const key = new Date(h.timestamp).toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric' 
      });
      if (!dailyMap[key]) {
        dailyMap[key] = {
          dateStr: key,
          timestamp: h.timestamp,
          answered: 0,
          correct: 0,
          totalTimeMs: 0
        };
      }
      dailyMap[key].answered++;
      if (h.correct) {
        dailyMap[key].correct++;
      }
      dailyMap[key].totalTimeMs += h.timeMs;
    });

    return Object.values(dailyMap).sort((a, b) => a.timestamp - b.timestamp);
  }, [stats.history]);

  // Overall statistics and speeds
  const overallAvgSpeedSec = useMemo(() => {
    if (stats.history.length === 0) return 0;
    const totalTimeMs = stats.history.reduce((sum, h) => sum + h.timeMs, 0);
    return Number((totalTimeMs / stats.history.length / 1000).toFixed(1));
  }, [stats.history]);

  const overallAccuracy = useMemo(() => {
    if (stats.totalAnswered === 0) return 0;
    return Math.round((stats.totalCorrect / stats.totalAnswered) * 100);
  }, [stats.totalAnswered, stats.totalCorrect]);

  // Dimensions accuracy breakdown
  const dimStats = useMemo(() => {
    const counts: Record<number, { total: number; correct: number }> = {
      2: { total: 0, correct: 0 },
      3: { total: 0, correct: 0 },
      4: { total: 0, correct: 0 }
    };

    stats.history.forEach(h => {
      const dim = h.dimension;
      if (counts[dim]) {
        counts[dim].total++;
        if (h.correct) counts[dim].correct++;
      }
    });

    return counts;
  }, [stats.history]);

  // SVG Dimension defaults
  const svgWidth = 500;
  const svgHeight = 180;

  // Chart data: Daily Volume (Bar Chart)
  const barChartData = useMemo(() => {
    if (dailyHistory.length === 0) return [];
    
    const recentDays = dailyHistory.slice(-7);
    const maxAnswered = Math.max(...recentDays.map(d => d.answered), 5); // limit scale to at least 5
    
    const margin = { top: 22, right: 20, bottom: 25, left: 35 };
    const chartW = svgWidth - margin.left - margin.right;
    const chartH = svgHeight - margin.top - margin.bottom;
    const step = chartW / recentDays.length;
    
    return recentDays.map((d, idx) => {
      const x = margin.left + idx * step + step * 0.15;
      const barWidth = step * 0.7;
      
      const heightVal = (d.answered / maxAnswered) * chartH;
      const correctHeightVal = (d.correct / maxAnswered) * chartH;
      
      const y = margin.top + chartH - heightVal;
      const correctY = margin.top + chartH - correctHeightVal;
      
      return {
        x,
        y,
        correctY,
        barWidth,
        heightVal,
        correctHeightVal,
        dateStr: d.dateStr,
        answered: d.answered,
        correct: d.correct
      };
    });
  }, [dailyHistory]);

  // Chart data: Daily Speed Latency Trend (Line Chart)
  const latencyChartData = useMemo(() => {
    if (dailyHistory.length === 0) return [];
    
    const recentDays = dailyHistory.slice(-7);
    const dailySpeedsSec = recentDays.map(d => d.totalTimeMs / d.answered / 1000);
    
    const maxSpeedSec = Math.max(...dailySpeedsSec, 15); // baseline maximum scale limit of 15 seconds
    const minSpeedSec = 0;
    
    const margin = { top: 22, right: 20, bottom: 25, left: 35 };
    const chartW = svgWidth - margin.left - margin.right;
    const chartH = svgHeight - margin.top - margin.bottom;
    
    return recentDays.map((d, idx) => {
      // Avoid division by 0 if single item
      const x = margin.left + (recentDays.length > 1 ? (idx / (recentDays.length - 1)) * chartW : chartW / 2);
      const speed = d.totalTimeMs / d.answered / 1000;
      
      const normalizedY = (speed - minSpeedSec) / (maxSpeedSec - minSpeedSec);
      const y = margin.top + chartH - (normalizedY * chartH);
      
      return {
        x,
        y,
        speed: Number(speed.toFixed(1)),
        dateStr: d.dateStr
      };
    });
  }, [dailyHistory]);

  const maxLatencyVal = useMemo(() => {
    if (dailyHistory.length === 0) return 15;
    const recentDays = dailyHistory.slice(-7);
    const dailySpeedsSec = recentDays.map(d => d.totalTimeMs / d.answered / 1000);
    return Math.max(...dailySpeedsSec, 15);
  }, [dailyHistory]);

  // Sum of all training time spent
  const dailyTimeSpentText = useMemo(() => {
    const totalDurationMs = stats.history.reduce((acc, curr) => acc + (curr.timeMs || 0), 0);
    const totalMinutes = Math.floor(totalDurationMs / 60000);
    const totalSeconds = Math.floor((totalDurationMs % 60000) / 1000);
    if (totalMinutes === 0 && totalSeconds === 0) return '0s';
    return totalMinutes > 0 ? `${totalMinutes}m ${totalSeconds}s` : `${totalSeconds}s`;
  }, [stats.history]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="analytics-panel-root">
      
      {/* Visual Analytics main column */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        
        {/* Track Questions Answered Daily */}
        <div className="bg-theme-card border border-theme-comp p-5 shadow-sm rounded-none flex flex-col">
          <div className="flex flex-wrap justify-between items-center gap-1.5 mb-3 border-b border-theme-comp/20 pb-2 pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-theme-comp" />
              <h3 className="font-mono font-bold text-theme-text text-xs uppercase tracking-wider">
                Daily Problem Solving Volume Tracker
              </h3>
            </div>
            <span className="font-mono text-[9px] text-theme-text border border-theme-comp px-2 py-0.5 bg-theme-bg font-bold uppercase">
              Daily aggregates
            </span>
          </div>

          <div className="flex-1 min-h-[200px] flex items-center justify-center border p-3 relative rounded-none" style={{ color: 'var(--text-color)', backgroundColor: 'var(--main-color-accent)', borderColor: 'var(--main-color-complementary)' }}>
            {stats.history.length === 0 ? (
              <div className="text-center text-theme-text/60 max-w-xs text-xs font-mono p-6 leading-relaxed flex flex-col items-center gap-2">
                <Milestone className="w-6 h-6 text-theme-comp" />
                <p>Metrics graph locked. Perfect at least one multidimensional spatial reasoning problem to record daily tracking metrics.</p>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col p-2">
                <svg
                  width="100%"
                  height="100%"
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-full min-h-[160px]"
                >
                  {/* Grid Lines */}
                  {(() => {
                    const recentDays = dailyHistory.slice(-7);
                    const maxAns = Math.max(...recentDays.map(d => d.answered), 5);
                    const gridTicks = [0, Math.ceil(maxAns / 2), maxAns];
                    
                    return gridTicks.map((yVal, gridIdx) => {
                      const normY = yVal / maxAns;
                      const yPos = 22 + (133 - (normY * 133));
                      return (
                        <g key={gridIdx}>
                          <line
                            x1="35"
                            y1={yPos}
                            x2="480"
                            y2={yPos}
                            stroke="var(--main-color-complementary)"
                            strokeOpacity={0.12}
                            strokeWidth="1.2"
                            strokeDasharray="3 3"
                          />
                          <text
                            x="28"
                            y={yPos + 3.5}
                            fill="var(--text-color)"
                            fillOpacity={0.7}
                            fontSize="9"
                            textAnchor="end"
                            className="font-mono font-bold text-[9px]"
                          >
                            {yVal}
                          </text>
                        </g>
                      );
                    });
                  })()}

                  {/* Draw Bars */}
                  {barChartData.map((bar, barIdx) => (
                    <g key={barIdx} className="group">
                      {/* Grey Background Track */}
                      <rect
                        x={bar.x}
                        y={22}
                        width={bar.barWidth}
                        height={133}
                        fill="var(--main-color-complementary)"
                        fillOpacity={0.03}
                      />
                      {/* Total Attempted Bar */}
                      <rect
                        x={bar.x}
                        y={bar.y}
                        width={bar.barWidth}
                        height={bar.heightVal || 1}
                        fill="var(--main-color-complementary)"
                        fillOpacity={0.18}
                        stroke="var(--main-color-complementary)"
                        strokeWidth="1"
                        strokeOpacity="0.4"
                      />
                      {/* Correct / Solved Bar */}
                      <rect
                        x={bar.x + 2}
                        y={bar.correctY}
                        width={Math.max(2, bar.barWidth - 4)}
                        height={bar.correctHeightVal}
                        fill="var(--main-color-accent)"
                        stroke="var(--main-color-complementary)"
                        strokeWidth="1.2"
                        className="transition-all duration-150"
                      />
                      
                      {/* Numerical Indicators on hovers/render */}
                      <text
                        x={bar.x + bar.barWidth / 2}
                        y={Math.min(bar.correctY - 6, 140)}
                        fill="var(--text-color)"
                        fontSize="9"
                        fontWeight="bold"
                        textAnchor="middle"
                        className="font-mono text-[9px]"
                      >
                        {bar.correct}/{bar.answered}
                      </text>

                      {/* X-axis labels */}
                      <text
                        x={bar.x + bar.barWidth / 2}
                        y="172"
                        fill="var(--text-color)"
                        fillOpacity="0.6"
                        fontSize="8.5"
                        textAnchor="middle"
                        className="font-mono font-bold uppercase tracking-tight"
                      >
                        {bar.dateStr}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            )}
          </div>
          <div className="flex gap-4 mt-2 justify-end text-[10px] font-mono px-1 border-t border-theme-comp/10 pt-2">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 inline-block border bg-transparent" style={{ borderColor: 'var(--main-color-complementary)' }}></span> Total Attempts</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 inline-block" style={{ backgroundColor: 'var(--text-color-accent)' }}></span> Successful Inferences</span>
          </div>
        </div>

        {/* Track Solving Speed Latency progressions */}
        <div className="bg-theme-card border border-theme-comp p-5 shadow-sm rounded-none flex flex-col">
          <div className="flex flex-wrap justify-between items-center gap-1.5 mb-3 border-b border-theme-comp/20 pb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-theme-comp" />
              <h3 className="font-mono font-bold text-theme-text text-xs uppercase tracking-wider">
                Daily Analytical Speed & Latency Trend
              </h3>
            </div>
            <span className="font-mono text-[9px] text-theme-text border border-theme-comp px-2 py-0.5 bg-theme-bg font-bold uppercase text-red-500">
              Lower Time is Faster (Seconds)
            </span>
          </div>

          <div className="flex-1 min-h-[200px] flex items-center justify-center border p-3 relative rounded-none" style={{ color: 'var(--text-color)', backgroundColor: 'var(--main-color-accent)', borderColor: 'var(--main-color-complementary)' }}>
            {stats.history.length === 0 ? (
              <div className="text-center text-theme-text/60 max-w-xs text-xs font-mono p-6 leading-relaxed flex flex-col items-center gap-2">
                <Clock className="w-6 h-6 text-theme-comp" />
                <p>Latency trend chart locked. Solve spatial reasoning puzzles to visualize cognitive speed feedback.</p>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col p-2">
                <svg
                  width="100%"
                  height="100%"
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-full min-h-[160px]"
                >
                  {/* Grid Lines */}
                  {(() => {
                    const gridTicks = [0, maxLatencyVal / 2, maxLatencyVal];
                    
                    return gridTicks.map((yVal, gridIdx) => {
                      const normY = yVal / maxLatencyVal;
                      const yPos = 22 + (133 - (normY * 133));
                      return (
                        <g key={gridIdx}>
                          <line
                            x1="35"
                            y1={yPos}
                            x2="480"
                            y2={yPos}
                            stroke="var(--main-color-complementary)"
                            strokeOpacity={0.12}
                            strokeWidth="1.2"
                            strokeDasharray="3 3"
                          />
                          <text
                            x="28"
                            y={yPos + 3.5}
                            fill="var(--text-color)"
                            fillOpacity="0.7"
                            fontSize="9"
                            textAnchor="end"
                            className="font-mono font-bold text-[9px]"
                          >
                            {yVal.toFixed(1)}s
                          </text>
                        </g>
                      );
                    });
                  })()}

                  {/* Latency Plot Line */}
                  {latencyChartData.length > 1 && (
                    <>
                      {/* Connection Line */}
                      <path
                        d={latencyChartData.reduce((acc, curr, idx) => {
                          return acc + `${idx === 0 ? 'M' : 'L'} ${curr.x} ${curr.y} `;
                        }, '')}
                        fill="none"
                        stroke="var(--main-color-complementary)"
                        strokeWidth="2.5"
                        strokeLinecap="square"
                        strokeLinejoin="miter"
                      />

                      {/* Area Fill */}
                      <path
                        d={
                          latencyChartData.reduce((acc, curr, idx) => {
                             return acc + `${idx === 0 ? 'M' : 'L'} ${curr.x} ${curr.y} `;
                          }, '') + 
                          `L ${latencyChartData[latencyChartData.length - 1].x} ${155} ` +
                          `L ${latencyChartData[0].x} ${155} Z`
                        }
                        fill="var(--main-color-complementary)"
                        opacity="0.04"
                      />
                    </>
                  )}

                  {/* Verticals and Dots */}
                  {latencyChartData.map((pt, idx) => (
                    <g key={idx}>
                      <line
                        x1={pt.x}
                        y1={22}
                        x2={pt.x}
                        y2={155}
                        stroke="var(--main-color-complementary)"
                        strokeOpacity={0.06}
                        strokeWidth="1"
                      />
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="4"
                        fill="var(--main-color-accent)"
                        stroke="var(--main-color-complementary)"
                        strokeWidth="2"
                        className="transition-transform duration-100 hover:scale-150 cursor-crosshair"
                      />
                      <text
                        x={pt.x}
                        y={Math.max(20, pt.y - 8)}
                        fill="var(--text-color)"
                        fontSize="9"
                        fontWeight="bold"
                        textAnchor="middle"
                        className="font-mono text-[9px]"
                      >
                        {pt.speed}s
                      </text>
                      {/* X-axis labels */}
                      <text
                        x={pt.x}
                        y="172"
                        fill="var(--text-color)"
                        fillOpacity="0.6"
                        fontSize="8.5"
                        textAnchor="middle"
                        className="font-mono font-bold uppercase tracking-tight"
                      >
                        {pt.dateStr}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Stats metrics panel right sidebar info */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        
        {/* Core Latency score block */}
        <div className="bg-theme-card border-2 border-theme-comp p-5 shadow-none flex flex-col items-center justify-center text-center relative overflow-hidden rounded-none text-theme-text transition-colors">
          <div className="absolute top-0 right-0 w-32 h-32 bg-theme-comp/5 rotate-45 pointer-events-none"></div>
          
          <Clock className="w-8 h-8 text-theme-comp mb-2" />
          <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-theme-accent">Overall Latency Index</span>
          
          <div className="text-4xl font-mono font-black mt-1 mb-1 tracking-tighter border-b-2 border-dashed border-theme-comp pb-0.5">
            {overallAvgSpeedSec}s
          </div>

          <div className="text-[10px] font-mono leading-normal max-w-[210px] bg-theme-bg p-2 mt-2 border border-theme-comp uppercase text-theme-text">
            {stats.history.length === 0 
              ? "Baseline response metric uninitialized. Attempt vector equations to map coordinates."
              : overallAvgSpeedSec < 12 
              ? "FRICITIONLESS PROCESSING BAND: Outstanding coordination latency. Projections constructed at instantaneous speed!"
              : overallAvgSpeedSec < 24 
              ? "OPTIMIZED INTELLECTUAL BAND: Dynamic memory buffers operate with minimal mapping collisions."
              : "STABLE ALIGNMENT BAND: Steady dimensional deduction rates. Accelerate logical steps to optimize latency response."
            }
          </div>
        </div>

        {/* Numerical KPIs grid */}
        <div className="bg-theme-card/40 border border-theme-comp p-4 shadow-sm grid grid-cols-2 gap-3.5 rounded-none text-theme-text">
          <div className="bg-theme-card p-3.5 border border-theme-comp flex flex-col gap-1 rounded-none font-mono">
            <span className="text-[8px] text-theme-text/65 font-bold tracking-wide uppercase">Deduction Accuracy</span>
            <span className="text-xl font-black text-theme-text">{overallAccuracy}%</span>
            <span className="text-[9px] font-sans text-theme-text/80">({stats.totalCorrect}/{stats.totalAnswered} solved)</span>
          </div>

          <div className="bg-theme-card p-3.5 border border-theme-comp flex flex-col gap-1 rounded-none font-mono">
            <span className="text-[8px] text-theme-text/65 font-bold tracking-wide uppercase">All-Time Workload</span>
            <span className="text-xl font-black text-theme-text">{dailyTimeSpentText}</span>
            <span className="text-[9px] font-sans text-theme-text/80">Total temporal deduction</span>
          </div>
        </div>

        {/* Multi-Dimensional performance */}
        <div className="bg-theme-card border border-theme-comp p-4 shadow-sm rounded-none text-theme-text font-mono">
          <span className="text-[9px] text-theme-text/65 font-bold tracking-widest uppercase block border-b border-theme-comp/20 pb-1.5 mb-2">Dimensional Sub-Accuracy</span>
          <div className="space-y-3">
            {([2, 3, 4] as number[]).map((dim) => {
              const { total, correct } = dimStats[dim] || { total: 0, correct: 0 };
              const accPercent = total > 0 ? Math.round((correct / total) * 100) : 0;
              
              return (
                <div key={dim} className="flex justify-between items-center text-xs">
                  <span>{dim}D Manifold:</span>
                  <span className="font-bold">{accPercent}% <span className="text-[10px] opacity-40">({correct}/{total})</span></span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Historical entries log sidebar list */}
        <div className="bg-theme-card/40 border border-theme-comp p-5 shadow-sm flex flex-col h-[230px] rounded-none text-theme-text">
          <div className="flex items-center gap-2 border-b border-theme-comp/30 pb-2 mb-3 shrink-0">
            <History className="w-4 h-4 text-theme-comp" />
            <h4 className="font-mono font-bold text-theme-text text-xs uppercase tracking-wider">
              Training Log Telemetry
            </h4>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 select-none">
            {stats.history.length === 0 ? (
               <p className="text-center text-[10px] text-theme-text/60 font-mono italic pt-6">No historical records available.</p>
            ) : (
              [...stats.history].reverse().map((h, hIdx) => (
                <div
                  key={hIdx}
                  className="bg-theme-card hover:bg-theme-card/90 border border-theme-comp/40 px-3 py-2 flex items-center justify-between transition-all rounded-none"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-mono text-theme-text font-bold uppercase tracking-tight">
                      {h.dimension}D SPACE - <span className="font-black underline">{h.difficulty}</span>
                    </span>
                    <span className="text-[9px] font-mono text-theme-text/60">Time: {((h.timeMs || 0) / 1000).toFixed(1)}s</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 border ${
                      h.correct ? 'text-theme-text bg-theme-bg border-theme-comp' : 'text-red-500 bg-theme-card border-red-500'
                    }`}>
                      {h.correct ? 'COMPLIANT' : 'DIVERGED'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {stats.history.length > 0 && (
            <button
              id="reset-telemetry-btn"
              onClick={onResetStats}
              className="mt-3 text-[9px] font-mono text-theme-text/60 hover:text-theme-text text-center uppercase tracking-wider block font-bold cursor-pointer"
            >
              Flush Cognitive Logs
            </button>
          )}
        </div>

      </div>

    </div>
  );
}
