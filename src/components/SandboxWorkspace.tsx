import React, { useState, useEffect } from 'react';
import { DimensionCount, Premise, SolverResult, Vector, AbstractRelationMapping } from '../types';
import { solveRelations, describeVector, parseVector, describeAbstractVector } from '../utils/engine';
import { Plus, Trash2, HelpCircle, Table, ArrowRight, RefreshCw, Layers2, Settings2, ShieldAlert } from 'lucide-react';

interface SandboxWorkspaceProps {
  dimension: DimensionCount;
  setDimension: (dim: DimensionCount) => void;
  premises: Premise[];
  setPremises: (premises: Premise[]) => void;
  basisRelations: Record<string, Vector>;
  onUpdateBasis: (basis: Record<string, Vector>) => void;
  solverResult: SolverResult;
  setHighlightedPremiseId: (id: string | null) => void;
  abstractRelationsEnabled: boolean;
  abstractMapping: AbstractRelationMapping;
  onRegenerateAbstractMapping: () => void;
  scrambleComponentOrder?: boolean;
}

export default function SandboxWorkspace({
  dimension,
  setDimension,
  premises,
  setPremises,
  basisRelations,
  onUpdateBasis,
  solverResult,
  setHighlightedPremiseId,
  abstractRelationsEnabled,
  abstractMapping,
  onRegenerateAbstractMapping,
  scrambleComponentOrder
}: SandboxWorkspaceProps) {
  // Input builders for adding a relation
  const [entityA, setEntityA] = useState<string>('');
  const [entityB, setEntityB] = useState<string>('');
  const [relation, setRelation] = useState<string>('');
  const [isCustomRelation, setIsCustomRelation] = useState<boolean>(false);

  // Input builders for query relation
  const [queryA, setQueryA] = useState<string>('');
  const [queryB, setQueryB] = useState<string>('');
  const [queryResult, setQueryResult] = useState<{ vector: Vector; text: string } | null>(null);

  // Basis customization text
  const [basisEditName, setBasisEditName] = useState<string>('');
  const [basisEditVector, setBasisEditVector] = useState<string>('');

  // Set default relation on render
  useEffect(() => {
    if (isCustomRelation) return;
    const keys = Object.keys(basisRelations);
    if (keys.length > 0) {
      if (!relation || !keys.includes(relation)) {
        setRelation(keys[0]);
      }
    }
  }, [basisRelations, relation, isCustomRelation]);

  // Handle adding premise definition
  const handleAddPremise = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanA = entityA.trim();
    const cleanB = entityB.trim();
    if (!cleanA || !cleanB || !relation) return;

    if (cleanA.toUpperCase() === cleanB.toUpperCase()) {
      alert("An entity cannot have a spatial relationship with itself.");
      return;
    }

    const newPremise: Premise = {
      id: `prm_${Math.floor(Math.random() * 1000000)}`,
      entityA: cleanA,
      relation,
      entityB: cleanB
    };

    setPremises([...premises, newPremise]);
    setEntityA('');
    setEntityB('');
  };

  const handleDeletePremise = (id: string) => {
    setPremises(premises.filter(p => p.id !== id));
    setHighlightedPremiseId(null);
  };

  const handleClearAll = () => {
    setPremises([]);
    setQueryResult(null);
    setHighlightedPremiseId(null);
  };

  // Custom Basis configuration trigger
  const handleAddCustomBasis = (e: React.FormEvent) => {
    e.preventDefault();
    if (!basisEditName.trim() || !basisEditVector.trim()) return;

    try {
      const parsed = JSON.parse(basisEditVector.trim());
      if (!Array.isArray(parsed) || parsed.length !== dimension) {
        alert(`Vector must be a JSON array of length ${dimension}. e.g. [1, 0] or [1, -1, 0]`);
        return;
      }
      if (parsed.some(v => typeof v !== 'number')) {
        alert("All coordinates inside vector array must be numeric values.");
        return;
      }

      onUpdateBasis({
        ...basisRelations,
        [basisEditName.toUpperCase().trim()]: parsed
      });
      setBasisEditName('');
      setBasisEditVector('');
    } catch (err) {
      alert("Unable to parse vector JSON. Format must be exactly e.g. [1, 2, -1]");
    }
  };

  // Run Query
  const handleQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryA || !queryB) return;

    const nodeA = solverResult.entities[queryA];
    const nodeB = solverResult.entities[queryB];

    if (!nodeA || !nodeB) {
      setQueryResult({
        vector: [],
        text: "One or both entities do not exist in the coordinate database yet."
      });
      return;
    }

    if (nodeA.componentId !== nodeB.componentId) {
      setQueryResult({
        vector: [],
        text: `Disconnected structures! Absolute translation between ${queryA} and ${queryB} is undefined with the current premises.`
      });
      return;
    }

    // Displacement vector: nodeA - nodeB
    const displacement = nodeA.coordinates.map((val, idx) => val - (nodeB.coordinates[idx] || 0));
    const semanticName = abstractRelationsEnabled
      ? describeAbstractVector(displacement, abstractMapping, dimension, scrambleComponentOrder)
      : describeVector(displacement, basisRelations, scrambleComponentOrder);

    setQueryResult({
      vector: displacement,
      text: `${queryA} is ${semanticName} of ${queryB}`
    });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6" id="sandbox-workspace-row">
      
      {/* Constraints builder left panel info */}
      <div className="xl:col-span-4 flex flex-col gap-6">
        
        {/* Space Dimensionality Config */}
        <div className="bg-theme-card border border-theme-comp p-5 shadow-sm rounded-none">
          <div className="flex items-center gap-2 mb-3.5 border-b border-theme-comp/20 pb-2">
            <Settings2 className="w-4 h-4 text-theme-comp" />
            <h3 className="font-mono font-bold text-theme-text text-xs uppercase tracking-wider">
              Space Dimensionality
            </h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([2, 3, 4] as DimensionCount[]).map((dim) => (
              <button
                key={dim}
                type="button"
                onClick={() => setDimension(dim)}
                className={`py-2 px-1 font-mono text-xs font-bold border transition-all cursor-pointer select-none ${
                  dimension === dim
                    ? 'bg-theme-comp text-theme-bg border-theme-comp'
                    : 'bg-theme-card border-theme-comp/30 text-theme-text hover:bg-theme-bg hover:border-theme-comp'
                }`}
              >
                {dim}D SPACE
              </button>
            ))}
          </div>
          <p className="text-[10px] font-mono mt-3 text-theme-text/75 leading-normal">
            Configure the geometry coordinate space dimensions. Selecting a dimension updates the available basis relations dynamically.
          </p>
        </div>
        
        {/* Definition builder card */}
        <div className="bg-theme-card border border-theme-comp p-5 shadow-sm rounded-none">
          <div className="flex items-center gap-2 mb-4 border-b border-theme-comp/22 pb-2">
            <Layers2 className="w-4 h-4 text-theme-comp" />
            <h3 className="font-mono font-bold text-theme-text text-xs uppercase tracking-wider">
              Define Space Relations
            </h3>
          </div>

          <form onSubmit={handleAddPremise} className="flex flex-col gap-3.5">
            <div>
              <label className="text-[9px] font-mono font-bold text-theme-text block mb-1">TARGET NODE (ENTITY A)</label>
              <input
                id="entity-a-input"
                type="text"
                placeholder="e.g. ALPHA, X, OFFICE"
                value={entityA}
                onChange={(e) => setEntityA(e.target.value)}
                className="w-full bg-theme-bg border border-theme-comp focus:outline-none focus:bg-theme-bg px-3.5 py-2 text-xs font-sans text-theme-text uppercase rounded-none"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[9px] font-mono font-bold text-theme-text block">RELATION DIRECTION</label>
                <button
                  type="button"
                  onClick={() => {
                    const nextCustom = !isCustomRelation;
                    setIsCustomRelation(nextCustom);
                    if (nextCustom) {
                      setRelation(dimension === 2 ? '[1, 0]' : dimension === 3 ? '[1, 0, 0]' : '[1, 0, 0, 0]');
                    } else {
                      const keys = Object.keys(basisRelations);
                      if (keys.length > 0) setRelation(keys[0]);
                    }
                  }}
                  className="text-[8px] uppercase font-mono font-bold text-theme-text border border-theme-comp px-1.5 py-0.5 hover:bg-theme-comp hover:text-theme-bg cursor-pointer transition-all select-none"
                >
                  {isCustomRelation ? "Use presets" : "Input custom [x, y, z, w]"}
                </button>
              </div>

              {isCustomRelation ? (
                <div className="flex flex-col gap-1">
                  <input
                    id="relation-custom-input"
                    type="text"
                    required
                    placeholder={dimension === 2 ? "e.g. [1, -1]" : dimension === 3 ? "e.g. [0, 1, 1]" : "e.g. [1, 0, -1, 1]"}
                    value={relation}
                    onChange={(e) => setRelation(e.target.value)}
                    className="w-full bg-theme-bg border border-theme-comp focus:outline-none focus:bg-theme-bg px-3.5 py-2 text-xs font-mono text-theme-text uppercase rounded-none"
                  />
                  <p className="text-[8px] text-theme-text/70 font-mono leading-tight">
                    Format:{' '}
                    {abstractRelationsEnabled ? (
                      dimension === 2 ? `[${abstractMapping['0_pos']}/${abstractMapping['0_neg']}, ${abstractMapping['1_pos']}/${abstractMapping['1_neg']}]` :
                      dimension === 3 ? `[${abstractMapping['0_pos']}/${abstractMapping['0_neg']}, ${abstractMapping['1_pos']}/${abstractMapping['1_neg']}, ${abstractMapping['2_pos']}/${abstractMapping['2_neg']}]` :
                      `[${abstractMapping['0_pos']}/${abstractMapping['0_neg']}, ${abstractMapping['1_pos']}/${abstractMapping['1_neg']}, ${abstractMapping['2_pos']}/${abstractMapping['2_neg']}, ${abstractMapping['3_pos']}/${abstractMapping['3_neg']}]`
                    ) : (
                      dimension === 2 ? "[North/South, East/West]" :
                      dimension === 3 ? "[North/South, East/West, Above/Below]" :
                      "[North/South, East/West, Above/Below, After/Before]"
                    )}
                  </p>
                </div>
              ) : (
                <select
                  id="relation-select"
                  value={relation}
                  onChange={(e) => setRelation(e.target.value)}
                  className="w-full bg-theme-bg border border-theme-comp focus:outline-none px-3.5 py-2 text-xs font-mono text-theme-text rounded-none cursor-pointer"
                >
                  {Object.keys(basisRelations).map(k => (
                    <option key={k} value={k}>
                      {k} ({JSON.stringify(basisRelations[k])})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="text-[9px] font-mono font-bold text-theme-text block mb-1">REFERENCE NODE (ENTITY B)</label>
              <input
                id="entity-b-input"
                type="text"
                placeholder="e.g. BETA, Y, ENTRANCE"
                value={entityB}
                onChange={(e) => setEntityB(e.target.value)}
                className="w-full bg-theme-bg border border-theme-comp focus:outline-none focus:bg-theme-bg px-3.5 py-2 text-xs font-sans text-theme-text uppercase rounded-none"
              />
            </div>

            <button
              id="add-definition-btn"
              type="submit"
              disabled={!entityA.trim() || !entityB.trim()}
              className="mt-2 w-full bg-theme-comp hover:bg-theme-comp/90 disabled:opacity-35 text-theme-bg font-mono font-bold text-xs py-2.5 rounded-none flex items-center justify-center gap-1.5 transition-all cursor-pointer uppercase tracking-wider border border-theme-comp"
            >
              <Plus className="w-4 h-4" />
              Inject Definition
            </button>
          </form>
        </div>

        {/* Dynamic displacement mapping query builder */}
        <div className="bg-theme-card border border-theme-comp p-5 shadow-sm rounded-none">
          <div className="flex items-center gap-2 mb-4 border-b border-theme-comp/20 pb-2">
            <HelpCircle className="w-4 h-4 text-theme-comp" />
            <h3 className="font-mono font-bold text-theme-text text-xs uppercase tracking-wider">
              Displacement Query Engine
            </h3>
          </div>

          <form onSubmit={handleQuery} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-mono font-bold text-theme-text block mb-1">NODE X</label>
                <select
                  id="query-x-select"
                  value={queryA}
                  onChange={(e) => setQueryA(e.target.value)}
                  className="w-full bg-theme-bg border border-theme-comp focus:outline-none p-2 text-xs font-sans text-theme-text uppercase rounded-none"
                >
                  <option value="" className="bg-theme-card text-theme-text">Select...</option>
                  {Object.keys(solverResult.entities).map(nodeName => (
                    <option key={nodeName} value={nodeName} className="bg-theme-card text-theme-text">{nodeName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-mono font-bold text-theme-text block mb-1">NODE Y</label>
                <select
                  id="query-y-select"
                  value={queryB}
                  onChange={(e) => setQueryB(e.target.value)}
                  className="w-full bg-theme-bg border border-theme-comp focus:outline-none p-2 text-xs font-sans text-theme-text uppercase rounded-none"
                >
                  <option value="" className="bg-theme-card text-theme-text">Select...</option>
                  {Object.keys(solverResult.entities).map(nodeName => (
                    <option key={nodeName} value={nodeName} className="bg-theme-card text-theme-text">{nodeName}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              id="query-vectors-btn"
              type="submit"
              disabled={!queryA || !queryB}
              className="w-full bg-theme-comp hover:bg-theme-comp/90 disabled:opacity-30 text-theme-bg font-mono font-bold text-xs py-2 rounded-none flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider border border-theme-comp"
            >
              Analyze Relative Vector
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {queryResult && (
            <div className="mt-4 p-3 bg-theme-bg border border-theme-comp rounded-none text-center">
              <span className="text-[9px] font-mono font-bold text-theme-text/60 block uppercase">DEDUCTION COORD OUTCOME</span>
              <p className="text-xs font-bold text-theme-text font-mono mt-1 leading-normal uppercase">
                {queryResult.text}
              </p>
              {queryResult.vector.length > 0 && (
                <span className="font-mono text-[9px] font-bold text-theme-bg bg-theme-comp px-2 py-0.5 mt-1.5 inline-block uppercase">
                  Displacement Vector: [{queryResult.vector.join(', ')}]
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Grid central databases panel */}
      <div className="xl:col-span-8 flex flex-col gap-6">

        {/* If contradictory warn user */}
        {!solverResult.isConsistent && solverResult.contradiction && (
          <div className="bg-red-950/20 border-2 border-red-500/50 p-5 text-red-100 flex flex-col gap-3 shadow-md rounded-none">
            <div className="flex gap-2 items-center text-red-400">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <strong className="text-xs font-mono tracking-widest uppercase font-black">Relational Paradox Detected!</strong>
            </div>
            <p className="text-xs font-sans text-red-300 leading-normal">
              The spatial premises cannot be mapped to coordinate space. An entity has been assigned conflicting dimensions through recursive logic chains.
            </p>
            <div className="bg-theme-bg rounded-none p-3 border border-red-500/40 text-xs font-mono space-y-2 mt-1">
              <div>
                <span className="text-theme-text font-bold">► Conflict node: </span>
                <span className="text-red-400 font-extrabold">{solverResult.contradiction.entityB}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[11px] py-1 border-y border-theme-comp/25">
                <div>
                  <span className="text-theme-text/75 font-bold">Path A coordinate:</span>
                  <div className="text-green-400 font-black">[{solverResult.contradiction.expectedVector.join(', ')}]</div>
                </div>
                <div>
                  <span className="text-theme-text/75 font-bold">Path B coordinate:</span>
                  <div className="text-red-400 font-black">[{solverResult.contradiction.actualVector.join(', ')}]</div>
                </div>
              </div>
              <div className="text-[10px] space-y-1 mt-2 text-red-300 leading-snug">
                <div className="text-red-400 font-black uppercase text-[9px] mb-0.5">Logical path deductions:</div>
                {solverResult.contradiction.pathB.map((step, sIdx) => (
                  <div key={sIdx} className="pl-2 border-l-2 border-red-500">• {step}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Premises checklist table */}
        <div className="bg-theme-card border border-theme-comp p-5 shadow-sm flex flex-col rounded-none">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-theme-comp/30">
            <div className="flex items-center gap-2">
              <Table className="w-4 h-4 text-theme-comp" />
              <h3 className="font-mono font-bold text-theme-text text-xs uppercase tracking-wider">
                Passive Declarations Database ({premises.length})
              </h3>
            </div>
            {premises.length > 0 && (
              <button
                id="clear-all-premises"
                onClick={handleClearAll}
                className="text-xs text-theme-bg bg-theme-comp hover:bg-theme-comp/95 px-3 py-1 font-mono font-bold uppercase tracking-wider border border-theme-comp transition-all cursor-pointer rounded-none"
              >
                Flush Space
              </button>
            )}
          </div>

          {premises.length === 0 ? (
            <div className="text-center py-10 text-theme-text/60 text-xs font-mono flex flex-col items-center gap-2 bg-theme-bg/30 border border-dashed border-theme-comp/40">
              <RefreshCw className="w-6 h-6 text-theme-comp animate-spin" style={{ animationDuration: '6s' }} />
              <p className="font-bold uppercase tracking-wider">Database Empty</p>
              <p className="text-[10px] max-w-xs text-theme-text/50 mt-0.5 leading-normal">Inject relative locations above or run training exercises to populate coordinate mappings dynamically.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left" id="premises-table">
                <thead className="bg-theme-bg border-b border-theme-comp text-[9px] font-mono tracking-wider font-bold text-theme-text">
                  <tr>
                    <th className="px-4 py-2">INDEX</th>
                    <th className="px-4 py-2">RELATIONSHIP PATTERN</th>
                    <th className="px-4 py-2 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-comp/20">
                  {premises.map((p, idx) => (
                    <tr
                      key={p.id}
                      className="hover:bg-theme-bg/40 transition-all duration-150"
                      onMouseEnter={() => setHighlightedPremiseId(p.id)}
                      onMouseLeave={() => setHighlightedPremiseId(null)}
                    >
                      <td className="px-4 py-3 font-mono text-[9px] text-theme-text/60 font-bold">
                        #{String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <span className="flex items-center gap-1.5 text-theme-text flex-wrap">
                          <strong className="text-theme-text font-black">{p.entityA}</strong>
                          <span className="opacity-55 font-serif italic text-xs">is</span>
                          <span className="font-mono px-1.5 py-0.5 font-bold uppercase tracking-tight text-[10px]" style={{ backgroundColor: 'var(--main-color-complementary)', color: 'var(--main-color)' }}>
                            {p.relation}
                          </span>
                          {(() => {
                            const vec = basisRelations[p.relation] || parseVector(p.relation, dimension);
                            if (vec) {
                              return (
                                <span className="font-mono text-[9px] font-bold text-theme-text/85 bg-theme-bg border border-theme-comp/30 px-1.5 py-0.5 select-none uppercase tracking-tighter">
                                  [{vec.join(', ')}]
                                </span>
                              );
                            }
                            return null;
                          })()}
                          <span className="opacity-55 font-serif italic text-xs">of</span>
                          <strong className="text-theme-text font-bold">{p.entityB}</strong>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <button
                          id={`delete-premise-btn-${p.id}`}
                          onClick={() => handleDeletePremise(p.id)}
                          className="text-theme-text/65 hover:text-theme-text hover:bg-theme-comp/15 p-1 border border-transparent hover:border-theme-comp transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Dynamic coordinate space grid lookup */}
        <div className="bg-theme-card border border-theme-comp p-5 shadow-sm rounded-none">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-theme-comp">
            <Settings2 className="w-4 h-4 text-theme-comp" />
            <h3 className="font-mono font-bold text-theme-text text-xs uppercase tracking-wider">
              Absolute Coordinate Space
            </h3>
          </div>

          {Object.keys(solverResult.entities).length === 0 ? (
            <p className="text-center font-mono text-xs text-theme-text/60 py-6">Coordinates system not generated. No connected objects.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.values(solverResult.entities).map(node => (
                <div
                  id={`coord-card-${node.name}`}
                  key={node.name}
                  className="bg-theme-card border border-theme-comp p-3 shadow-none h-full flex flex-col justify-between rounded-none hover:border-theme-accent transition-all duration-155"
                >
                  <div className="flex justify-between items-start mb-2 font-mono">
                    <span className="font-black text-theme-text uppercase tracking-tight">{node.name}</span>
                    <span className="text-[8px] text-theme-text border border-theme-comp px-1 bg-theme-bg uppercase font-bold">
                      Comp #{node.componentId}
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-theme-bg px-2 py-1.5 border border-theme-comp/40 font-mono">
                    <span className="text-[8px] text-theme-text/60 uppercase tracking-tight font-bold">Vectors:</span>
                    <span className="text-xs font-black text-theme-accent">
                      [{node.coordinates.join(', ')}]
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Custom Basis Relations settings section */}
        <div className="bg-theme-card border border-theme-comp p-5 shadow-sm rounded-none">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-theme-comp">
            <Settings2 className="w-4 h-4 text-theme-comp" />
            <h3 className="font-mono font-bold text-theme-text text-xs uppercase tracking-wider">
              Configure Primitive Basis Vectors
            </h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4 bg-theme-bg rounded-none p-3 border border-theme-comp text-xs font-mono">
              <span className="text-[9px] font-bold text-theme-text/60 block uppercase">INJECT PRIMITIVE TRANSLATION</span>
              <form onSubmit={handleAddCustomBasis} className="flex flex-col gap-2.5 mt-2">
                <div>
                  <label className="text-[8px] text-theme-text font-bold">LABEL</label>
                  <input
                    id="basis-label-input"
                    type="text"
                    required
                    placeholder="e.g. NORTH-ABOVE"
                    value={basisEditName}
                    onChange={(e) => setBasisEditName(e.target.value)}
                    className="w-full bg-theme-card border border-theme-comp p-2 text-xs font-sans text-theme-text uppercase rounded-none"
                  />
                </div>
                <div>
                  <label className="text-[8px] text-theme-text font-bold">VECTOR VALUES ({dimension}D)</label>
                  <input
                    id="basis-vector-input"
                    type="text"
                    required
                    placeholder={dimension === 2 ? '[1, -1]' : dimension === 3 ? '[0, 1, 1]' : '[1, 0, -1, 1]'}
                    value={basisEditVector}
                    onChange={(e) => setBasisEditVector(e.target.value)}
                    className="w-full bg-theme-card border border-theme-comp p-2 text-xs font-mono text-theme-text rounded-none"
                  />
                </div>
                <button
                  id="add-custom-basis-btn"
                  type="submit"
                  className="w-full bg-theme-comp hover:bg-theme-comp/90 text-theme-bg border border-theme-comp text-[9px] py-2 px-3 font-bold uppercase tracking-wider cursor-pointer font-mono rounded-none transition-all"
                >
                  Save Basis Mapping
                </button>
              </form>
            </div>

            <div className="lg:col-span-8 overflow-y-auto max-h-[190px] border border-theme-comp rounded-none bg-theme-bg/40">
              <table className="w-full text-left text-xs bg-theme-card/30">
                <thead className="bg-theme-bg border-b border-theme-comp text-[8px] font-mono text-theme-text font-bold tracking-wider uppercase">
                  <tr>
                    <th className="px-3 py-1.5">SEMANTIC STRING</th>
                    <th className="px-3 py-1.5 text-right">COORDINATE MAPPING</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-comp/20 font-mono text-[10px] text-theme-text">
                  {Object.entries(basisRelations).map(([name, vec]) => (
                    <tr key={name} className="hover:bg-theme-bg/10">
                      <td className="px-3 py-2 font-black uppercase tracking-tight text-theme-text">{name}</td>
                      <td className="px-3 py-2 text-right font-bold text-theme-accent">
                        [{vec.join(', ')}]
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
