import React, { useState, useEffect, useRef } from 'react';
import { DimensionCount, Puzzle, PuzzleDifficulty, TrainingStats, AbstractRelationMapping } from '../types';
import { generateTrainerPuzzle, getBasisRelations, generateUniqueCVCNames, generateAbstractMapping, translateStandardRelationToAbstract, translateTextToAbstract, scrambleStandardRelation, scrambleTextStandard } from '../utils/engine';
import { 
  Brain, Trophy, Clock, ShieldCheck, HelpCircle, 
  ArrowRight, RotateCw, Activity, Compass, Sliders, Zap,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ContextOption {
  text: string;
  isCorrect: boolean;
  vector?: number[];
}

interface ContextPuzzle {
  dimension: DimensionCount;
  difficulty: PuzzleDifficulty;
  nodeDefinitions: {
    node: string;
    relation: string;
    targetNode: string;
    baseOffset: number[];
  }[];
  contextVehicles: {
    id: string; 
    boundRelation: string; 
    boundNode: string; 
    boundVector: number[];
    shiftMultiplier: number; 
    shiftLabel: string; 
    axisIndex?: number;
    effectiveMultiplier?: number;
    axisMultipliers?: number[];
  }[];
  activeContextGroup: string[]; 
  queryNode: string; 
  queryTarget: string; 
  baseOffsetVector: number[]; 
  projectedVector: number[]; 
  baseRelation: string; 
  projectedRelation: string; 
  options: ContextOption[];
}

interface AnalogyPuzzle {
  dimension: DimensionCount;
  difficulty: PuzzleDifficulty;
  nodeDefinitions: {
    node: string;
    relation: string;
    targetNode: string;
    baseOffset: number[];
  }[];
  contextVehicles: {
    id: string; 
    boundRelation: string; 
    boundNode: string; 
    boundVector: number[];
    shiftMultiplier: number; 
    shiftLabel: string; 
    axisIndex?: number;
    effectiveMultiplier?: number;
    axisMultipliers?: number[];
  }[];
  context1: string;
  nodeA: string;
  nodeB: string;
  context2: string;
  nodeC: string;
  nodeD: string;
  isTrueAnalogy: boolean;
  correctAnswerNode: string;
  options: {
    text: string;
    isCorrect: boolean;
  }[];
  explanation: string;
  baseVector: number[];
  projectedVector: number[];
  baseRelationName: string;
  projectedRelationName: string;
  context1Modifiers: number[];
  context2Modifiers: number[];
  context2BaseVector: number[];

  // Optional fields for extended chain / composition / nesting support
  context3?: string;
  nodeE?: string;
  nodeF?: string;
  context3Modifiers?: number[];
  context3BaseVector?: number[];

  context4?: string;
  nodeG?: string;
  nodeH?: string;
  context4Modifiers?: number[];
  context4BaseVector?: number[];

  analogyChainLength?: number;
  analogyStructureType?: 'standard' | 'nested';
  analogyContextDepth?: number;
}

interface TrainingWorkspaceProps {
  stats: TrainingStats;
  onUpdateStats: (newStats: TrainingStats) => void;
  basisRelations2D: Record<string, number[]>;
  basisRelations3D: Record<string, number[]>;
  basisRelations4D: Record<string, number[]>;
  setDimension: (dim: DimensionCount) => void;
  setSelectedPremises: (premises: any[]) => void;
  setHighlightedPremiseId: (id: string | null) => void;
  workoutMode: 'classic' | 'context' | 'analogy';
  setWorkoutMode: (mode: 'classic' | 'context' | 'analogy') => void;
  onUpdateContextDetails: (details: {
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
  }) => void;
  isSubmitted: boolean;
  setIsSubmitted: (isSub: boolean) => void;
  abstractRelationsEnabled: boolean;
  abstractMapping: AbstractRelationMapping;
  onRegenerateAbstractMapping: (newMapping: AbstractRelationMapping) => void;
  scrambleComponentOrder?: boolean;
}

const describeContextVector = (vec: number[], dim: DimensionCount): string => {
  const parts: string[] = [];
  const y = vec[0] ?? 0;
  const x = vec[1] ?? 0;
  
  let gridPart = '';
  if (y > 0) gridPart += 'North';
  else if (y < 0) gridPart += 'South';
  if (x > 0) gridPart += 'East';
  else if (x < 0) gridPart += 'West';
  
  if (gridPart) {
    if (Math.abs(y) > 1 || Math.abs(x) > 1) {
      gridPart += '-Scaled';
    }
    parts.push(gridPart);
  }
  
  if (dim >= 3) {
    const z = vec[2] ?? 0;
    if (z > 0) {
      parts.push(Math.abs(z) > 1 ? 'Above-Scaled' : 'Above');
    } else if (z < 0) {
      parts.push(Math.abs(z) > 1 ? 'Below-Scaled' : 'Below');
    }
  }
  
  if (dim >= 4) {
    const w = vec[3] ?? 0;
    if (w > 0) {
      parts.push(Math.abs(w) > 1 ? 'After-Scaled' : 'After');
    } else if (w < 0) {
      parts.push(Math.abs(w) > 1 ? 'Before-Scaled' : 'Before');
    }
  }
  
  if (parts.length === 0) return 'Origin';
  return parts.join('-');
};

export function generateContextPuzzle(
  dim: DimensionCount,
  difficulty: PuzzleDifficulty,
  customSettings?: {
    useCustom: boolean;
    anchorCount: number;
    anchorDefinitionsCount?: number;
    shiftsPerAnchor: number;
    interrelation: 'chain' | 'cross' | 'mixed';
    scaleType: 'integer' | 'mixed';
    activeContextsCount?: string | number;
    scrambleSetting?: 'none' | 'partial' | 'full';
    contextType?: 'premises' | 'inferences' | 'both';
  }
): ContextPuzzle {
  const getRandomOffset = (d: number): number[] => {
    const out: any[] = [0, 0, 0, 0];
    const choices = [-1, 0, 1];
    for (let i = 0; i < d; i++) {
      if (i === 3) {
        // 4D Space: Make "after" (+w) extremely rare (less than 8%, e.g. 6.5%)
        const r = Math.random();
        if (r < 0.065) {
          out[i] = 1; // "After"
        } else if (r < 0.50) {
          out[i] = -1; // "Before"
        } else {
          out[i] = 0;
        }
      } else {
        out[i] = choices[Math.floor(Math.random() * choices.length)];
      }
    }
    if (out.slice(0, d).every(v => v === 0)) {
      out[0] = 1;
    }
    return out;
  };

  // Dynamic node & offset generator up to 12 anchors
  const maxNodesNeeded = (customSettings && customSettings.useCustom)
    ? (customSettings.anchorDefinitionsCount !== undefined
        ? Math.max(3, customSettings.anchorDefinitionsCount + 1)
        : Math.max(5, (customSettings.anchorCount || 0) + 1))
    : (dim >= 4 ? 5 : (dim === 3 ? 4 : 3));

  const itemNames = generateUniqueCVCNames(maxNodesNeeded);
  const backups = generateUniqueCVCNames(10).filter(n => !itemNames.includes(n));
  const GammaName = itemNames[0];
  const BetaName = itemNames[1] || backups[0];
  const AlphaName = itemNames[2] || backups[1];
  const DeltaName = itemNames[3] || backups[2];
  const OmegaName = itemNames[4] || backups[3];

  const nodesCoords: Record<string, number[]> = {
    [GammaName]: [0, 0, 0, 0]
  };

  const connectedNodes = [GammaName];
  const remainingNodes = itemNames.slice(1);
  const rawGeneratedAxes: { boundNode: string; boundVector: number[]; boundName: string; targetNode: string; isImplicit: boolean }[] = [];

  while (remainingNodes.length > 0) {
    let parentIndex = 0;
    const nextChildIndex = connectedNodes.length;
    if (nextChildIndex === 1) {
      parentIndex = 0; // Beta relative to Gamma
    } else if (nextChildIndex === 2) {
      parentIndex = 1; // Alpha relative to Beta
    } else if (nextChildIndex === 3) {
      parentIndex = 0; // Delta relative to Gamma
    } else if (nextChildIndex === 4) {
      parentIndex = 2; // Omega relative to Alpha
    } else {
      parentIndex = Math.floor(Math.random() * connectedNodes.length);
    }

    const child = remainingNodes.shift()!;
    let foundUnique = false;
    let offset = [0, 0, 0, 0];
    let parent = connectedNodes[parentIndex];
    let parentCoords = nodesCoords[parent];

    for (let attempts = 0; attempts < 150; attempts++) {
      if (attempts > 10) {
        parentIndex = Math.floor(Math.random() * connectedNodes.length);
        parent = connectedNodes[parentIndex];
        parentCoords = nodesCoords[parent];
      }

      const candidateOffset = getRandomOffset(dim);
      const candidateCoords = [
        parentCoords[0] + candidateOffset[0],
        parentCoords[1] + candidateOffset[1],
        parentCoords[2] + candidateOffset[2],
        parentCoords[3] + candidateOffset[3]
      ];

      const occupied = Object.values(nodesCoords).some(coords => 
        coords[0] === candidateCoords[0] &&
        coords[1] === candidateCoords[1] &&
        coords[2] === candidateCoords[2] &&
        coords[3] === candidateCoords[3]
      );

      if (!occupied) {
        offset = candidateOffset;
        nodesCoords[child] = candidateCoords;
        foundUnique = true;
        break;
      }
    }

    if (!foundUnique) {
      let fallbackOffset = [0, 0, 0, 0];
      let iteration = 1;
      while (!foundUnique) {
        fallbackOffset = [iteration * 3, 0, 0, 0];
        const candidateCoords = [
          parentCoords[0] + fallbackOffset[0],
          parentCoords[1] + fallbackOffset[1],
          parentCoords[2] + fallbackOffset[2],
          parentCoords[3] + fallbackOffset[3]
        ];
        const occupied = Object.values(nodesCoords).some(coords => 
          coords[0] === candidateCoords[0] &&
          coords[1] === candidateCoords[1] &&
          coords[2] === candidateCoords[2] &&
          coords[3] === candidateCoords[3]
        );
        if (!occupied) {
          offset = fallbackOffset;
          nodesCoords[child] = candidateCoords;
          foundUnique = true;
        }
        iteration++;
      }
    }

    connectedNodes.push(child);

    rawGeneratedAxes.push({
      boundNode: child,
      boundVector: offset,
      boundName: describeContextVector(offset, dim),
      targetNode: parent,
      isImplicit: false
    });
  }

  const poolOfItems = connectedNodes;

  // Pick random query pair out of defined vectors
  let qIdx1 = Math.floor(Math.random() * poolOfItems.length);
  let qIdx2 = Math.floor(Math.random() * poolOfItems.length);
  while (qIdx1 === qIdx2) {
    qIdx2 = Math.floor(Math.random() * poolOfItems.length);
  }
  const queryNode = poolOfItems[qIdx1];
  const queryTarget = poolOfItems[qIdx2];

  const baseOffsetVector = [
    nodesCoords[queryNode][0] - nodesCoords[queryTarget][0],
    nodesCoords[queryNode][1] - nodesCoords[queryTarget][1],
    nodesCoords[queryNode][2] - nodesCoords[queryTarget][2],
    nodesCoords[queryNode][3] - nodesCoords[queryTarget][3],
  ];

  if (baseOffsetVector.slice(0, dim).every(v => v === 0)) {
    baseOffsetVector[0] = 1;
  }

  const contextVehicles: any[] = [];
  const activeContextGroup: string[] = [];

  // Track explicit relations
  const premisePairs = new Set<string>();
  rawGeneratedAxes.forEach(ax => {
    premisePairs.add(`${ax.boundNode}::${ax.targetNode}`);
    premisePairs.add(`${ax.targetNode}::${ax.boundNode}`);
  });

  // Generate list of all possible implicit (inference) relations on the active map
  const inferencePairs: { boundNode: string; targetNode: string; boundVector: number[]; boundName: string; isImplicit: boolean }[] = [];
  for (let i = 0; i < poolOfItems.length; i++) {
    for (let j = 0; j < poolOfItems.length; j++) {
      if (i === j) continue;
      const u = poolOfItems[i];
      const v = poolOfItems[j];
      const key = `${u}::${v}`;
      if (!premisePairs.has(key)) {
        const vec = [
          nodesCoords[u][0] - nodesCoords[v][0],
          nodesCoords[u][1] - nodesCoords[v][1],
          nodesCoords[u][2] - nodesCoords[v][2],
          nodesCoords[u][3] - nodesCoords[v][3],
        ];
        if (!vec.slice(0, dim).every(val => val === 0)) {
          inferencePairs.push({
            boundNode: u,
            targetNode: v,
            boundVector: vec,
            boundName: describeContextVector(vec, dim),
            isImplicit: true
          });
        }
      }
    }
  }

  const baseRawAxes = rawGeneratedAxes;

  // Decide dynamically per slot if we mutate/swap it to be an implicit inference axis!
  const finalAxes: typeof baseRawAxes = [];
  const mutableInferences = [...inferencePairs];
  const contextType = customSettings?.contextType ?? 'both';

  for (let i = 0; i < baseRawAxes.length; i++) {
    if (contextType === 'inferences') {
      if (mutableInferences.length > 0) {
        const idx = Math.floor(Math.random() * mutableInferences.length);
        finalAxes.push(mutableInferences.splice(idx, 1)[0]);
      } else {
        finalAxes.push(baseRawAxes[i]);
      }
    } else if (contextType === 'premises') {
      finalAxes.push(baseRawAxes[i]);
    } else {
      // both (mix) -> 50% chance of swap with implicit inference relation
      if (mutableInferences.length > 0 && Math.random() < 0.5) {
        const idx = Math.floor(Math.random() * mutableInferences.length);
        const chosenInf = mutableInferences.splice(idx, 1)[0];
        finalAxes.push(chosenInf);
      } else {
        finalAxes.push(baseRawAxes[i]);
      }
    }
  }

  const axes = finalAxes;

  // Wording text builder helper
  const makeVehicleText = (cv: any, parentId?: string): string => {
    if (cv.isAnchor) {
      // 70% Independent context preference: (context A is defined as northeast and above)
      // 30% Relational context: (Context A is the relation of item1 and item2)
      if (Math.random() > 0.7) {
        const i1 = cv.boundNode || BetaName;
        const i2 = cv.targetNode || GammaName;
        return `Context ${cv.id} is the relation of ${i1} and ${i2}`;
      } else {
        return `Context ${cv.id} is defined as ${cv.boundRelation.toLowerCase()}`;
      }
    } else {
      // Shift representation: preferring "context B shifts after in Context A"
      const shiftWord = cv.shiftMultiplier > 0 ? 'after' : 'before';
      if (Math.random() > 0.35) {
        return `Context ${cv.id} shifts ${shiftWord} in Context ${parentId}`;
      } else {
        return `Context ${cv.id} is ${shiftWord === 'after' ? 'After' : 'Before'} context ${parentId}`;
      }
    }
  };

  // Tracking effective multipliers on each axis to absolutely prevent unchanged clone duplicate identity context
  const currentAxisMults: Record<number, Set<number>> = {};
  for (let i = 0; i < axes.length; i++) {
    currentAxisMults[i] = new Set<number>([1]); // 1 is identical (base/unchanged context)
  }

  const getValidMultiplier = (axisIndex: number, parentEff: number): number => {
    const pool = [2, -1, -2]; // Only integers to remove mixed scales
    const valid = pool.filter(m => {
      const prospective = parentEff * m;
      if (prospective === 1) return false; // Unchanged duplicated identity
      if (Math.abs(prospective) > 2) return false; // Magnitude constraint
      if (currentAxisMults[axisIndex].has(prospective)) return false; // No duplications
      return true;
    });
    if (valid.length > 0) return valid[Math.floor(Math.random() * valid.length)];
    
    // Final safe fallback that tries to search for another unique value (e.g. including -2 or 2 or negative sign swaps)
    for (const fallback of [-1, 2, -2]) {
      const prospective = parentEff * fallback;
      if (prospective !== 1 && !currentAxisMults[axisIndex].has(prospective)) {
        return fallback;
      }
    }
    return -1; // safe default
  };

  const applyVectorTransform = (
    parentVec: number[],
    parentMults: number[],
    opFactor: number,
    crossVec?: number[]
  ) => {
    const nextMults = [...parentMults];
    const nextVec = [...parentVec];
    for (let i = 0; i < 4; i++) {
      const parentVal = parentVec[i] || 0;
      const shouldTransform = crossVec
        ? (parentVal !== 0 && (crossVec[i] || 0) !== 0)
        : (parentVal !== 0);

      if (shouldTransform) {
        nextMults[i] = parentMults[i] * opFactor;
        nextVec[i] = parentVal * opFactor;
      }
    }
    return { axisMultipliers: nextMults, representedVector: nextVec };
  };

  if (customSettings && customSettings.useCustom) {
    const { anchorCount, shiftsPerAnchor, interrelation } = customSettings;
    const actualAnchorsCount = Math.min(anchorCount, axes.length);

    const levels: any[][] = [];
    levels[0] = [];

    const assignedNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    let nameIdx = 0;

    for (let i = 0; i < actualAnchorsCount; i++) {
      const name = assignedNames[nameIdx++];
      const targetNode = axes[i].targetNode || GammaName;
      const nodeName = axes[i].boundNode;
      const anchorObj = {
        id: name,
        boundRelation: axes[i].boundName,
        boundNode: axes[i].boundNode,
        boundVector: axes[i].boundVector,
        shiftMultiplier: 1,
        shiftLabel: `${nodeName}::${targetNode}`,
        axisIndex: i,
        effectiveMultiplier: 1,
        isAnchor: true,
        text: `Context ${name} = ${nodeName}::${targetNode}`,
        axisMultipliers: [1, 1, 1, 1],
        representedVector: [...axes[i].boundVector]
      };
      anchorObj.axisMultipliers[i] = 1;
      contextVehicles.push(anchorObj);
      levels[0].push(anchorObj);
    }

    for (let j = 1; j <= shiftsPerAnchor; j++) {
      levels[j] = [];
      for (let i = 0; i < actualAnchorsCount; i++) {
        if (nameIdx >= assignedNames.length) break;
        const name = assignedNames[nameIdx++];
        
        const parent = levels[j - 1][i];
        const isScale = Math.random() < 0.05;
        const opFactor = isScale ? 2 : -1;
        const opName = isScale ? 'Scale' : 'Invert';
        
        const shiftObj: any = {
          id: name,
          boundRelation: parent.boundRelation,
          boundNode: parent.boundNode,
          boundVector: parent.boundVector,
          shiftMultiplier: opFactor,
          axisIndex: parent.axisIndex,
          effectiveMultiplier: parent.effectiveMultiplier * opFactor,
          isAnchor: false,
          shiftLabel: `${opName}(${parent.id})`,
          text: `Context ${name} = ${opName}(${parent.id})`,
          axisMultipliers: [1, 1, 1, 1],
          representedVector: [0, 0, 0, 0]
        };
        
        const isCross = interrelation === 'cross' || (interrelation === 'mixed' && Math.random() < 0.5);
        const crossAnchor = (isCross && actualAnchorsCount > 1)
          ? levels[0][(parent.axisIndex + 1) % actualAnchorsCount]
          : undefined;

        if (crossAnchor) {
          shiftObj.shiftLabel = `${opName}(${parent.id}) in Context ${crossAnchor.id}`;
          shiftObj.text = `Context ${name} = ${opName}(${parent.id}) in Context ${crossAnchor.id}`;
        }

        const { axisMultipliers, representedVector } = applyVectorTransform(
          parent.representedVector,
          parent.axisMultipliers,
          opFactor,
          crossAnchor ? crossAnchor.representedVector : undefined
        );
        shiftObj.axisMultipliers = axisMultipliers;
        shiftObj.representedVector = representedVector;
        
        contextVehicles.push(shiftObj);
        levels[j].push(shiftObj);
      }
    }

    const leafLevel = levels[shiftsPerAnchor] || levels[0];
    leafLevel.forEach(cv => {
      activeContextGroup.push(cv.id);
    });

  } else {
    if (difficulty === 'Beginner') {
      const nodeA = axes[0].boundNode;
      const nodeTarget = axes[0].targetNode || GammaName;
      
      const anchor = {
        id: 'A',
        boundRelation: axes[0].boundName,
        boundNode: axes[0].boundNode,
        boundVector: axes[0].boundVector,
        shiftMultiplier: 1,
        shiftLabel: `${nodeA}::${nodeTarget}`,
        axisIndex: 0,
        effectiveMultiplier: 1,
        isAnchor: true,
        text: `Context A = ${nodeA}::${nodeTarget}`,
        axisMultipliers: [1, 1, 1, 1],
        representedVector: [...axes[0].boundVector]
      };
      contextVehicles.push(anchor);

      const isBScale = Math.random() < 0.05;
      const bMult = isBScale ? 2 : -1;
      
      const transformB = applyVectorTransform(anchor.representedVector, anchor.axisMultipliers, bMult);

      const shiftB = {
        id: 'B',
        boundRelation: axes[0].boundName,
        boundNode: axes[0].boundNode,
        boundVector: axes[0].boundVector,
        shiftMultiplier: bMult,
        shiftLabel: isBScale ? 'Scale(A)' : 'Invert(A)',
        axisIndex: 0,
        effectiveMultiplier: bMult,
        isAnchor: false,
        text: isBScale ? 'Context B = Scale(A)' : 'Context B = Invert(A)',
        ...transformB
      };
      contextVehicles.push(shiftB);

      activeContextGroup.push('B');

    } else if (difficulty === 'Intermediate') {
      const nodeA = axes[0].boundNode;
      const nodeTarget = axes[0].targetNode || GammaName;
      
      const anchor = {
        id: 'A',
        boundRelation: axes[0].boundName,
        boundNode: axes[0].boundNode,
        boundVector: axes[0].boundVector,
        shiftMultiplier: 1,
        shiftLabel: `${nodeA}::${nodeTarget}`,
        axisIndex: 0,
        effectiveMultiplier: 1,
        isAnchor: true,
        text: `Context A = ${nodeA}::${nodeTarget}`,
        axisMultipliers: [1, 1, 1, 1],
        representedVector: [...axes[0].boundVector]
      };
      contextVehicles.push(anchor);

      const isBScale = Math.random() < 0.05;
      const bMult = isBScale ? 2 : -1;

      const transformB = applyVectorTransform(anchor.representedVector, anchor.axisMultipliers, bMult);

      const shiftB = {
        id: 'B',
        boundRelation: axes[0].boundName,
        boundNode: axes[0].boundNode,
        boundVector: axes[0].boundVector,
        shiftMultiplier: bMult,
        shiftLabel: isBScale ? 'Scale(A)' : 'Invert(A)',
        axisIndex: 0,
        effectiveMultiplier: bMult,
        isAnchor: false,
        text: isBScale ? 'Context B = Scale(A)' : 'Context B = Invert(A)',
        ...transformB
      };
      contextVehicles.push(shiftB);

      const isCScale = Math.random() < 0.05;
      const cMult = isCScale ? 2 : -1;
      const transformC = applyVectorTransform(shiftB.representedVector, shiftB.axisMultipliers, cMult);

      const shiftC = {
        id: 'C',
        boundRelation: axes[0].boundName,
        boundNode: axes[0].boundNode,
        boundVector: axes[0].boundVector,
        shiftMultiplier: cMult,
        shiftLabel: isCScale ? 'Scale(B)' : 'Invert(B)',
        axisIndex: 0,
        effectiveMultiplier: bMult * cMult,
        isAnchor: false,
        text: isCScale ? 'Context C = Scale(B)' : 'Context C = Invert(B)',
        ...transformC
      };
      contextVehicles.push(shiftC);

      activeContextGroup.push('C');

    } else if (difficulty === 'Advanced') {
      const nodeA = axes[0].boundNode;
      const nodeB = axes[1].boundNode;
      const nodeTarget = axes[0].targetNode || GammaName;
      const nodeTargetB = axes[1].targetNode || GammaName;

      const anchorA = {
        id: 'A',
        boundRelation: axes[0].boundName,
        boundNode: axes[0].boundNode,
        boundVector: axes[0].boundVector,
        shiftMultiplier: 1,
        shiftLabel: `${nodeA}::${nodeTarget}`,
        axisIndex: 0,
        effectiveMultiplier: 1,
        isAnchor: true,
        text: `Context A = ${nodeA}::${nodeTarget}`,
        axisMultipliers: [1, 1, 1, 1],
        representedVector: [...axes[0].boundVector]
      };
      contextVehicles.push(anchorA);

      const anchorB = {
        id: 'B',
        boundRelation: axes[1].boundName,
        boundNode: axes[1].boundNode,
        boundVector: axes[1].boundVector,
        shiftMultiplier: 1,
        shiftLabel: `${nodeB}::${nodeTargetB}`,
        axisIndex: 1,
        effectiveMultiplier: 1,
        isAnchor: true,
        text: `Context B = ${nodeB}::${nodeTargetB}`,
        axisMultipliers: [1, 1, 1, 1],
        representedVector: [...axes[1].boundVector]
      };
      contextVehicles.push(anchorB);

      const transformC = applyVectorTransform(anchorB.representedVector, anchorB.axisMultipliers, -1, anchorA.representedVector);

      const shiftC = {
        id: 'C',
        boundRelation: axes[1].boundName,
        boundNode: axes[1].boundNode,
        boundVector: axes[1].boundVector,
        shiftMultiplier: -1,
        shiftLabel: 'Invert(B) in Context A',
        axisIndex: 1,
        effectiveMultiplier: -1,
        isAnchor: false,
        text: 'Context C = Invert(B) in Context A',
        ...transformC
      };
      contextVehicles.push(shiftC);

      activeContextGroup.push('C');

    } else {
      const nodeA = axes[0].boundNode;
      const nodeB = axes[1].boundNode;
      const nodeTarget = axes[0].targetNode || GammaName;
      const nodeTargetB = axes[1].targetNode || GammaName;

      const anchorA = {
        id: 'A',
        boundRelation: axes[0].boundName,
        boundNode: axes[0].boundNode,
        boundVector: axes[0].boundVector,
        shiftMultiplier: 1,
        shiftLabel: `${nodeA}::${nodeTarget}`,
        axisIndex: 0,
        effectiveMultiplier: 1,
        isAnchor: true,
        text: `Context A = ${nodeA}::${nodeTarget}`,
        axisMultipliers: [1, 1, 1, 1],
        representedVector: [...axes[0].boundVector]
      };
      contextVehicles.push(anchorA);

      const anchorB = {
        id: 'B',
        boundRelation: axes[1].boundName,
        boundNode: axes[1].boundNode,
        boundVector: axes[1].boundVector,
        shiftMultiplier: 1,
        shiftLabel: `${nodeB}::${nodeTargetB}`,
        axisIndex: 1,
        effectiveMultiplier: 1,
        isAnchor: true,
        text: `Context B = ${nodeB}::${nodeTargetB}`,
        axisMultipliers: [1, 1, 1, 1],
        representedVector: [...axes[1].boundVector]
      };
      contextVehicles.push(anchorB);

      const isCScale = Math.random() < 0.05;
      const cMult = isCScale ? 2 : -1;

      const transformC = applyVectorTransform(anchorA.representedVector, anchorA.axisMultipliers, cMult);

      const shiftC = {
        id: 'C',
        boundRelation: axes[0].boundName,
        boundNode: axes[0].boundNode,
        boundVector: axes[0].boundVector,
        shiftMultiplier: cMult,
        shiftLabel: isCScale ? 'Scale(A)' : 'Invert(A)',
        axisIndex: 0,
        effectiveMultiplier: cMult,
        isAnchor: false,
        text: isCScale ? 'Context C = Scale(A)' : 'Context C = Invert(A)',
        ...transformC
      };
      contextVehicles.push(shiftC);

      const isDScale = Math.random() < 0.05;
      const dMult = isDScale ? 2 : -1;

      const transformD = applyVectorTransform(shiftC.representedVector, shiftC.axisMultipliers, dMult, anchorB.representedVector);

      const shiftD = {
        id: 'D',
        boundRelation: axes[1].boundName,
        boundNode: axes[1].boundNode,
        boundVector: axes[1].boundVector,
        shiftMultiplier: dMult,
        shiftLabel: isDScale ? 'Scale(C) in Context B' : 'Invert(C) in Context B',
        axisIndex: 1,
        effectiveMultiplier: dMult,
        isAnchor: false,
        text: isDScale ? 'Context D = Scale(C) in Context B' : 'Context D = Invert(C) in Context B',
        ...transformD
      };
      contextVehicles.push(shiftD);

      activeContextGroup.push('D');
    }
  }

  // Randomly select a subset combination of non-anchor context vehicles, ensuring it's not a direct relative vector (anchor)
  const nonAnchorCandidates = contextVehicles.filter(cv => !cv.isAnchor);
  if (nonAnchorCandidates.length > 0) {
    activeContextGroup.length = 0; // Clear traditional defaults
    // Grab a random or configured amount of elements
    let countToSelect = Math.floor(Math.random() * nonAnchorCandidates.length) + 1;
    
    if (customSettings?.activeContextsCount !== undefined) {
      const cfg = customSettings.activeContextsCount;
      if (cfg === 'eq1') {
        countToSelect = 1;
      } else if (cfg === 'lte2') {
        const mx = Math.min(2, nonAnchorCandidates.length);
        countToSelect = Math.floor(Math.random() * mx) + 1;
      } else if (cfg === 'lte3') {
        const mx = Math.min(3, nonAnchorCandidates.length);
        countToSelect = Math.floor(Math.random() * mx) + 1;
      } else if (cfg === 'lte4') {
        const mx = Math.min(4, nonAnchorCandidates.length);
        countToSelect = Math.floor(Math.random() * mx) + 1;
      } else if (typeof cfg === 'number' && cfg > 0) {
        countToSelect = Math.min(cfg, nonAnchorCandidates.length);
      }
    }

    let selectedVehicles: any[] = [];
    if (countToSelect === 1) {
      // Clean, elegant constraint: always select the last context shift produced
      const lastShift = nonAnchorCandidates[nonAnchorCandidates.length - 1];
      selectedVehicles = [lastShift];
    } else {
      const shuffledNonAnchors = [...nonAnchorCandidates].sort(() => Math.random() - 0.5);
      selectedVehicles = shuffledNonAnchors.slice(0, countToSelect);
    }

    // Sort alphabetically by id to keep letters (like BCD, JKL) nicely presented in final display
    selectedVehicles.sort((a, b) => a.id.localeCompare(b.id));
    selectedVehicles.forEach(cv => {
      activeContextGroup.push(cv.id);
    });
  }

  const aggregateScales = [1, 1, 1, 1];
  contextVehicles.forEach(cv => {
    if (activeContextGroup.includes(cv.id)) {
      for (let idx = 0; idx < dim; idx++) {
        if (cv.axisMultipliers && cv.axisMultipliers[idx] !== undefined) {
          aggregateScales[idx] *= cv.axisMultipliers[idx];
        } else {
          // fallback
          const scaleFactor = cv.effectiveMultiplier !== undefined ? cv.effectiveMultiplier : cv.shiftMultiplier;
          if (cv.boundVector[idx] !== 0) {
            aggregateScales[idx] *= scaleFactor;
          }
        }
      }
    }
  });

  const projectedVector = [
    baseOffsetVector[0] * aggregateScales[0],
    baseOffsetVector[1] * aggregateScales[1],
    baseOffsetVector[2] * aggregateScales[2],
    baseOffsetVector[3] * aggregateScales[3],
  ];

  if (projectedVector.slice(0, dim).every(v => v === 0)) {
    projectedVector[0] = 1;
  }

  const baseRelation = describeContextVector(baseOffsetVector, dim);
  const projectedRelation = describeContextVector(projectedVector, dim);

  const correctOptionText = projectedRelation;
  const incorrectChoices = new Set<string>();

  if (baseRelation !== correctOptionText) {
    incorrectChoices.add(baseRelation);
  }

  const cardinalDistractors = [
    'North', 'South', 'East', 'West', 'Northeast', 'Northwest', 'Southeast', 'Southwest',
    'North-Above', 'South-Below', 'Northeast-Above', 'Southwest-Below', 
    'North-Scaled', 'South-Above-Scaled', 'East-After', 'West-Before',
    'North-After', 'South-Before', 'Northeast-After', 'Southwest-Before-Scaled'
  ];

  while (incorrectChoices.size < 3) {
    const randChoice = cardinalDistractors[Math.floor(Math.random() * cardinalDistractors.length)];
    if (randChoice !== correctOptionText && randChoice !== 'Origin') {
      incorrectChoices.add(randChoice);
    }
  }

  const CARDINAL_VECTOR_MAP: Record<string, number[]> = {
    'North': [1, 0, 0, 0],
    'South': [-1, 0, 0, 0],
    'East': [0, 1, 0, 0],
    'West': [0, -1, 0, 0],
    'Northeast': [1, 1, 0, 0],
    'Northwest': [1, -1, 0, 0],
    'Southeast': [-1, 1, 0, 0],
    'Southwest': [-1, -1, 0, 0],
    'North-Above': [1, 0, 1, 0],
    'South-Below': [-1, 0, -1, 0],
    'Northeast-Above': [1, 1, 1, 0],
    'Southwest-Below': [-1, -1, -1, 0],
    'North-Scaled': [2, 0, 0, 0],
    'South-Above-Scaled': [-2, 0, -2, 0],
    'East-After': [0, 1, 0, 1],
    'West-Before': [0, -1, 0, -1],
    'North-After': [1, 0, 0, 1],
    'South-Before': [-1, 0, 0, -1],
    'Northeast-After': [1, 1, 0, 1],
    'Southwest-Before-Scaled': [-2, -2, 0, -2]
  };

  const options = [
    { text: correctOptionText, isCorrect: true, vector: projectedVector },
    ...Array.from(incorrectChoices).map(txt => ({
      text: txt,
      isCorrect: false,
      vector: CARDINAL_VECTOR_MAP[txt] || [1, 0, 0, 0]
    }))
  ].sort(() => Math.random() - 0.5);

  const nodeDefinitions = rawGeneratedAxes.map(ax => ({
    node: ax.boundNode,
    relation: describeContextVector(ax.boundVector, dim),
    targetNode: ax.targetNode,
    baseOffset: ax.boundVector
  }));

  // Shuffle/scramble the premises according to the scramble setting
  const scramble = customSettings?.scrambleSetting ?? 'full';
  if (scramble === 'full') {
    nodeDefinitions.sort(() => Math.random() - 0.5);
  } else if (scramble === 'partial') {
    // Only shuffle 40% of the time, or swap the first two
    if (Math.random() < 0.4) {
      nodeDefinitions.sort(() => Math.random() - 0.5);
    } else if (nodeDefinitions.length >= 2) {
      const temp = nodeDefinitions[0];
      nodeDefinitions[0] = nodeDefinitions[1];
      nodeDefinitions[1] = temp;
    }
  } else {
    // scramble === 'none': enforce original stable logical/generation order
  }

  return {
    dimension: dim,
    difficulty,
    nodeDefinitions,
    contextVehicles,
    activeContextGroup,
    queryNode,
    queryTarget,
    baseOffsetVector,
    projectedVector,
    baseRelation,
    projectedRelation,
    options
  };
}

function findPathInTree(
  nodeDefs: { node: string; targetNode: string }[],
  start: string,
  end: string
): number[] {
  const adj: Record<string, { to: string; edgeIdx: number }[]> = {};
  for (let i = 0; i < nodeDefs.length; i++) {
    const { node, targetNode } = nodeDefs[i];
    if (!adj[node]) adj[node] = [];
    if (!adj[targetNode]) adj[targetNode] = [];
    adj[node].push({ to: targetNode, edgeIdx: i });
    adj[targetNode].push({ to: node, edgeIdx: i });
  }

  const queue: { current: string; pathEdges: number[] }[] = [{ current: start, pathEdges: [] }];
  const visited = new Set<string>([start]);

  while (queue.length > 0) {
    const { current, pathEdges } = queue.shift()!;
    if (current === end) {
      return pathEdges;
    }
    const neighbors = adj[current] || [];
    for (const edge of neighbors) {
      if (!visited.has(edge.to)) {
        visited.add(edge.to);
        queue.push({
          current: edge.to,
          pathEdges: [...pathEdges, edge.edgeIdx]
        });
      }
    }
  }
  return [];
}

function getContextDependencies(cv: any): string[] {
  const deps = new Set<string>();
  const sources = [cv.shiftLabel || '', cv.text || ''];
  for (const src of sources) {
    // 1. Matches Parent: e.g. Scale(A), Invert(B)
    const parenMatches = src.match(/\(([A-Z])\)/g);
    if (parenMatches) {
      for (const m of parenMatches) {
        const char = m.slice(1, -1);
        deps.add(char);
      }
    }
    // 2. Matches Context X: e.g. Context A, Context B
    const contextMatches = src.match(/Context\s+([A-Z])\b/gi);
    if (contextMatches) {
      for (const m of contextMatches) {
        // Extract the last character (the ID)
        const char = m.trim().slice(-1).toUpperCase();
        deps.add(char);
      }
    }
  }
  // Exclude self id
  deps.delete(cv.id);
  return Array.from(deps);
}

export function generateAnalogyPuzzle(
  dim: DimensionCount,
  difficulty: PuzzleDifficulty,
  customSettings?: {
    useCustom: boolean;
    anchorCount: number;
    anchorDefinitionsCount?: number;
    shiftsPerAnchor: number;
    interrelation: 'chain' | 'cross' | 'mixed';
    scaleType: 'integer' | 'mixed';
    activeContextsCount?: string | number;
    scrambleSetting?: 'none' | 'partial' | 'full';
    contextType?: 'premises' | 'inferences' | 'both';
    analogyContextDepth?: number;
    analogyChainLength?: number;
    analogyStructureType?: 'standard' | 'nested';
  }
): AnalogyPuzzle {
  const useCustom = !!customSettings?.useCustom;
  const configDepth = useCustom ? (customSettings.analogyContextDepth ?? 1) : 1;
  const configLength = useCustom ? (customSettings.analogyChainLength ?? 2) : 2;
  const configStructure = useCustom ? (customSettings.analogyStructureType ?? 'standard') : 'standard';

  let attempts = 0;
  while (attempts < 300) {
    attempts++;
    // Force enough nodes to generate completely disjoint pairs like A:B :: C:D
    const forcedSettings = {
      useCustom: true,
      anchorCount: Math.max(customSettings?.anchorCount || (dim >= 4 ? 6 : 5), 5),
      anchorDefinitionsCount: Math.max(customSettings?.anchorDefinitionsCount || (dim >= 4 ? 6 : 5), 5),
      shiftsPerAnchor: customSettings?.shiftsPerAnchor ?? 2,
      interrelation: customSettings?.interrelation ?? 'cross',
      scaleType: customSettings?.scaleType ?? 'integer',
      activeContextsCount: customSettings?.activeContextsCount ?? 3,
      scrambleSetting: customSettings?.scrambleSetting ?? 'full',
      contextType: customSettings?.contextType ?? 'both'
    };

    const basePuzzle = generateContextPuzzle(dim, difficulty, forcedSettings);
    
    // Resolve coordinates for all nodes to find spatial offsets
    const nodeCoords: Record<string, number[]> = {};
    const nodeNames = Array.from(new Set([
      ...basePuzzle.nodeDefinitions.map(d => d.node),
      ...basePuzzle.nodeDefinitions.map(d => d.targetNode)
    ]));
    
    const firstDef = basePuzzle.nodeDefinitions[0];
    if (!firstDef) continue;
    
    const root = firstDef.targetNode;
    nodeCoords[root] = [0, 0, 0, 0];
    
    let changed = true;
    let limit = 0;
    while (changed && limit < 100) {
      changed = false;
      limit++;
      for (const def of basePuzzle.nodeDefinitions) {
        const u = def.node;
        const v = def.targetNode;
        const offset = def.baseOffset;
        if (nodeCoords[v] !== undefined && nodeCoords[u] === undefined) {
          nodeCoords[u] = [
            nodeCoords[v][0] + offset[0],
            nodeCoords[v][1] + offset[1],
            nodeCoords[v][2] + (offset[2] ?? 0),
            nodeCoords[v][3] + (offset[3] ?? 0)
          ];
          changed = true;
        } else if (nodeCoords[u] !== undefined && nodeCoords[v] === undefined) {
          nodeCoords[v] = [
            nodeCoords[u][0] - offset[0],
            nodeCoords[u][1] - offset[1],
            nodeCoords[u][2] - (offset[2] ?? 0),
            nodeCoords[u][3] - (offset[3] ?? 0)
          ];
          changed = true;
        }
      }
    }
    
    if (Object.keys(nodeCoords).length < nodeNames.length) continue;
    
    const vehicles = basePuzzle.contextVehicles;
    if (vehicles.length < 4) continue;
    
    // Gather all pairwise vector combinations
    const pairs: { u: string; v: string; baseVec: number[] }[] = [];
    for (const u of nodeNames) {
      for (const v of nodeNames) {
        if (u === v) continue;
        const baseVec = [
          nodeCoords[u][0] - nodeCoords[v][0],
          nodeCoords[u][1] - nodeCoords[v][1],
          (nodeCoords[u][2] ?? 0) - (nodeCoords[v][2] ?? 0),
          (nodeCoords[u][3] ?? 0) - (nodeCoords[v][3] ?? 0),
        ];
        pairs.push({ u, v, baseVec });
      }
    }

    // Compose custom groups of vehicles for each category
    const K = configDepth;
    const groupsNeeded = configStructure === 'nested' ? 4 : configLength;
    
    const sampledGroups: typeof vehicles[] = [];
    for (let g = 0; g < groupsNeeded; g++) {
      const shuf = [...vehicles].sort(() => Math.random() - 0.5);
      sampledGroups.push(shuf.slice(0, K));
    }

    const getCompositeModifiers = (grp: typeof vehicles) => {
      const mults = [1, 1, 1, 1];
      for (const v of grp) {
        const m = v.axisMultipliers || [1, 1, 1, 1];
        for (let d = 0; d < 4; d++) {
          mults[d] *= (m[d] ?? 1);
        }
      }
      return mults;
    };
    
    const getCompositeName = (grp: typeof vehicles) => {
      return grp.map(v => v.id).join(' ∘ ');
    };

    const m1 = getCompositeModifiers(sampledGroups[0]);
    const m2 = getCompositeModifiers(sampledGroups[1]);
    const name1 = getCompositeName(sampledGroups[0]);
    const name2 = getCompositeName(sampledGroups[1]);

    const gpProj = (p: typeof pairs[0], mults: number[]) => {
      return [
        p.baseVec[0] * mults[0],
        p.baseVec[1] * mults[1],
        p.baseVec[2] * mults[2],
        p.baseVec[3] * mults[3],
      ];
    };

    if (configStructure === 'nested') {
      const m3 = getCompositeModifiers(sampledGroups[2]);
      const m4 = getCompositeModifiers(sampledGroups[3]);
      const name3 = getCompositeName(sampledGroups[2]);
      const name4 = getCompositeName(sampledGroups[3]);

      // Nested structure: (m1(p1) :: m2(p2)) :: (m3(p3) :: m4(p4))
      const matches: { u1: string; v1: string; u2: string; v2: string; u3: string; v3: string; u4: string; v4: string; diff: number[] }[] = [];

      for (const p1 of pairs) {
        const proj1 = gpProj(p1, m1);
        if (proj1.slice(0, dim).every(val => val === 0)) continue;

        for (const p2 of pairs) {
          if (p1.u === p2.u && p1.v === p2.v) continue;
          const proj2 = gpProj(p2, m2);
          const diff12 = [proj1[0] - proj2[0], proj1[1] - proj2[1], proj1[2] - proj2[2], proj1[3] - proj2[3]];

          for (const p3 of pairs) {
            if (p3.u === p1.u || p3.u === p2.u) continue;
            const proj3 = gpProj(p3, m3);

            for (const p4 of pairs) {
              if (p4.u === p3.u || p4.u === p1.u || p4.u === p2.u) continue;
              const proj4 = gpProj(p4, m4);
              const diff34 = [proj3[0] - proj4[0], proj3[1] - proj4[1], proj3[2] - proj4[2], proj3[3] - proj4[3]];

              let equal = true;
              for (let d = 0; d < dim; d++) {
                if (Math.abs(diff12[d] - diff34[d]) > 1e-5) {
                  equal = false;
                  break;
                }
              }

              if (equal) {
                matches.push({ u1: p1.u, v1: p1.v, u2: p2.u, v2: p2.v, u3: p3.u, v3: p3.v, u4: p4.u, v4: p4.v, diff: diff12 });
              }
            }
          }
        }
      }

      if (matches.length > 0) {
        const chosen = matches[Math.floor(Math.random() * matches.length)];
        const isTrueAnalogy = Math.random() < 0.5;
        const correctNode = chosen.v4;
        let presentedNodeH = '';

        if (isTrueAnalogy) {
          presentedNodeH = correctNode;
        } else {
          // Choose someone else that breaks it
          const wrongCandidates = nodeNames.filter(n => n !== chosen.u4 && n !== correctNode && n !== chosen.u1 && n !== chosen.v1);
          presentedNodeH = wrongCandidates.length > 0 ? wrongCandidates[Math.floor(Math.random() * wrongCandidates.length)] : 'Delta';
        }

        const u1_coords = nodeCoords[chosen.u1];
        const v1_coords = nodeCoords[chosen.v1];
        const u2_coords = nodeCoords[chosen.u2];
        const v2_coords = nodeCoords[chosen.v2];
        const u3_coords = nodeCoords[chosen.u3];
        const v3_coords = nodeCoords[chosen.v3];
        const u4_coords = nodeCoords[chosen.u4];
        const v4_coords = nodeCoords[presentedNodeH] || [0, 0, 0, 0];

        const p1_base = [u1_coords[0] - v1_coords[0], u1_coords[1] - v1_coords[1], u1_coords[2] - v1_coords[2], u1_coords[3] - v1_coords[3]];
        const p2_base = [u2_coords[0] - v2_coords[0], u2_coords[1] - v2_coords[1], u2_coords[2] - v2_coords[2], u2_coords[3] - v2_coords[3]];
        const p3_base = [u3_coords[0] - v3_coords[0], u3_coords[1] - v3_coords[1], u3_coords[2] - v3_coords[2], u3_coords[3] - v3_coords[3]];
        const p4_base = [u4_coords[0] - v4_coords[0], u4_coords[1] - v4_coords[1], u4_coords[2] - v4_coords[2], u4_coords[3] - v4_coords[3]];

        const proj1 = gpProj({ u: chosen.u1, v: chosen.v1, baseVec: p1_base }, m1);
        const proj2 = gpProj({ u: chosen.u2, v: chosen.v2, baseVec: p2_base }, m2);
        const proj3 = gpProj({ u: chosen.u3, v: chosen.v3, baseVec: p3_base }, m3);
        const proj4 = gpProj({ u: chosen.u4, v: presentedNodeH, baseVec: p4_base }, m4);

        const diffLeft = [proj1[0] - proj2[0], proj1[1] - proj2[1], proj1[2] - proj2[2], proj1[3] - proj2[3]];
        const diffRight = [proj3[0] - proj4[0], proj3[1] - proj4[1], proj3[2] - proj4[2], proj3[3] - proj4[3]];

        const options = [
          { text: 'True', isCorrect: isTrueAnalogy },
          { text: 'False', isCorrect: !isTrueAnalogy }
        ];

        const explainedSteps = [
          `### Step 1: Left Meta Relation (Context ${name1}(${chosen.u1}:${chosen.v1}) :: Context ${name2}(${chosen.u2}:${chosen.v2}))`,
          `• **Term 1 (${chosen.u1}:${chosen.v1})** baseline vector $[${p1_base.slice(0,dim).join(',')}]$, projected multiplier $[${m1.slice(0,dim).join(',')}]$, vector: $[${proj1.slice(0,dim).join(',')}]$\n` +
          `• **Term 2 (${chosen.u2}:${chosen.v2})** baseline vector $[${p2_base.slice(0,dim).join(',')}]$, projected multiplier $[${m2.slice(0,dim).join(',')}]$, vector: $[${proj2.slice(0,dim).join(',')}]$\n` +
          `• **Left Congruence Offset**: $[${diffLeft.slice(0,dim).join(',')}]$`,
          `### Step 2: Right Meta Relation (Context ${name3}(${chosen.u3}:${chosen.v3}) :: Context ${name4}(${chosen.u4}:${presentedNodeH}))`,
          `• **Term 3 (${chosen.u3}:${chosen.v3})** baseline vector $[${p3_base.slice(0,dim).join(',')}]$, projected multiplier $[${m3.slice(0,dim).join(',')}]$, vector: $[${proj3.slice(0,dim).join(',')}]$\n` +
          `• **Term 4 (${chosen.u4}:${presentedNodeH})** baseline vector $[${p4_base.slice(0,dim).join(',')}]$, projected multiplier $[${m4.slice(0,dim).join(',')}]$, vector: $[${proj4.slice(0,dim).join(',')}]$\n` +
          `• **Right Congruence Offset**: $[${diffRight.slice(0,dim).join(',')}]$`,
          `### Step 3: Meta Alignment Evaluation`,
          isTrueAnalogy
            ? `• Since Left Offset ($[${diffLeft.slice(0,dim).join(',')}]$) **is perfectly consistent** with Right Offset ($[${diffRight.slice(0,dim).join(',')}]$), the meta-analogy chain statement is **TRUE**.`
            : `• Since Left Offset ($[${diffLeft.slice(0,dim).join(',')}]$) **is not consistent** with Right Offset ($[${diffRight.slice(0,dim).join(',')}]$), the meta-analogy chain statement is **FALSE**.`
        ];

        const requiredContextIds = new Set<string>();
        for (const grp of sampledGroups) {
          for (const v of grp) {
            requiredContextIds.add(v.id);
          }
        }

        const visitedCtx = new Set<string>();
        const queueCtx = Array.from(requiredContextIds);
        while (queueCtx.length > 0) {
          const currentId = queueCtx.shift()!;
          if (visitedCtx.has(currentId)) continue;
          visitedCtx.add(currentId);
          const cv = basePuzzle.contextVehicles.find(v => v.id === currentId);
          if (cv) {
            const deps = getContextDependencies(cv);
            for (const depId of deps) {
              requiredContextIds.add(depId);
              if (!visitedCtx.has(depId)) {
                queueCtx.push(depId);
              }
            }
          }
        }

        return {
          dimension: dim,
          difficulty,
          nodeDefinitions: basePuzzle.nodeDefinitions,
          contextVehicles: basePuzzle.contextVehicles.filter(ctx => requiredContextIds.has(ctx.id)),
          context1: name1,
          nodeA: chosen.u1,
          nodeB: chosen.v1,
          context2: name2,
          nodeC: chosen.u2,
          nodeD: chosen.v2,
          context3: name3,
          nodeE: chosen.u3,
          nodeF: chosen.v3,
          context4: name4,
          nodeG: chosen.u4,
          nodeH: presentedNodeH,
          isTrueAnalogy,
          correctAnswerNode: correctNode,
          options,
          explanation: explainedSteps.join('\n\n'),
          baseVector: p1_base,
          projectedVector: proj1,
          baseRelationName: describeContextVector(p1_base, dim),
          projectedRelationName: describeContextVector(proj1, dim),
          context1Modifiers: m1,
          context2Modifiers: m2,
          context2BaseVector: p2_base,
          context3Modifiers: m3,
          context3BaseVector: p3_base,
          context4Modifiers: m4,
          context4BaseVector: p4_base,
          analogyChainLength: configLength,
          analogyStructureType: configStructure,
          analogyContextDepth: configDepth
        };
      }
    } else {
      // Standard structure with chain length configLength (e.g., 2 or 3)
      if (configLength === 3) {
        const m3 = getCompositeModifiers(sampledGroups[2]);
        const name3 = getCompositeName(sampledGroups[2]);

        const matches: {
          u1: string; v1: string; proj1: number[];
          u2: string; v2: string; proj2: number[];
          u3: string; v3: string; proj3: number[];
        }[] = [];

        for (const p1 of pairs) {
          const proj1 = gpProj(p1, m1);
          if (proj1.slice(0, dim).every(val => val === 0)) continue;

          for (const p2 of pairs) {
            if (p1.u === p2.u && p1.v === p2.v) continue;
            const proj2 = gpProj(p2, m2);

            let equal12 = true;
            for (let d = 0; d < dim; d++) {
              if (Math.abs(proj1[d] - proj2[d]) > 1e-5) {
                equal12 = false;
                break;
              }
            }
            if (!equal12) continue;

            for (const p3 of pairs) {
              if (p3.u === p1.u || p3.u === p2.u) continue;
              const proj3 = gpProj(p3, m3);

              let equal23 = true;
              for (let d = 0; d < dim; d++) {
                if (Math.abs(proj2[d] - proj3[d]) > 1e-5) {
                  equal23 = false;
                  break;
                }
              }

              if (equal23) {
                matches.push({ u1: p1.u, v1: p1.v, proj1, u2: p2.u, v2: p2.v, proj2, u3: p3.u, v3: p3.v, proj3 });
              }
            }
          }
        }

        if (matches.length > 0) {
          const chosen = matches[Math.floor(Math.random() * matches.length)];
          const correctNode = chosen.v3;
          const isTrueAnalogy = Math.random() < 0.5;
          let presentedNodeF = '';

          if (isTrueAnalogy) {
            presentedNodeF = correctNode;
          } else {
            const wrongCandidates = nodeNames.filter(n => n !== chosen.u3 && n !== correctNode && n !== chosen.u1 && n !== chosen.v1);
            presentedNodeF = wrongCandidates.length > 0 ? wrongCandidates[Math.floor(Math.random() * wrongCandidates.length)] : 'Delta';
          }

          const u1_coords = nodeCoords[chosen.u1];
          const v1_coords = nodeCoords[chosen.v1];
          const u2_coords = nodeCoords[chosen.u2];
          const v2_coords = nodeCoords[chosen.v2];
          const u3_coords = nodeCoords[chosen.u3];
          const v3_coords = nodeCoords[presentedNodeF] || [0, 0, 0, 0];

          const p1_base = [u1_coords[0] - v1_coords[0], u1_coords[1] - v1_coords[1], u1_coords[2] - v1_coords[2], u1_coords[3] - v1_coords[3]];
          const p2_base = [u2_coords[0] - v2_coords[0], u2_coords[1] - v2_coords[1], u2_coords[2] - v2_coords[2], u2_coords[3] - v2_coords[3]];
          const p3_base = [u3_coords[0] - v3_coords[0], u3_coords[1] - v3_coords[1], u3_coords[2] - v3_coords[2], u3_coords[3] - v3_coords[3]];

          const proj3 = gpProj({ u: chosen.u3, v: presentedNodeF, baseVec: p3_base }, m3);

          const c1_relation = describeContextVector(chosen.proj1, dim);
          const c2_relation = describeContextVector(chosen.proj2, dim);
          const c3_relation = describeContextVector(proj3, dim);

          const options = [
            { text: 'True', isCorrect: isTrueAnalogy },
            { text: 'False', isCorrect: !isTrueAnalogy }
          ];

          const explainedSteps = [
            `### Step 1: Analyze Term 1 (${chosen.u1} : ${chosen.v1} under Context ${name1})`,
            `• Baseline vector $[${p1_base.slice(0,dim).join(',')}]$, projected multiplier $[${m1.slice(0,dim).join(',')}]$, vector: $[${chosen.proj1.slice(0,dim).join(',')}]$ (**${c1_relation}**)\n`,
            `### Step 2: Analyze Term 2 (${chosen.u2} : ${chosen.v2} under Context ${name2})`,
            `• Baseline vector $[${p2_base.slice(0,dim).join(',')}]$, projected multiplier $[${m2.slice(0,dim).join(',')}]$, vector: $[${chosen.proj2.slice(0,dim).join(',')}]$ (**${c2_relation}**)\n`,
            `### Step 3: Analyze Term 3 (${chosen.u3} : ${presentedNodeF} under Context ${name3})`,
            `• Baseline vector $[${p3_base.slice(0,dim).join(',')}]$, projected multiplier $[${m3.slice(0,dim).join(',')}]$, vector: $[${proj3.slice(0,dim).join(',')}]$ (**${c3_relation}**)\n`,
            `### Step 4: Triple Chain Alignment`,
            isTrueAnalogy
              ? `• Since both transitions match each other perfectly ($[${chosen.proj1.slice(0,dim).join(',')}]$ ≈ $[${chosen.proj2.slice(0,dim).join(',')}]$ ≈ $[${proj3.slice(0,dim).join(',')}]$), the 3-chain analogy holds **TRUE**.`
              : `• Since Term 3's projected relation ($[${proj3.slice(0,dim).join(',')}]$: **${c3_relation}**) does not match the standard ($[${chosen.proj1.slice(0,dim).join(',')}]$), the analogy holds **FALSE**.`
          ];

          const requiredContextIds = new Set<string>();
          for (const grp of [sampledGroups[0], sampledGroups[1], sampledGroups[2]]) {
            for (const v of grp) {
              requiredContextIds.add(v.id);
            }
          }

          const visitedCtx = new Set<string>();
          const queueCtx = Array.from(requiredContextIds);
          while (queueCtx.length > 0) {
            const currentId = queueCtx.shift()!;
            if (visitedCtx.has(currentId)) continue;
            visitedCtx.add(currentId);
            const cv = basePuzzle.contextVehicles.find(v => v.id === currentId);
            if (cv) {
              const deps = getContextDependencies(cv);
              for (const depId of deps) {
                requiredContextIds.add(depId);
                if (!visitedCtx.has(depId)) {
                  queueCtx.push(depId);
                }
              }
            }
          }

          return {
            dimension: dim,
            difficulty,
            nodeDefinitions: basePuzzle.nodeDefinitions,
            contextVehicles: basePuzzle.contextVehicles.filter(ctx => requiredContextIds.has(ctx.id)),
            context1: name1,
            nodeA: chosen.u1,
            nodeB: chosen.v1,
            context2: name2,
            nodeC: chosen.u2,
            nodeD: chosen.v2,
            context3: name3,
            nodeE: chosen.u3,
            nodeF: presentedNodeF,
            isTrueAnalogy,
            correctAnswerNode: correctNode,
            options,
            explanation: explainedSteps.join('\n\n'),
            baseVector: p1_base,
            projectedVector: chosen.proj1,
            baseRelationName: describeContextVector(p1_base, dim),
            projectedRelationName: c1_relation,
            context1Modifiers: m1,
            context2Modifiers: m2,
            context2BaseVector: p2_base,
            context3Modifiers: m3,
            context3BaseVector: p3_base,
            analogyChainLength: configLength,
            analogyStructureType: configStructure,
            analogyContextDepth: configDepth
          };
        }
      } else {
        // Standard length 2
        const matches: {
          ctx1: string; m1: number[]; u1: string; v1: string; proj1: number[];
          ctx2: string; m2: number[]; u2: string; v2: string; proj2: number[];
        }[] = [];

        for (const p1 of pairs) {
          const proj1 = gpProj(p1, m1);
          if (proj1.slice(0, dim).every(val => val === 0)) continue;

          for (const p2 of pairs) {
            if (p1.u === p2.u && p1.v === p2.v) continue;
            const proj2 = gpProj(p2, m2);

            let equal = true;
            for (let d = 0; d < dim; d++) {
              if (Math.abs(proj1[d] - proj2[d]) > 1e-5) {
                equal = false;
                break;
              }
            }

            if (equal) {
              matches.push({
                ctx1: name1, m1, u1: p1.u, v1: p1.v, proj1,
                ctx2: name2, m2, u2: p2.u, v2: p2.v, proj2
              });
            }
          }
        }

        if (matches.length > 0) {
          let uniqueNodeMatches = matches.filter(m => 
            m.u1 !== m.u2 && m.u1 !== m.v2 && 
            m.v1 !== m.u2 && m.v1 !== m.v2
          );
          if (uniqueNodeMatches.length === 0) {
            uniqueNodeMatches = matches.filter(m => 
              !(m.u1 === m.u2 && m.v1 === m.v2) && 
              !(m.u1 === m.v2 && m.v1 === m.u2)
            );
          }

          const chosen = uniqueNodeMatches.length > 0
            ? uniqueNodeMatches[Math.floor(Math.random() * uniqueNodeMatches.length)]
            : matches[Math.floor(Math.random() * matches.length)];

          const correctNode = chosen.v2;
          const isTrueAnalogy = Math.random() < 0.5;
          let presentedNodeD = '';

          if (isTrueAnalogy) {
            presentedNodeD = correctNode;
          } else {
            const incorrectCandidates = nodeNames.filter(n => {
              if (n === chosen.u2 || n === correctNode) return false;
              const baseVec = [
                nodeCoords[chosen.u2][0] - nodeCoords[n][0],
                nodeCoords[chosen.u2][1] - nodeCoords[n][1],
                (nodeCoords[chosen.u2][2] ?? 0) - (nodeCoords[n][2] ?? 0),
                (nodeCoords[chosen.u2][3] ?? 0) - (nodeCoords[n][3] ?? 0),
              ];
              const projC2Temp = gpProj({ u: chosen.u2, v: n, baseVec }, m2);
              let match = true;
              for (let d = 0; d < dim; d++) {
                if (Math.abs(chosen.proj1[d] - projC2Temp[d]) > 1e-5) {
                  match = false;
                  break;
                }
              }
              return !match;
            });

            const preferredIncorrect = incorrectCandidates.filter(n => n !== chosen.u1 && n !== chosen.v1);
            if (preferredIncorrect.length > 0) {
              presentedNodeD = preferredIncorrect[Math.floor(Math.random() * preferredIncorrect.length)];
            } else if (incorrectCandidates.length > 0) {
              presentedNodeD = incorrectCandidates[Math.floor(Math.random() * incorrectCandidates.length)];
            } else {
              const fallbackCandidates = nodeNames.filter(n => n !== correctNode && n !== chosen.u2);
              presentedNodeD = fallbackCandidates.length > 0
                ? fallbackCandidates[Math.floor(Math.random() * fallbackCandidates.length)]
                : 'Delta';
            }
          }

          const u1_coords = nodeCoords[chosen.u1];
          const v1_coords = nodeCoords[chosen.v1];
          const u2_coords = nodeCoords[chosen.u2];
          const v2_coords = nodeCoords[presentedNodeD] || [0, 0, 0, 0];

          const baseVecC1 = [u1_coords[0] - v1_coords[0], u1_coords[1] - v1_coords[1], u1_coords[2] - v1_coords[2], u1_coords[3] - v1_coords[3]];
          const baseVecC2 = [u2_coords[0] - v2_coords[0], u2_coords[1] - v2_coords[1], u2_coords[2] - v2_coords[2], u2_coords[3] - v2_coords[3]];

          const projC2 = gpProj({ u: chosen.u2, v: presentedNodeD, baseVec: baseVecC2 }, m2);

          const c1_relation = describeContextVector(chosen.proj1, dim);
          const c2_relation = describeContextVector(projC2, dim);

          const options = [
            { text: 'True', isCorrect: isTrueAnalogy },
            { text: 'False', isCorrect: !isTrueAnalogy }
          ];

          const explainedSteps = [
            `### Step 1: Analyze Term 1 (${chosen.u1} : ${chosen.v1} under Context ${chosen.ctx1})`,
            `• Baseline vector $[${baseVecC1.slice(0,dim).join(',')}]$, projected multiplier $[${m1.slice(0,dim).join(',')}]$, vector: $[${chosen.proj1.slice(0,dim).join(',')}]$ (**${c1_relation}**)\n`,
            `### Step 2: Analyze Term 2 (${chosen.u2} : ${presentedNodeD} under Context ${chosen.ctx2})`,
            `• Baseline vector $[${baseVecC2.slice(0,dim).join(',')}]$, projected multiplier $[${m2.slice(0,dim).join(',')}]$, vector: $[${projC2.slice(0,dim).join(',')}]$ (**${c2_relation}**)\n`,
            `### Step 3: Proportional Evaluation`,
            isTrueAnalogy
              ? `• Since the vector for Term 1 under Context ${chosen.ctx1} matches exactly with Term 2 under Context ${chosen.ctx2}, the analogy holds **TRUE**.`
              : `• Since the vector for Term 1 under Context ${chosen.ctx1} ($[${chosen.proj1.slice(0,dim).join(',')}]$) does not match Term 2 ($[${projC2.slice(0,dim).join(',')}]$), the analogy holds **FALSE**.`
          ];

          const requiredContextIds = new Set<string>();
          for (const grp of [sampledGroups[0], sampledGroups[1]]) {
            for (const v of grp) {
              requiredContextIds.add(v.id);
            }
          }

          const visitedCtx = new Set<string>();
          const queueCtx = Array.from(requiredContextIds);
          while (queueCtx.length > 0) {
            const currentId = queueCtx.shift()!;
            if (visitedCtx.has(currentId)) continue;
            visitedCtx.add(currentId);
            const cv = basePuzzle.contextVehicles.find(v => v.id === currentId);
            if (cv) {
              const deps = getContextDependencies(cv);
              for (const depId of deps) {
                requiredContextIds.add(depId);
                if (!visitedCtx.has(depId)) {
                  queueCtx.push(depId);
                }
              }
            }
          }

          return {
            dimension: dim,
            difficulty,
            nodeDefinitions: basePuzzle.nodeDefinitions,
            contextVehicles: basePuzzle.contextVehicles.filter(ctx => requiredContextIds.has(ctx.id)),
            context1: chosen.ctx1,
            nodeA: chosen.u1,
            nodeB: chosen.v1,
            context2: chosen.ctx2,
            nodeC: chosen.u2,
            nodeD: presentedNodeD,
            isTrueAnalogy,
            correctAnswerNode: correctNode,
            options,
            explanation: explainedSteps.join('\n\n'),
            baseVector: baseVecC1,
            projectedVector: chosen.proj1,
            baseRelationName: describeContextVector(baseVecC1, dim),
            projectedRelationName: c1_relation,
            context1Modifiers: m1,
            context2Modifiers: m2,
            context2BaseVector: baseVecC2,
            analogyChainLength: configLength,
            analogyStructureType: configStructure,
            analogyContextDepth: configDepth
          };
        }
      }
    }
  }
  
  const basePuzzle = generateContextPuzzle(dim, difficulty, customSettings);

  const fallbackRequiredIds = new Set<string>(['A', 'B']);
  const fbVisited = new Set<string>();
  const fbQueue = ['A', 'B'];
  
  while (fbQueue.length > 0) {
    const currentId = fbQueue.shift()!;
    if (fbVisited.has(currentId)) continue;
    fbVisited.add(currentId);
    
    const cv = basePuzzle.contextVehicles.find(v => v.id === currentId);
    if (cv) {
      const deps = getContextDependencies(cv);
      for (const depId of deps) {
        fallbackRequiredIds.add(depId);
        if (!fbVisited.has(depId)) {
          fbQueue.push(depId);
        }
      }
    }
  }

  const filteredContextVehicles = basePuzzle.contextVehicles.filter(
    ctx => fallbackRequiredIds.has(ctx.id)
  );

  return {
    dimension: dim,
    difficulty,
    nodeDefinitions: basePuzzle.nodeDefinitions,
    contextVehicles: filteredContextVehicles,
    context1: 'A',
    nodeA: 'Alpha',
    nodeB: 'Beta',
    context2: 'B',
    nodeC: 'Gamma',
    nodeD: 'Delta',
    isTrueAnalogy: true,
    correctAnswerNode: 'Delta',
    options: [
      { text: 'True', isCorrect: true },
      { text: 'False', isCorrect: false }
    ],
    explanation: "Fallback analogy matches base relations.",
    baseVector: [1, 0, 0, 0],
    projectedVector: [1, 0, 0, 0],
    baseRelationName: 'North',
    projectedRelationName: 'North',
    context1Modifiers: [1, 1, 1, 1],
    context2Modifiers: [1, 1, 1, 1],
    context2BaseVector: [1, 0, 0, 0]
  };
}

// === LOCAL TRANSLATION HELPERS FOR ABSTRACT MODE ===

function translatePuzzleToAbstract(
  puzzle: Puzzle,
  mapping: AbstractRelationMapping,
  dimension: DimensionCount,
  scramble?: boolean
): Puzzle {
  return {
    ...puzzle,
    premises: puzzle.premises.map(p => ({
      ...p,
      relation: translateStandardRelationToAbstract(p.relation, mapping, dimension, scramble)
    })),
    options: puzzle.options.map(o => ({
      ...o,
      relation: translateStandardRelationToAbstract(o.relation, mapping, dimension, scramble)
    })),
    explanation: translateTextToAbstract(puzzle.explanation, mapping, dimension, scramble)
  };
}

function translateContextPuzzleToAbstract(
  puzzle: ContextPuzzle,
  mapping: AbstractRelationMapping,
  dimension: DimensionCount,
  scramble?: boolean
): ContextPuzzle {
  return {
    ...puzzle,
    nodeDefinitions: puzzle.nodeDefinitions.map(n => ({
      ...n,
      relation: translateStandardRelationToAbstract(n.relation, mapping, dimension, scramble)
    })),
    contextVehicles: puzzle.contextVehicles.map(v => ({
      ...v,
      boundRelation: translateStandardRelationToAbstract(v.boundRelation, mapping, dimension, scramble)
    })),
    baseRelation: translateStandardRelationToAbstract(puzzle.baseRelation, mapping, dimension, scramble),
    projectedRelation: translateStandardRelationToAbstract(puzzle.projectedRelation, mapping, dimension, scramble),
    options: puzzle.options.map(o => ({
      ...o,
      text: translateStandardRelationToAbstract(o.text, mapping, dimension, scramble)
    }))
  };
}

function translateAnalogyPuzzleToAbstract(
  puzzle: AnalogyPuzzle,
  mapping: AbstractRelationMapping,
  dimension: DimensionCount,
  scramble?: boolean
): AnalogyPuzzle {
  return {
    ...puzzle,
    nodeDefinitions: puzzle.nodeDefinitions.map(n => ({
      ...n,
      relation: translateStandardRelationToAbstract(n.relation, mapping, dimension, scramble)
    })),
    contextVehicles: puzzle.contextVehicles.map(v => ({
      ...v,
      boundRelation: translateStandardRelationToAbstract(v.boundRelation, mapping, dimension, scramble)
    })),
    baseRelationName: translateStandardRelationToAbstract(puzzle.baseRelationName, mapping, dimension, scramble),
    projectedRelationName: translateStandardRelationToAbstract(puzzle.projectedRelationName, mapping, dimension, scramble),
    options: puzzle.options.map(o => ({
      ...o,
      text: translateStandardRelationToAbstract(o.text, mapping, dimension, scramble)
    })),
    explanation: translateTextToAbstract(puzzle.explanation, mapping, dimension, scramble)
  };
}

// === LOCAL SCRAMBLING HELPERS FOR STANDARD MODE ===

function scramblePuzzleStandard(
  puzzle: Puzzle,
  dimension: DimensionCount,
  scramble?: boolean
): Puzzle {
  if (!scramble) return puzzle;
  return {
    ...puzzle,
    premises: puzzle.premises.map(p => ({
      ...p,
      relation: scrambleStandardRelation(p.relation, dimension, true)
    })),
    options: puzzle.options.map(o => ({
      ...o,
      relation: scrambleStandardRelation(o.relation, dimension, true)
    })),
    explanation: scrambleTextStandard(puzzle.explanation, dimension, true)
  };
}

function scrambleContextPuzzleStandard(
  puzzle: ContextPuzzle,
  dimension: DimensionCount,
  scramble?: boolean
): ContextPuzzle {
  if (!scramble) return puzzle;
  return {
    ...puzzle,
    nodeDefinitions: puzzle.nodeDefinitions.map(n => ({
      ...n,
      relation: scrambleStandardRelation(n.relation, dimension, true)
    })),
    contextVehicles: puzzle.contextVehicles.map(v => ({
      ...v,
      boundRelation: scrambleStandardRelation(v.boundRelation, dimension, true)
    })),
    baseRelation: scrambleStandardRelation(puzzle.baseRelation, dimension, true),
    projectedRelation: scrambleStandardRelation(puzzle.projectedRelation, dimension, true),
    options: puzzle.options.map(o => ({
      ...o,
      text: scrambleStandardRelation(o.text, dimension, true)
    }))
  };
}

function scrambleAnalogyPuzzleStandard(
  puzzle: AnalogyPuzzle,
  dimension: DimensionCount,
  scramble?: boolean
): AnalogyPuzzle {
  if (!scramble) return puzzle;
  return {
    ...puzzle,
    nodeDefinitions: puzzle.nodeDefinitions.map(n => ({
      ...n,
      relation: scrambleStandardRelation(n.relation, dimension, true)
    })),
    contextVehicles: puzzle.contextVehicles.map(v => ({
      ...v,
      boundRelation: scrambleStandardRelation(v.boundRelation, dimension, true)
    })),
    baseRelationName: scrambleStandardRelation(puzzle.baseRelationName, dimension, true),
    projectedRelationName: scrambleStandardRelation(puzzle.projectedRelationName, dimension, true),
    options: puzzle.options.map(o => ({
      ...o,
      text: scrambleStandardRelation(o.text, dimension, true)
    })),
    explanation: scrambleTextStandard(puzzle.explanation, dimension, true)
  };
}

export default function TrainingWorkspace({
  stats,
  onUpdateStats,
  setDimension,
  setSelectedPremises,
  setHighlightedPremiseId,
  workoutMode,
  setWorkoutMode,
  onUpdateContextDetails,
  isSubmitted,
  setIsSubmitted,
  abstractRelationsEnabled,
  abstractMapping,
  onRegenerateAbstractMapping,
  scrambleComponentOrder
}: TrainingWorkspaceProps) {
  const [selectedDim, setSelectedDim] = useState<DimensionCount>(2);
  const [difficulty, setDifficulty] = useState<PuzzleDifficulty>('Beginner');

  // Custom configuration states
  const [generatorMode, setGeneratorMode] = useState<'preset' | 'custom'>('preset');
  const [customAnchorDefinitions, setCustomAnchorDefinitions] = useState<number>(4);
  const [customAnchors, setCustomAnchors] = useState<number>(2);
  const [customShiftsCount, setCustomShiftsCount] = useState<number>(2);
  const [customInterrelation, setCustomInterrelation] = useState<'chain' | 'cross' | 'mixed'>('chain');
  const [customActiveCount, setCustomActiveCount] = useState<string | number>('random');
  const [scrambleSetting, setScrambleSetting] = useState<'none' | 'partial' | 'full'>('full');
  const [contextType, setContextType] = useState<'premises' | 'inferences' | 'both'>('both');
  
  // Custom analogy settings
  const [customAnalogyDepth, setCustomAnalogyDepth] = useState<number>(1);
  const [customAnalogyLength, setCustomAnalogyLength] = useState<number>(2);
  const [customAnalogyStructure, setCustomAnalogyStructure] = useState<'standard' | 'nested'>('standard');
  
  const [currentPuzzle, setCurrentPuzzle] = useState<Puzzle | null>(null);
  const [selectedAnswerIdx, setSelectedAnswerIdx] = useState<number | null>(null);

  const [currentCtxPuzzle, setCurrentCtxPuzzle] = useState<ContextPuzzle | null>(null);
  const [selectedCtxAnswerIdx, setSelectedCtxAnswerIdx] = useState<number | null>(null);
  const [showCtxExplanation, setShowCtxExplanation] = useState<boolean>(false);

  const [currentAnalogyPuzzle, setCurrentAnalogyPuzzle] = useState<AnalogyPuzzle | null>(null);
  const [selectedAnalogyAnswerIdx, setSelectedAnalogyAnswerIdx] = useState<number | null>(null);
  const [showAnalogyExplanation, setShowAnalogyExplanation] = useState<boolean>(false);
  const [activeAnalogyTab, setActiveAnalogyTab] = useState<'ctx1' | 'ctx2' | 'ctx3' | 'ctx4'>('ctx1');

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [carouselIndex, setCarouselIndex] = useState<number>(0);
  const [innerCarouselEnabled, setInnerCarouselEnabled] = useState<boolean>(true);
  const [innerPremiseIndex, setInnerPremiseIndex] = useState<number>(0);
  const [innerModifierIndex, setInnerModifierIndex] = useState<number>(0);
  const [innerStage3Index, setInnerStage3Index] = useState<number>(0);
  const [seconds, setSeconds] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setInnerPremiseIndex(0);
    setInnerModifierIndex(0);
    setInnerStage3Index(0);
  }, [carouselIndex, workoutMode, currentPuzzle, currentCtxPuzzle, currentAnalogyPuzzle]);

  const handleStartTraining = () => {
    setIsPlaying(true);
    setCarouselIndex(0);
    setDimension(selectedDim);
    setShowCtxExplanation(false);
    setShowAnalogyExplanation(false);

    let activeMapping = abstractMapping;
    if (abstractRelationsEnabled) {
      const freshMapping = generateAbstractMapping();
      onRegenerateAbstractMapping(freshMapping);
      activeMapping = freshMapping;
    }

    if (workoutMode === 'classic') {
      const useCustomParams = generatorMode === 'custom';
      const customNodeCount = useCustomParams ? (customAnchors + 1) : undefined;
      const customScrambleSetting = useCustomParams ? scrambleSetting : undefined;
      let newPuzzle = generateTrainerPuzzle(selectedDim, difficulty, customNodeCount, customScrambleSetting, scrambleComponentOrder);
      if (abstractRelationsEnabled) {
        newPuzzle = translatePuzzleToAbstract(newPuzzle, activeMapping, selectedDim, scrambleComponentOrder);
      } else if (scrambleComponentOrder) {
        newPuzzle = scramblePuzzleStandard(newPuzzle, selectedDim, scrambleComponentOrder);
      }
      const visualPremises = newPuzzle.premises.map((p, idx) => ({
        id: `pzp-${idx}`,
        entityA: p.entityA,
        relation: p.relation,
        entityB: p.entityB
      }));
      setSelectedPremises(visualPremises);
      setHighlightedPremiseId(null);
      setCurrentPuzzle(newPuzzle);
      setSelectedAnswerIdx(null);
      setIsSubmitted(false);
      setSeconds(0);
    } else if (workoutMode === 'context') {
      let newCtxPuzzle = generateContextPuzzle(selectedDim, difficulty, {
        useCustom: generatorMode === 'custom',
        anchorCount: customAnchors,
        anchorDefinitionsCount: customAnchorDefinitions,
        shiftsPerAnchor: customShiftsCount,
        interrelation: customInterrelation,
        scaleType: 'integer',
        activeContextsCount: customActiveCount,
        scrambleSetting: scrambleSetting,
        contextType: contextType
      });
      if (abstractRelationsEnabled) {
        newCtxPuzzle = translateContextPuzzleToAbstract(newCtxPuzzle, activeMapping, selectedDim, scrambleComponentOrder);
      } else if (scrambleComponentOrder) {
        newCtxPuzzle = scrambleContextPuzzleStandard(newCtxPuzzle, selectedDim, scrambleComponentOrder);
      }
      setCurrentCtxPuzzle(newCtxPuzzle);
      setSelectedCtxAnswerIdx(null);
      setIsSubmitted(false);
      setSeconds(0);

      onUpdateContextDetails({
        dimension: selectedDim,
        baseVector: newCtxPuzzle.baseOffsetVector,
        projectedVector: newCtxPuzzle.baseOffsetVector,
        baseRelationName: newCtxPuzzle.baseRelation,
        projectedRelationName: newCtxPuzzle.baseRelation,
        nodeDefinitions: newCtxPuzzle.nodeDefinitions,
        contextVehicles: newCtxPuzzle.contextVehicles,
        queryNode: newCtxPuzzle.queryNode,
        queryTarget: newCtxPuzzle.queryTarget,
        selectedAnswerText: '',
        selectedAnswerLetter: '',
        isSubmitted: false,
        activeModifiers: [1, 1, 1, 1]
      });
    } else {
      let newAnalogyPuzzle = generateAnalogyPuzzle(selectedDim, difficulty, {
        useCustom: generatorMode === 'custom',
        anchorCount: customAnchors,
        anchorDefinitionsCount: customAnchorDefinitions,
        shiftsPerAnchor: customShiftsCount,
        interrelation: customInterrelation,
        scaleType: 'integer',
        activeContextsCount: customActiveCount,
        scrambleSetting: scrambleSetting,
        contextType: contextType,
        analogyContextDepth: customAnalogyDepth,
        analogyChainLength: customAnalogyLength,
        analogyStructureType: customAnalogyStructure
      });
      if (abstractRelationsEnabled) {
        newAnalogyPuzzle = translateAnalogyPuzzleToAbstract(newAnalogyPuzzle, activeMapping, selectedDim, scrambleComponentOrder);
      } else if (scrambleComponentOrder) {
        newAnalogyPuzzle = scrambleAnalogyPuzzleStandard(newAnalogyPuzzle, selectedDim, scrambleComponentOrder);
      }
      setCurrentAnalogyPuzzle(newAnalogyPuzzle);
      setSelectedAnalogyAnswerIdx(null);
      setIsSubmitted(false);
      setSeconds(0);
      setActiveAnalogyTab('ctx1');

      onUpdateContextDetails({
        dimension: selectedDim,
        baseVector: newAnalogyPuzzle.baseVector,
        projectedVector: newAnalogyPuzzle.projectedVector,
        baseRelationName: newAnalogyPuzzle.baseRelationName,
        projectedRelationName: newAnalogyPuzzle.projectedRelationName,
        nodeDefinitions: newAnalogyPuzzle.nodeDefinitions,
        contextVehicles: newAnalogyPuzzle.contextVehicles,
        queryNode: newAnalogyPuzzle.nodeA,
        queryTarget: newAnalogyPuzzle.nodeB,
        selectedAnswerText: '',
        selectedAnswerLetter: '',
        isSubmitted: false,
        activeModifiers: newAnalogyPuzzle.context1Modifiers
      });
    }
  };

  useEffect(() => {
    if (workoutMode === 'analogy' && currentAnalogyPuzzle) {
      if (activeAnalogyTab === 'ctx1') {
        onUpdateContextDetails({
          dimension: selectedDim,
          baseVector: currentAnalogyPuzzle.baseVector,
          projectedVector: currentAnalogyPuzzle.projectedVector,
          baseRelationName: currentAnalogyPuzzle.baseRelationName,
          projectedRelationName: currentAnalogyPuzzle.projectedRelationName,
          nodeDefinitions: currentAnalogyPuzzle.nodeDefinitions,
          contextVehicles: currentAnalogyPuzzle.contextVehicles,
          queryNode: currentAnalogyPuzzle.nodeA,
          queryTarget: currentAnalogyPuzzle.nodeB,
          selectedAnswerText: '',
          selectedAnswerLetter: '',
          isSubmitted: isSubmitted,
          activeModifiers: currentAnalogyPuzzle.context1Modifiers
        });
      } else if (activeAnalogyTab === 'ctx2') {
        const projVecC2 = [
          currentAnalogyPuzzle.context2BaseVector[0] * currentAnalogyPuzzle.context2Modifiers[0],
          currentAnalogyPuzzle.context2BaseVector[1] * currentAnalogyPuzzle.context2Modifiers[1],
          (currentAnalogyPuzzle.context2BaseVector[2] ?? 0) * (currentAnalogyPuzzle.context2Modifiers[2] ?? 1),
          (currentAnalogyPuzzle.context2BaseVector[3] ?? 0) * (currentAnalogyPuzzle.context2Modifiers[3] ?? 1),
        ];
        onUpdateContextDetails({
          dimension: selectedDim,
          baseVector: currentAnalogyPuzzle.context2BaseVector,
          projectedVector: projVecC2,
          baseRelationName: describeContextVector(currentAnalogyPuzzle.context2BaseVector, selectedDim),
          projectedRelationName: describeContextVector(projVecC2, selectedDim),
          nodeDefinitions: currentAnalogyPuzzle.nodeDefinitions,
          contextVehicles: currentAnalogyPuzzle.contextVehicles,
          queryNode: currentAnalogyPuzzle.nodeC,
          queryTarget: currentAnalogyPuzzle.nodeD,
          selectedAnswerText: '',
          selectedAnswerLetter: '',
          isSubmitted: isSubmitted,
          activeModifiers: currentAnalogyPuzzle.context2Modifiers
        });
      } else if (activeAnalogyTab === 'ctx3' && currentAnalogyPuzzle.context3BaseVector && currentAnalogyPuzzle.context3Modifiers) {
        const projVecC3 = [
          currentAnalogyPuzzle.context3BaseVector[0] * currentAnalogyPuzzle.context3Modifiers[0],
          currentAnalogyPuzzle.context3BaseVector[1] * currentAnalogyPuzzle.context3Modifiers[1],
          (currentAnalogyPuzzle.context3BaseVector[2] ?? 0) * (currentAnalogyPuzzle.context3Modifiers[2] ?? 1),
          (currentAnalogyPuzzle.context3BaseVector[3] ?? 0) * (currentAnalogyPuzzle.context3Modifiers[3] ?? 1),
        ];
        onUpdateContextDetails({
          dimension: selectedDim,
          baseVector: currentAnalogyPuzzle.context3BaseVector,
          projectedVector: projVecC3,
          baseRelationName: describeContextVector(currentAnalogyPuzzle.context3BaseVector, selectedDim),
          projectedRelationName: describeContextVector(projVecC3, selectedDim),
          nodeDefinitions: currentAnalogyPuzzle.nodeDefinitions,
          contextVehicles: currentAnalogyPuzzle.contextVehicles,
          queryNode: currentAnalogyPuzzle.nodeE ?? '',
          queryTarget: currentAnalogyPuzzle.nodeF ?? '',
          selectedAnswerText: '',
          selectedAnswerLetter: '',
          isSubmitted: isSubmitted,
          activeModifiers: currentAnalogyPuzzle.context3Modifiers
        });
      } else if (activeAnalogyTab === 'ctx4' && currentAnalogyPuzzle.context4BaseVector && currentAnalogyPuzzle.context4Modifiers) {
        const projVecC4 = [
          currentAnalogyPuzzle.context4BaseVector[0] * currentAnalogyPuzzle.context4Modifiers[0],
          currentAnalogyPuzzle.context4BaseVector[1] * currentAnalogyPuzzle.context4Modifiers[1],
          (currentAnalogyPuzzle.context4BaseVector[2] ?? 0) * (currentAnalogyPuzzle.context4Modifiers[2] ?? 1),
          (currentAnalogyPuzzle.context4BaseVector[3] ?? 0) * (currentAnalogyPuzzle.context4Modifiers[3] ?? 1),
        ];
        onUpdateContextDetails({
          dimension: selectedDim,
          baseVector: currentAnalogyPuzzle.context4BaseVector,
          projectedVector: projVecC4,
          baseRelationName: describeContextVector(currentAnalogyPuzzle.context4BaseVector, selectedDim),
          projectedRelationName: describeContextVector(projVecC4, selectedDim),
          nodeDefinitions: currentAnalogyPuzzle.nodeDefinitions,
          contextVehicles: currentAnalogyPuzzle.contextVehicles,
          queryNode: currentAnalogyPuzzle.nodeG ?? '',
          queryTarget: currentAnalogyPuzzle.nodeH ?? '',
          selectedAnswerText: '',
          selectedAnswerLetter: '',
          isSubmitted: isSubmitted,
          activeModifiers: currentAnalogyPuzzle.context4Modifiers
        });
      }
    }
  }, [workoutMode, currentAnalogyPuzzle, activeAnalogyTab, isSubmitted, selectedDim]);

  useEffect(() => {
    if (isPlaying) {
      handleStartTraining();
    }
  }, [
    selectedDim,
    difficulty,
    workoutMode,
    generatorMode,
    customAnchors,
    customShiftsCount,
    customInterrelation,
    customActiveCount,
    scrambleSetting,
    contextType,
    abstractRelationsEnabled
  ]);

  useEffect(() => {
    const isOver = isSubmitted;
    if (isPlaying && !isOver) {
      timerRef.current = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, isSubmitted]);

  const handleSelectAnswer = (idx: number) => {
    if (isSubmitted) return;
    if (workoutMode === 'classic') {
      setSelectedAnswerIdx(idx);
    } else if (workoutMode === 'context') {
      setSelectedCtxAnswerIdx(idx);

      if (currentCtxPuzzle) {
        const selectedOpt = currentCtxPuzzle.options[idx];
        const optLetter = String.fromCharCode(65 + idx);
        
        // Use stored vector or default to projectedVector
        const optVector = selectedOpt && selectedOpt.vector ? selectedOpt.vector : currentCtxPuzzle.projectedVector;
        
        const aggregateScales = [1, 1, 1, 1];
        for (let idxDim = 0; idxDim < selectedDim; idxDim++) {
          const baseVal = currentCtxPuzzle.baseOffsetVector[idxDim] ?? 0;
          const optVal = optVector[idxDim] ?? 0;
          if (baseVal !== 0) {
            aggregateScales[idxDim] = optVal / baseVal;
          } else {
            aggregateScales[idxDim] = optVal !== 0 ? optVal : 1;
          }
        }
        
        onUpdateContextDetails({
          dimension: selectedDim,
          baseVector: currentCtxPuzzle.baseOffsetVector,
          projectedVector: optVector,
          baseRelationName: currentCtxPuzzle.baseRelation,
          projectedRelationName: selectedOpt.text,
          nodeDefinitions: currentCtxPuzzle.nodeDefinitions,
          contextVehicles: currentCtxPuzzle.contextVehicles,
          queryNode: currentCtxPuzzle.queryNode,
          queryTarget: currentCtxPuzzle.queryTarget,
          selectedAnswerText: selectedOpt.text,
          selectedAnswerLetter: optLetter,
          isSubmitted: false,
          activeModifiers: aggregateScales
        });
      }
    } else if (workoutMode === 'analogy') {
      setSelectedAnalogyAnswerIdx(idx);
    }
  };

  const handleSubmitAnswer = () => {
    if (workoutMode === 'classic') {
      if (selectedAnswerIdx === null || isSubmitted || !currentPuzzle) return;
      
      setIsSubmitted(true);
      const selectedOption = currentPuzzle.options[selectedAnswerIdx];
      const isCorrect = selectedOption.isCorrect;
      const timeTakenMs = seconds * 1000;

      const difficultyMultiplier: Record<PuzzleDifficulty, number> = {
        'Beginner': 100,
        'Intermediate': 200,
        'Advanced': 400,
        'Master': 800
      };

      const speedBonus = Math.max(0, Math.floor((60 - seconds) * 1.5));
      const scoreGained = isCorrect ? (difficultyMultiplier[currentPuzzle.difficulty] + speedBonus) : 0;

      const newStreak = isCorrect ? stats.streak + 1 : 0;
      const newTotalAnswered = stats.totalAnswered + 1;
      const newTotalCorrect = isCorrect ? stats.totalCorrect + 1 : stats.totalCorrect;
      const newAccuracy = Math.round((newTotalCorrect / newTotalAnswered) * 100);
      const newAverageTimeMs = Math.round(((stats.averageTimeMs * stats.totalAnswered) + timeTakenMs) / newTotalAnswered);

      const historyItem = {
        timestamp: Date.now(),
        correct: isCorrect,
        timeMs: timeTakenMs,
        dimension: currentPuzzle.dimension,
        difficulty: currentPuzzle.difficulty,
        scoreGained
      };

      const newStats: TrainingStats = {
        score: stats.score + scoreGained,
        streak: newStreak,
        accuracy: newAccuracy,
        totalAnswered: newTotalAnswered,
        totalCorrect: newTotalCorrect,
        averageTimeMs: newAverageTimeMs,
        history: [historyItem, ...stats.history]
      };

      onUpdateStats(newStats);
    } else if (workoutMode === 'context') {
      if (selectedCtxAnswerIdx === null || isSubmitted || !currentCtxPuzzle) return;

      setIsSubmitted(true);
      const selectedOption = currentCtxPuzzle.options[selectedCtxAnswerIdx];
      const isCorrect = selectedOption.isCorrect;
      const timeTakenMs = seconds * 1000;

      const difficultyMultiplier: Record<PuzzleDifficulty, number> = {
        'Beginner': 120,
        'Intermediate': 240,
        'Advanced': 480,
        'Master': 960
      };

      const speedBonus = Math.max(0, Math.floor((90 - seconds) * 1.5));
      const scoreGained = isCorrect ? (difficultyMultiplier[currentCtxPuzzle.difficulty] + speedBonus) : 0;

      const newStreak = isCorrect ? stats.streak + 1 : 0;
      const newTotalAnswered = stats.totalAnswered + 1;
      const newTotalCorrect = isCorrect ? stats.totalCorrect + 1 : stats.totalCorrect;
      const newAccuracy = Math.round((newTotalCorrect / newTotalAnswered) * 100);
      const newAverageTimeMs = Math.round(((stats.averageTimeMs * stats.totalAnswered) + timeTakenMs) / newTotalAnswered);

      const historyItem = {
        timestamp: Date.now(),
        correct: isCorrect,
        timeMs: timeTakenMs,
        dimension: currentCtxPuzzle.dimension,
        difficulty: currentCtxPuzzle.difficulty,
        scoreGained
      };

      const newStats: TrainingStats = {
        score: stats.score + scoreGained,
        streak: newStreak,
        accuracy: newAccuracy,
        totalAnswered: newTotalAnswered,
        totalCorrect: newTotalCorrect,
        averageTimeMs: newAverageTimeMs,
        history: [historyItem, ...stats.history]
      };

      onUpdateStats(newStats);

      // Trigger update with the correct/solved projection on submission!
      const correctOption = currentCtxPuzzle.options.find(o => o.isCorrect) || selectedOption;
      const correctIdx = currentCtxPuzzle.options.findIndex(o => o.isCorrect);
      const correctLetter = String.fromCharCode(65 + (correctIdx >= 0 ? correctIdx : selectedCtxAnswerIdx));
      
      const optVector = currentCtxPuzzle.projectedVector;
      const aggregateScales = [1, 1, 1, 1];
      for (let idxDim = 0; idxDim < selectedDim; idxDim++) {
        const baseVal = currentCtxPuzzle.baseOffsetVector[idxDim] ?? 0;
        const optVal = optVector[idxDim] ?? 0;
        if (baseVal !== 0) {
          aggregateScales[idxDim] = optVal / baseVal;
        } else {
          aggregateScales[idxDim] = optVal !== 0 ? optVal : 1;
        }
      }

      onUpdateContextDetails({
        dimension: selectedDim,
        baseVector: currentCtxPuzzle.baseOffsetVector,
        projectedVector: optVector,
        baseRelationName: currentCtxPuzzle.baseRelation,
        projectedRelationName: correctOption.text,
        nodeDefinitions: currentCtxPuzzle.nodeDefinitions,
        contextVehicles: currentCtxPuzzle.contextVehicles,
        queryNode: currentCtxPuzzle.queryNode,
        queryTarget: currentCtxPuzzle.queryTarget,
        selectedAnswerText: correctOption.text,
        selectedAnswerLetter: correctLetter,
        isSubmitted: true,
        activeModifiers: aggregateScales
      });
    } else if (workoutMode === 'analogy') {
      if (selectedAnalogyAnswerIdx === null || isSubmitted || !currentAnalogyPuzzle) return;

      setIsSubmitted(true);
      const selectedOption = currentAnalogyPuzzle.options[selectedAnalogyAnswerIdx];
      const isCorrect = selectedOption.isCorrect;
      const timeTakenMs = seconds * 1000;

      const difficultyMultiplier: Record<PuzzleDifficulty, number> = {
        'Beginner': 150,
        'Intermediate': 300,
        'Advanced': 600,
        'Master': 1200
      };

      const speedBonus = Math.max(0, Math.floor((120 - seconds) * 1.5));
      const scoreGained = isCorrect ? (difficultyMultiplier[currentAnalogyPuzzle.difficulty] + speedBonus) : 0;

      const newStreak = isCorrect ? stats.streak + 1 : 0;
      const newTotalAnswered = stats.totalAnswered + 1;
      const newTotalCorrect = isCorrect ? stats.totalCorrect + 1 : stats.totalCorrect;
      const newAccuracy = Math.round((newTotalCorrect / newTotalAnswered) * 100);
      const newAverageTimeMs = Math.round(((stats.averageTimeMs * stats.totalAnswered) + timeTakenMs) / newTotalAnswered);

      const historyItem = {
        timestamp: Date.now(),
        correct: isCorrect,
        timeMs: timeTakenMs,
        dimension: currentAnalogyPuzzle.dimension,
        difficulty: currentAnalogyPuzzle.difficulty,
        scoreGained
      };

      const newStats: TrainingStats = {
        score: stats.score + scoreGained,
        streak: newStreak,
        accuracy: newAccuracy,
        totalAnswered: newTotalAnswered,
        totalCorrect: newTotalCorrect,
        averageTimeMs: newAverageTimeMs,
        history: [historyItem, ...stats.history]
      };

      onUpdateStats(newStats);
    }
  };

  const handleNextPuzzle = () => {
    handleStartTraining();
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-6" id="training-workspace-container">
      
      {/* Workout mode sub-toggle */}
      <div className="flex bg-theme-bg p-1 border border-theme-comp/40 select-none">
        <button
          onClick={() => setWorkoutMode('classic')}
          className={`flex-1 py-1.5 text-xs font-sans font-bold flex items-center justify-center gap-2 uppercase tracking-wide cursor-pointer rounded-none transition-all duration-150 ${
            workoutMode === 'classic'
              ? 'bg-theme-comp text-theme-bg'
              : 'text-theme-text hover:bg-theme-comp/10'
          }`}
        >
          <Brain className="w-4 h-4" />
          Classic Deductions
        </button>
        <button
          onClick={() => setWorkoutMode('context')}
          className={`flex-1 py-1.5 text-theme-text text-xs font-sans font-bold flex items-center justify-center gap-2 uppercase tracking-wide cursor-pointer rounded-none transition-all duration-150 ${
            workoutMode === 'context'
              ? 'bg-theme-comp text-theme-bg'
              : 'text-theme-text hover:bg-theme-comp/10'
          }`}
        >
          <Compass className="w-4 h-4" />
          Context
        </button>
        <button
          onClick={() => setWorkoutMode('analogy')}
          className={`flex-1 py-1.5 text-theme-text text-xs font-sans font-bold flex items-center justify-center gap-2 uppercase tracking-wide cursor-pointer rounded-none transition-all duration-150 ${
            workoutMode === 'analogy'
              ? 'bg-theme-comp text-theme-bg'
              : 'text-theme-text hover:bg-theme-comp/10'
          }`}
        >
          <Zap className="w-4 h-4" />
          Cross-Context Analogy
        </button>
      </div>

      {/* Configuration row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-theme-card border border-theme-comp p-4 shadow-sm">
        {/* Dim toggle */}
        <div className="md:col-span-4 flex flex-col gap-2">
          <label className="text-xs font-mono text-theme-text font-bold tracking-wider">DIMENSIONAL SPACE</label>
          <div className="grid grid-cols-3 gap-1 bg-theme-bg p-1 border border-theme-comp/30">
            {([2, 3, 4] as DimensionCount[]).map(dim => (
              <button
                key={dim}
                id={`dim-toggle-${dim}`}
                onClick={() => setSelectedDim(dim)}
                className={`py-1.5 text-xs font-mono font-bold transition-all duration-150 rounded-none cursor-pointer ${
                  selectedDim === dim
                    ? 'bg-theme-comp text-theme-bg'
                    : 'text-theme-text hover:bg-theme-comp/10'
                }`}
              >
                {dim}D SPACE
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div className="md:col-span-5 flex flex-col gap-2">
          <label className="text-xs font-mono text-theme-text font-bold tracking-wider">COGNITIVE LEVEL</label>
          <div className="grid grid-cols-4 gap-1 bg-theme-bg p-1 border border-theme-comp/30">
            {(['Beginner', 'Intermediate', 'Advanced', 'Master'] as PuzzleDifficulty[]).map(diff => (
              <button
                key={diff}
                id={`diff-level-${diff}`}
                onClick={() => setDifficulty(diff)}
                className={`py-1.5 text-[10px] font-mono font-bold transition-all duration-150 uppercase tracking-tight rounded-none cursor-pointer ${
                  difficulty === diff
                    ? 'bg-theme-comp text-theme-bg'
                    : 'text-theme-text hover:bg-theme-comp/10'
                }`}
              >
                {diff}
              </button>
            ))}
          </div>
        </div>

        {/* Start Button */}
        <div className="md:col-span-3 flex items-end">
          <button
            id="start-training-btn"
            onClick={handleStartTraining}
            className="w-full bg-theme-comp hover:bg-theme-comp/90 text-theme-bg text-xs font-sans font-bold py-3 px-4 border border-theme-comp flex items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-wider h-[40px]"
          >
            {isPlaying ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin-slow" />
                Regenerate Map
              </>
            ) : (
              <>
                <Brain className="w-4 h-4" />
                Start Workout
              </>
            )}
          </button>
        </div>
      </div>

      {/* Decoupled Custom parameters Panel for both modes */}
      <div className="flex flex-col gap-3 bg-theme-bg/60 border border-theme-comp p-4 select-none -mt-2 animate-fadeIn" id="generator-settings-panel">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme-comp/20 pb-2.5">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-theme-comp" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-theme-text">
              {workoutMode === 'classic' ? 'Deduction Strategy Option' : 'Generator Strategy Option'}
            </span>
          </div>
          
          {/* Toggles between Presets and Custom Mode */}
          <div className="flex bg-theme-card border border-theme-comp/50 p-0.5" id="preset-custom-toggle-wrap">
            <button
               id="preset-mode-toggle"
              onClick={() => setGeneratorMode('preset')}
              className={`px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wide transition-all duration-150 rounded-none cursor-pointer ${
                generatorMode === 'preset'
                  ? 'bg-theme-comp text-theme-bg'
                  : 'text-theme-text hover:bg-theme-comp/10'
              }`}
            >
              Level Presets
            </button>
            <button
              id="custom-mode-toggle"
              onClick={() => setGeneratorMode('custom')}
              className={`px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wide transition-all duration-150 rounded-none cursor-pointer ${
                generatorMode === 'custom'
                  ? 'bg-theme-comp text-theme-bg'
                  : 'text-theme-text hover:bg-theme-comp/10'
              }`}
            >
              Custom Parameters
            </button>
          </div>
        </div>

        {/* Render parameters only if useCustom is enabled */}
        {generatorMode === 'custom' ? (
          <div className="flex flex-col gap-4 animate-slideDown" id="custom-parameters-content">
            {workoutMode === 'classic' ? (
              // Classic mode custom options
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Number of Premises / Relations */}
                <div className="flex flex-col gap-1.5" id="classic-premises-count-control">
                  <span className="text-[10px] font-mono text-theme-text/75 font-bold uppercase">Premises (Relations)</span>
                  <div className="flex items-center gap-2 bg-theme-card p-1.5 border border-theme-comp/40 h-[34px]">
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={customAnchors}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(12, parseInt(e.target.value) || 1));
                        setCustomAnchors(val);
                      }}
                      className="w-full bg-transparent text-xs font-mono font-bold text-theme-text focus:outline-none px-1 border-none"
                    />
                    <span className="text-[9px] font-mono font-bold text-theme-text/50 pr-1 uppercase whitespace-nowrap">1-12 Max</span>
                  </div>
                </div>

                {/* Scramble / Shuffle settings */}
                <div className="flex flex-col gap-1.5" id="classic-scramble-control">
                  <span className="text-[10px] font-mono text-theme-text/75 font-bold uppercase">Premise Shuffle (Scramble)</span>
                  <div className="grid grid-cols-3 gap-0.5 bg-theme-card p-0.5 border border-theme-comp/40">
                    {(['none', 'partial', 'full'] as const).map(mode => (
                      <button
                        key={mode}
                        id={`btn-scramble-${mode}`}
                        onClick={() => setScrambleSetting(mode)}
                        className={`py-1 text-[9px] font-mono font-bold uppercase transition-all duration-150 cursor-pointer ${
                          scrambleSetting === mode
                            ? 'bg-theme-comp text-theme-bg'
                            : 'text-theme-text hover:bg-theme-comp/10'
                        }`}
                      >
                        {mode === 'none' ? 'None' : mode === 'partial' ? 'Partial' : 'Full Scramble'}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            ) : (
              // Context mode custom options (fully comprehensive)
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  
                  {/* Anchor Definitions count */}
                  <div className="flex flex-col gap-1.5" id="context-definitions-control">
                    <span className="text-[10px] font-mono text-theme-text/75 font-bold uppercase">Anchor Definitions Pool</span>
                    <div className="flex items-center gap-2 bg-theme-card p-1.5 border border-theme-comp/40 h-[34px]">
                      <input
                        type="number"
                        min={2}
                        max={12}
                        value={customAnchorDefinitions}
                        onChange={(e) => {
                          const val = Math.max(2, Math.min(12, parseInt(e.target.value) || 2));
                          setCustomAnchorDefinitions(val);
                          if (customAnchors > val) {
                            setCustomAnchors(val);
                          }
                        }}
                        className="w-full bg-transparent text-xs font-mono font-bold text-theme-text focus:outline-none px-1 border-none"
                      />
                      <span className="text-[9px] font-mono font-bold text-theme-text/50 pr-1 uppercase whitespace-nowrap">2-12 Max</span>
                    </div>
                  </div>

                  {/* Anchor Count Parameter */}
                  <div className="flex flex-col gap-1.5" id="context-anchors-control">
                    <span className="text-[10px] font-mono text-theme-text/75 font-bold uppercase">Relative Anchors</span>
                    <div className="flex items-center gap-2 bg-theme-card p-1.5 border border-theme-comp/40 h-[34px]">
                      <input
                        type="number"
                        min={1}
                        max={customAnchorDefinitions}
                        value={customAnchors}
                        onChange={(e) => {
                          const val = Math.max(1, Math.min(customAnchorDefinitions, parseInt(e.target.value) || 1));
                          setCustomAnchors(val);
                        }}
                        className="w-full bg-transparent text-xs font-mono font-bold text-theme-text focus:outline-none px-1 border-none"
                      />
                      <span className="text-[9px] font-mono font-bold text-theme-text/50 pr-1 uppercase whitespace-nowrap">1-{customAnchorDefinitions} Max</span>
                    </div>
                  </div>
 
                   {/* Shift Registers Depth Count */}
                  <div className="flex flex-col gap-1.5" id="context-pipeline-depth-control">
                    <span className="text-[10px] font-mono text-theme-text/75 font-bold uppercase">Shift Pipeline Depth</span>
                    <div className="flex items-center gap-2 bg-theme-card p-1.5 border border-theme-comp/40 h-[34px]">
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={customShiftsCount}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(10, parseInt(e.target.value) || 0));
                          setCustomShiftsCount(val);
                        }}
                        className="w-full bg-transparent text-xs font-mono font-bold text-theme-text focus:outline-none px-1 border-none"
                      />
                      <span className="text-[9px] font-mono font-bold text-theme-text/50 pr-1 uppercase whitespace-nowrap">0-10 Ops</span>
                    </div>
                  </div>
 
                   {/* Cross-channel references option */}
                  <div className="flex flex-col gap-1.5" id="context-interrelation-control">
                    <span className="text-[10px] font-mono text-theme-text/75 font-bold uppercase">Register Interrelation</span>
                    <div className="grid grid-cols-3 gap-0.5 bg-theme-card p-0.5 border border-theme-comp/40 h-[34px]">
                      <button
                        id="btn-interrelation-chain"
                        onClick={() => setCustomInterrelation('chain')}
                        className={`py-1 text-[9px] font-mono font-bold uppercase transition-all duration-150 cursor-pointer ${
                          customInterrelation === 'chain'
                            ? 'bg-theme-comp text-theme-bg'
                            : 'text-theme-text hover:bg-theme-comp/10'
                        }`}
                      >
                        Direct Chained
                      </button>
                      <button
                        id="btn-interrelation-cross"
                        disabled={customAnchors < 2 || customShiftsCount < 1}
                        onClick={() => setCustomInterrelation('cross')}
                        className={`py-1 text-[9px] font-mono font-bold uppercase transition-all duration-150 cursor-pointer ${
                          (customAnchors < 2 || customShiftsCount < 1)
                            ? 'opacity-25 cursor-not-allowed bg-theme-bg/50 text-neutral-400'
                            : customInterrelation === 'cross'
                              ? 'bg-theme-comp text-theme-bg'
                              : 'text-theme-text hover:bg-theme-comp/10'
                        }`}
                      >
                        Cross Registers
                      </button>
                      <button
                        id="btn-interrelation-mixed"
                        disabled={customAnchors < 2 || customShiftsCount < 1}
                        onClick={() => setCustomInterrelation('mixed')}
                        className={`py-1 text-[9px] font-mono font-bold uppercase transition-all duration-150 cursor-pointer ${
                          (customAnchors < 2 || customShiftsCount < 1)
                            ? 'opacity-25 cursor-not-allowed bg-theme-bg/50 text-neutral-400'
                            : customInterrelation === 'mixed'
                              ? 'bg-theme-comp text-theme-bg'
                              : 'text-theme-text hover:bg-theme-comp/10'
                        }`}
                      >
                        Mixed
                      </button>
                    </div>
                  </div>

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-theme-comp/10 pt-3">
                  
                  {/* Contexts in Resolution */}
                  <div className="flex flex-col gap-1.5" id="context-resolution-count-control">
                    <span className="text-[10px] font-mono text-theme-text/75 font-bold uppercase">Contexts in Resolution</span>
                    <div className="grid grid-cols-5 gap-0.5 bg-theme-bg p-0.5 border border-theme-comp/40">
                      {/* We dynamically support the exact custom level options */}
                      {(['random', 'eq1', 'lte2', 'lte3', 'lte4'] as const).map(option => {
                        const totalPotentialShifts = customAnchors * customShiftsCount;
                        let disabled = false;
                        
                        if (option === 'eq1' && totalPotentialShifts < 1) disabled = true;
                        if (option === 'lte2' && totalPotentialShifts < 2) disabled = true;
                        if (option === 'lte3' && totalPotentialShifts < 3) disabled = true;
                        if (option === 'lte4' && totalPotentialShifts < 4) disabled = true;

                        let label = 'Random';
                        if (option === 'eq1') label = '= 1 (L1)';
                        if (option === 'lte2') label = '≤ 2 (L2)';
                        if (option === 'lte3') label = '≤ 3 (L3)';
                        if (option === 'lte4') label = '≤ 4 (L4)';

                        return (
                          <button
                            key={option}
                            id={`btn-activecount-${option}`}
                            disabled={disabled}
                            onClick={() => setCustomActiveCount(option)}
                            className={`py-1 text-[8px] font-mono font-bold uppercase transition-all duration-150 cursor-pointer leading-tight ${
                              disabled 
                                ? 'opacity-25 cursor-not-allowed bg-theme-bg/50 text-neutral-400' 
                                : customActiveCount === option
                                  ? 'bg-theme-comp text-theme-bg'
                                  : 'text-theme-text hover:bg-theme-comp/10'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Scramble Setting / Premise Shuffle */}
                  <div className="flex flex-col gap-1.5" id="context-scramble-control">
                    <span className="text-[10px] font-mono text-theme-text/75 font-bold uppercase">Premise Shuffle (Scramble)</span>
                    <div className="grid grid-cols-3 gap-0.5 bg-theme-bg p-0.5 border border-theme-comp/40">
                      {(['none', 'partial', 'full'] as const).map(mode => (
                        <button
                          key={mode}
                          id={`btn-ctxscramble-${mode}`}
                          onClick={() => setScrambleSetting(mode)}
                          className={`py-1 text-[9px] font-mono font-bold uppercase transition-all duration-150 cursor-pointer ${
                            scrambleSetting === mode
                              ? 'bg-theme-comp text-theme-bg'
                              : 'text-theme-text hover:bg-theme-comp/10'
                          }`}
                        >
                          {mode === 'none' ? 'None' : mode === 'partial' ? 'Partial' : 'Full Scramble'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Context Generator Source / Implicit Inferences */}
                  <div className="flex flex-col gap-1.5" id="context-source-control">
                    <span className="text-[10px] font-mono text-theme-text/75 font-bold uppercase">Context Source</span>
                    <div className="grid grid-cols-3 gap-0.5 bg-theme-bg p-0.5 border border-theme-comp/40">
                      {(['premises', 'inferences', 'both'] as const).map(source => (
                        <button
                          key={source}
                          id={`btn-source-${source}`}
                          onClick={() => setContextType(source)}
                          className={`py-1 text-[9px] font-mono font-bold uppercase transition-all duration-150 cursor-pointer ${
                            contextType === source
                              ? 'bg-theme-comp text-theme-bg'
                              : 'text-theme-text hover:bg-theme-comp/10'
                          }`}
                        >
                          {source === 'premises' ? 'Premises' : source === 'inferences' ? 'Inferences' : 'Both (Mixed)'}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>

                {generatorMode === 'custom' && workoutMode === 'analogy' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-theme-comp/10 pt-3" id="analogy-extension-controls">
                    {/* Analogy Chain Length */}
                    <div className="flex flex-col gap-1.5" id="analogy-chain-length-control">
                      <span className="text-[10px] font-mono text-theme-text/75 font-bold uppercase" style={{ color: 'var(--text-color)' }}>Analogy Chain Length</span>
                      <div className="grid grid-cols-2 gap-0.5 bg-theme-bg p-0.5 border border-theme-comp/40">
                        {([2, 3] as const).map(len => (
                          <button
                            key={len}
                            id={`btn-analogy-len-${len}`}
                            onClick={() => {
                              setCustomAnalogyLength(len);
                              if (len === 3) setCustomAnalogyStructure('standard');
                            }}
                            className={`py-1 text-[9px] font-mono font-bold uppercase transition-all duration-150 cursor-pointer ${
                              customAnalogyLength === len
                                ? 'bg-theme-comp text-theme-bg'
                                : 'text-theme-text hover:bg-theme-comp/10'
                            }`}
                          >
                            {len === 2 ? '2-Way (A:B :: C:D)' : '3-Way Chain (A:B :: C:D :: E:F)'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Context Composition Depth */}
                    <div className="flex flex-col gap-1.5" id="analogy-composition-depth-control">
                      <span className="text-[10px] font-mono text-theme-text/75 font-bold uppercase" style={{ color: 'var(--text-color)' }}>Context Composition Depth</span>
                      <div className="grid grid-cols-3 gap-0.5 bg-theme-bg p-0.5 border border-theme-comp/40">
                        {([1, 2, 3] as const).map(depth => (
                          <button
                            key={depth}
                            id={`btn-analogy-depth-${depth}`}
                            onClick={() => setCustomAnalogyDepth(depth)}
                            className={`py-1 text-[9px] font-mono font-bold uppercase transition-all duration-150 cursor-pointer ${
                              customAnalogyDepth === depth
                                ? 'bg-theme-comp text-theme-bg'
                                : 'text-theme-text hover:bg-theme-comp/10'
                            }`}
                          >
                            {depth === 1 ? 'Depth 1 (C)' : depth === 2 ? 'Depth 2 (C1 ∘ C2)' : 'Depth 3 (C1 ∘ C2 ∘ C3)'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Analogy Structure / Pattern */}
                    <div className="flex flex-col gap-1.5" id="analogy-pattern-control">
                      <span className="text-[10px] font-mono text-theme-text/75 font-bold uppercase" style={{ color: 'var(--text-color)' }}>Analogy Pattern</span>
                      <div className="grid grid-cols-2 gap-0.5 bg-theme-bg p-0.5 border border-theme-comp/40">
                        {(['standard', 'nested'] as const).map(pattern => (
                          <button
                            key={pattern}
                            disabled={pattern === 'nested' && customAnalogyLength === 3}
                            id={`btn-analogy-pattern-${pattern}`}
                            onClick={() => setCustomAnalogyStructure(pattern)}
                            className={`py-1 text-[9px] font-mono font-bold uppercase transition-all duration-150 cursor-pointer ${
                              pattern === 'nested' && customAnalogyLength === 3
                                ? 'opacity-25 cursor-not-allowed text-stone-500'
                                : customAnalogyStructure === pattern
                                  ? 'bg-theme-comp text-theme-bg'
                                  : 'text-theme-text hover:bg-theme-comp/10'
                            }`}
                          >
                            {pattern === 'standard' ? 'Standard' : 'Nested (Cross-Cross)'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        ) : (
          <p className="text-[10px] font-sans leading-relaxed p-2 border border-theme-comp" id="preset-mode-active-text" style={{ backgroundColor: 'var(--main-color)', color: 'var(--text-color)', borderColor: 'var(--main-color-complementary)' }}>
            Applying standard preset templates (
            <span className="font-mono font-bold" style={{ color: 'var(--text-color-accent)' }}>{difficulty.toUpperCase()}</span>). Toggle to the custom panel to fully decouple features, setup multiple concurrent relative vectors/premises, and configure custom scramble states or deep shift pipelines.
          </p>
        )}
      </div>

      {/* Main puzzle board */}
      {!isPlaying ? (
        <div className="flex flex-col items-center justify-center border border-theme-comp p-12 text-center bg-theme-card relative overflow-hidden h-[400px]">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(var(--main-color-complementary) 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
               <Brain className="w-16 h-16 text-theme-comp/75 stroke-[1.2] mb-4" />
          <h3 className="font-serif italic text-xl text-theme-text mb-2 uppercase tracking-wide">
            {workoutMode === 'classic' 
              ? 'Classic Vector Deduction System' 
              : workoutMode === 'context' 
                ? 'Mutational Context Space Initiator'
                : 'Cross-Context Analogy Matrix'
            }
          </h3>
          <p className="font-sans text-theme-text max-w-md text-xs leading-relaxed mb-6 opacity-80">
            {workoutMode === 'classic' 
              ? 'Deconstruct multi-dimensional coordinate displacement graphs. Use spatial deduction matrices to solve absolute coordinates of query nodes relative to target benchmarks.'
              : workoutMode === 'context'
                ? 'Evaluate absolute vector definitions under active linear context shifts. Compile and modify axis directions to predict mutated coordinate vectors across hyperspatial maps.'
                : 'Align and solve spatial relations across parallel topological frameworks. Predict analogous vector mapping shifts across divergent multi-dimensional spaces.'
            }
          </p>
          <button
            id="lobby-start-btn"
            onClick={handleStartTraining}
            className="bg-theme-comp hover:bg-theme-comp/90 text-theme-bg font-bold font-sans text-xs px-6 py-3 border border-theme-comp uppercase tracking-wider cursor-pointer transition-transform duration-100"
          >
            Initialize Relational Matrix
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-theme-comp/30 pb-4 mb-2 select-none gap-3">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono uppercase font-bold text-theme-accent tracking-widest">
                {workoutMode === 'classic' ? 'Baseline Spatial Mapping' : workoutMode === 'context' ? 'Multi-Axis Mutator' : 'Cross-Context Matrix Alignment'}
              </span>
              <h3 className="font-serif italic text-lg text-theme-text font-bold uppercase tracking-wide mt-0.5">
                {workoutMode === 'classic' 
                  ? `Classic Riddle Engine` 
                  : workoutMode === 'context' 
                    ? `Context Multiplier Engine` 
                    : `Cross-Context Analogy Engine`
                }
                <span className="text-xs font-sans font-normal normal-case not-italic ml-2 text-theme-text/65">
                  ({workoutMode === 'classic' ? currentPuzzle?.difficulty : workoutMode === 'context' ? currentCtxPuzzle?.difficulty : currentAnalogyPuzzle?.difficulty})
                </span>
              </h3>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-auto">
              {/* Inner Carousel Mode Toggle */}
              <button
                onClick={() => setInnerCarouselEnabled(prev => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 border text-[10px] font-mono font-bold uppercase tracking-wider cursor-pointer transition-all duration-150 rounded-none shadow-sm h-[32px] ${
                  innerCarouselEnabled 
                    ? 'bg-theme-comp text-theme-bg border-theme-comp font-black' 
                    : 'bg-theme-bg text-theme-text/80 border-theme-comp/30 hover:bg-theme-comp/10'
                }`}
                title="Toggle Step-by-Step Item Carousel View"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Carousel: {innerCarouselEnabled ? 'ON' : 'OFF'}</span>
              </button>

              <div className="flex items-center gap-2 bg-theme-bg border border-theme-comp/30 py-1.5 px-3 shadow-sm h-[32px]">
                <Clock className="w-4 h-4 text-theme-comp animate-pulse" />
                <span className="font-mono text-sm font-bold text-theme-text">{formatTime(seconds)}</span>
              </div>
            </div>
          </div>

          {/* Stepper Timeline Navigation Row */}
          <div className="grid grid-cols-3 gap-2 mb-2 select-none">
            <button
              onClick={() => setCarouselIndex(0)}
              className={`py-2.5 px-3 border text-[10px] sm:text-xs font-mono uppercase tracking-wider font-bold transition-all duration-150 rounded-none cursor-pointer text-center ${
                carouselIndex === 0
                  ? 'bg-theme-comp text-theme-bg border-theme-comp font-black'
                  : 'bg-theme-bg text-theme-text/80 border-theme-comp/20 hover:bg-theme-comp/10'
              }`}
            >
              <span className="hidden sm:inline">01. </span>Anchor Network
            </button>
            <button
              onClick={() => setCarouselIndex(1)}
              className={`py-2.5 px-3 border text-[10px] sm:text-xs font-mono uppercase tracking-wider font-bold transition-all duration-150 rounded-none cursor-pointer text-center ${
                carouselIndex === 1
                  ? 'bg-theme-comp text-theme-bg border-theme-comp font-black'
                  : 'bg-theme-bg text-theme-text/80 border-theme-comp/20 hover:bg-theme-comp/10'
              }`}
            >
              <span className="hidden sm:inline">02. </span>
              {workoutMode === 'classic' ? 'Baseline Matrix' : 'Context Shifts'}
            </button>
            <button
              onClick={() => setCarouselIndex(2)}
              className={`py-2.5 px-3 border text-[10px] sm:text-xs font-mono uppercase tracking-wider font-bold transition-all duration-150 rounded-none cursor-pointer text-center ${
                carouselIndex === 2
                  ? 'bg-theme-comp text-theme-bg border-theme-comp font-black'
                  : 'bg-theme-bg text-theme-text/80 border-theme-comp/20 hover:bg-theme-comp/10'
              }`}
            >
              <span className="hidden sm:inline">03. </span>Resolve & Submit
            </button>
          </div>

          {/* Carousel Window Container */}
          <div className="bg-theme-card border border-theme-comp p-6 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[500px]">
            {/* Grid background effect */}
            <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{ backgroundImage: 'radial-gradient(var(--main-color-complementary) 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
            
            <AnimatePresence mode="wait">
              <motion.div
                key={carouselIndex}
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.15 }}
                className="flex-1 flex flex-col gap-4 z-10"
              >
                {/* Step 1: Anchor Definitions or Premises */}
                {carouselIndex === 0 && (
                  <div className="flex-1 flex flex-col gap-3">
                    <div className="border-b border-theme-comp/20 pb-2">
                      <h4 className="font-mono text-xs font-bold uppercase text-theme-accent tracking-wide">
                        {workoutMode === 'classic' ? 'Premises Declarations' : workoutMode === 'context' ? 'Initial Anchor Definitions' : 'Base Coordinate Positions'}
                      </h4>
                      <p className="text-[10px] text-theme-text/60 font-sans mt-0.5">
                        {workoutMode === 'classic' 
                          ? 'Evaluate baseline relative dimensions and displacement offsets between the registered benchmarks.'
                          : workoutMode === 'context'
                            ? 'Observe baseline coordinate relations before active hyperspatial context multipliers are evaluated.'
                            : 'Inspect node relations across parallel context systems using the context selection array.'
                        }
                      </p>
                    </div>

                    {workoutMode === 'classic' && (
                      innerCarouselEnabled ? (
                        <div className="flex flex-col gap-4">
                          {(() => {
                            const p = currentPuzzle?.premises[innerPremiseIndex];
                            if (!p) return <div className="text-xs text-theme-text/50 font-mono italic">No premises available</div>;
                            return (
                              <div
                                onMouseEnter={() => setHighlightedPremiseId(`pzp-${innerPremiseIndex}`)}
                                onMouseLeave={() => setHighlightedPremiseId(null)}
                                className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-theme-bg border border-theme-comp px-5 py-4 transition-all duration-150 shadow-sm relative min-h-[70px]"
                              >
                                <span className="flex items-center gap-2 flex-wrap text-theme-text text-sm sm:text-base">
                                  <span className="w-2 h-2 bg-theme-comp rotate-45"></span>
                                  <strong className="text-theme-text font-mono font-black">{p.entityA}</strong>
                                  <span className="text-theme-text/80 font-serif italic text-xs sm:text-sm">is</span>
                                  <span className="font-mono font-bold px-2 py-0.5 text-xs sm:text-sm" style={{ backgroundColor: 'var(--main-color-complementary)', color: 'var(--main-color)' }}>{p.relation}</span>
                                  <span className="text-theme-text/80 font-serif italic text-xs sm:text-sm">of</span>
                                  <strong className="text-theme-text font-mono font-black">{p.entityB}</strong>
                                </span>
                                <span className="text-[10px] font-mono text-theme-text/70 bg-theme-comp/10 px-2 py-0.5 border border-theme-comp/30 font-bold mt-2 sm:mt-0">Premise #{innerPremiseIndex + 1}</span>
                              </div>
                            );
                          })()}

                          {/* Carousel Navigation */}
                          <div className="flex items-center justify-between pt-2 border-t border-theme-comp/10 select-none">
                            <button
                              onClick={() => setInnerPremiseIndex(prev => {
                                const len = currentPuzzle?.premises.length || 1;
                                return (prev - 1 + len) % len;
                              })}
                              className="flex items-center gap-1 px-3 py-1.5 border border-theme-comp/30 hover:border-theme-comp bg-theme-bg hover:bg-theme-comp/10 text-theme-text text-[10px] sm:text-xs font-mono font-bold cursor-pointer transition-all duration-150"
                            >
                              <ChevronLeft className="w-3.5 h-3.5 text-theme-comp" />
                              <span>Prev</span>
                            </button>

                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[10px] font-mono font-bold text-theme-text/80">
                                Premise {innerPremiseIndex + 1} of {currentPuzzle?.premises.length || 0}
                              </span>
                              <div className="flex gap-1.5">
                                {currentPuzzle?.premises.map((_, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => setInnerPremiseIndex(idx)}
                                    className={`w-1.5 h-1.5 rounded-full cursor-pointer transition-all duration-150 ${
                                      innerPremiseIndex === idx ? 'bg-theme-comp scale-125' : 'bg-theme-comp/20 hover:bg-theme-comp/40'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>

                            <button
                              onClick={() => setInnerPremiseIndex(prev => {
                                const len = currentPuzzle?.premises.length || 1;
                                return (prev + 1) % len;
                              })}
                              className="flex items-center gap-1 px-3 py-1.5 border border-theme-comp/30 hover:border-theme-comp bg-theme-bg hover:bg-theme-comp/10 text-theme-text text-[10px] sm:text-xs font-mono font-bold cursor-pointer transition-all duration-150"
                            >
                              <span>Next</span>
                              <ChevronRight className="w-3.5 h-3.5 text-theme-comp" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 font-sans select-text mt-1 max-h-[300px] overflow-y-auto">
                          {currentPuzzle?.premises.map((p, idx) => (
                            <div
                              key={idx}
                              onMouseEnter={() => setHighlightedPremiseId(`pzp-${idx}`)}
                              onMouseLeave={() => setHighlightedPremiseId(null)}
                              className="flex flex-wrap items-center justify-between bg-theme-bg border border-theme-comp/30 hover:border-theme-comp/80 px-4 py-2.5 text-xs transition-all duration-150 cursor-help"
                            >
                              <span className="flex items-center gap-2 flex-wrap text-theme-text">
                                <span className="w-1.5 h-1.5 bg-theme-comp rotate-45"></span>
                                <strong className="text-theme-text font-mono">{p.entityA}</strong>
                                <span className="text-theme-text/80 font-serif italic">is</span>
                                <span className="font-mono font-bold px-1.5 py-0.5" style={{ backgroundColor: 'var(--main-color-complementary)', color: 'var(--main-color)' }}>{p.relation}</span>
                                <span className="text-theme-text/80 font-serif italic">of</span>
                                <strong className="text-theme-text font-mono">{p.entityB}</strong>
                              </span>
                              <span className="text-[9px] font-mono text-theme-text/50 bg-theme-bg px-2 py-0.5 border border-dashed border-theme-comp/20 mt-1 sm:mt-0 font-bold">Premise #{idx + 1}</span>
                            </div>
                          ))}
                        </div>
                      )
                    )}

                    {workoutMode === 'context' && (
                      innerCarouselEnabled ? (
                        <div className="flex flex-col gap-4">
                          {(() => {
                            const def = currentCtxPuzzle?.nodeDefinitions[innerPremiseIndex];
                            if (!def) return <div className="text-xs text-theme-text/50 font-mono italic">No definitions available</div>;
                            return (
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-theme-bg border border-theme-comp px-5 py-4 transition-all duration-150 shadow-sm relative min-h-[70px]">
                                <span className="flex items-center gap-2 flex-wrap text-theme-text text-sm sm:text-base">
                                  <span className="w-2 h-2 border border-theme-comp rotate-45"></span>
                                  <strong className="text-theme-text font-mono font-black">{def.node}</strong>
                                  <span className="opacity-80 font-serif italic text-xs sm:text-sm">is initially positioned</span>
                                  <span className="font-mono font-bold px-2 py-0.5 text-xs sm:text-sm" style={{ backgroundColor: 'var(--main-color-complementary)', color: 'var(--main-color)' }}>{def.relation}</span>
                                  <span className="opacity-80 font-serif italic text-xs sm:text-sm">of</span>
                                  <strong className="text-theme-text font-mono font-black">{def.targetNode}</strong>
                                </span>
                                <span className="text-[10px] font-mono text-theme-text/70 bg-theme-comp/10 px-2 py-0.5 border border-theme-comp/30 font-bold mt-2 sm:mt-0">Mapping #{innerPremiseIndex + 1}</span>
                              </div>
                            );
                          })()}

                          {/* Carousel Navigation */}
                          <div className="flex items-center justify-between pt-2 border-t border-theme-comp/10 select-none">
                            <button
                              onClick={() => setInnerPremiseIndex(prev => {
                                const len = currentCtxPuzzle?.nodeDefinitions.length || 1;
                                return (prev - 1 + len) % len;
                              })}
                              className="flex items-center gap-1 px-3 py-1.5 border border-theme-comp/30 hover:border-theme-comp bg-theme-bg hover:bg-theme-comp/10 text-theme-text text-[10px] sm:text-xs font-mono font-bold cursor-pointer transition-all duration-150"
                            >
                              <ChevronLeft className="w-3.5 h-3.5 text-theme-comp" />
                              <span>Prev</span>
                            </button>

                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[10px] font-mono font-bold text-theme-text/80">
                                Definition {innerPremiseIndex + 1} of {currentCtxPuzzle?.nodeDefinitions.length || 0}
                              </span>
                              <div className="flex gap-1.5">
                                {currentCtxPuzzle?.nodeDefinitions.map((_, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => setInnerPremiseIndex(idx)}
                                    className={`w-1.5 h-1.5 rounded-full cursor-pointer transition-all duration-150 ${
                                      innerPremiseIndex === idx ? 'bg-theme-comp scale-125' : 'bg-theme-comp/20 hover:bg-theme-comp/40'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>

                            <button
                              onClick={() => setInnerPremiseIndex(prev => {
                                const len = currentCtxPuzzle?.nodeDefinitions.length || 1;
                                return (prev + 1) % len;
                              })}
                              className="flex items-center gap-1 px-3 py-1.5 border border-theme-comp/30 hover:border-theme-comp bg-theme-bg hover:bg-theme-comp/10 text-theme-text text-[10px] sm:text-xs font-mono font-bold cursor-pointer transition-all duration-150"
                            >
                              <span>Next</span>
                              <ChevronRight className="w-3.5 h-3.5 text-theme-comp" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 font-sans text-xs mt-1 max-h-[300px] overflow-y-auto">
                          {currentCtxPuzzle?.nodeDefinitions.map((def, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-theme-bg border border-theme-comp/30 px-4 py-2.5">
                              <span className="flex items-center gap-2 flex-wrap text-theme-text">
                                <span className="w-2 h-2 border border-theme-comp rotate-45"></span>
                                <strong className="text-theme-text font-mono">{def.node}</strong>
                                <span className="opacity-80 font-serif italic">is initially positioned</span>
                                <span className="font-mono font-bold px-1.5 py-0.5" style={{ backgroundColor: 'var(--main-color-complementary)', color: 'var(--main-color)' }}>{def.relation}</span>
                                <span className="opacity-80 font-serif italic">of</span>
                                <strong className="text-theme-text font-mono">{def.targetNode}</strong>
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    )}

                    {workoutMode === 'analogy' && (
                      <div className="flex flex-col gap-3 mt-1">
                        <div className="flex bg-theme-bg p-0.5 border border-theme-comp/20 z-10 select-none flex-wrap gap-0.5">
                          <button
                            onClick={() => setActiveAnalogyTab('ctx1')}
                            className={`flex-1 min-w-[120px] py-1 text-[10px] font-mono font-bold flex items-center justify-center gap-1.5 uppercase tracking-wide cursor-pointer transition-all duration-150 ${
                              activeAnalogyTab === 'ctx1'
                                ? 'bg-theme-comp text-theme-bg'
                                : 'text-theme-text hover:bg-theme-comp/10'
                            }`}
                          >
                            <Sliders className="w-3 h-3" />
                            Context {currentAnalogyPuzzle?.context1} Space
                          </button>
                          <button
                            onClick={() => setActiveAnalogyTab('ctx2')}
                            className={`flex-1 min-w-[120px] py-1 text-[10px] font-mono font-bold flex items-center justify-center gap-1.5 uppercase tracking-wide cursor-pointer transition-all duration-150 ${
                              activeAnalogyTab === 'ctx2'
                                ? 'bg-theme-comp text-theme-bg'
                                : 'text-theme-text hover:bg-theme-comp/10'
                            }`}
                          >
                            <Sliders className="w-3 h-3" />
                            Context {currentAnalogyPuzzle?.context2} Space
                          </button>
                          {currentAnalogyPuzzle?.context3 && (
                            <button
                              onClick={() => setActiveAnalogyTab('ctx3')}
                              className={`flex-1 min-w-[120px] py-1 text-[10px] font-mono font-bold flex items-center justify-center gap-1.5 uppercase tracking-wide cursor-pointer transition-all duration-150 ${
                                activeAnalogyTab === 'ctx3'
                                  ? 'bg-theme-comp text-theme-bg'
                                  : 'text-theme-text hover:bg-theme-comp/10'
                              }`}
                            >
                              <Sliders className="w-3 h-3" />
                              Context {currentAnalogyPuzzle.context3} Space
                            </button>
                          )}
                          {currentAnalogyPuzzle?.context4 && (
                            <button
                              onClick={() => setActiveAnalogyTab('ctx4')}
                              className={`flex-1 min-w-[120px] py-1 text-[10px] font-mono font-bold flex items-center justify-center gap-1.5 uppercase tracking-wide cursor-pointer transition-all duration-150 ${
                                activeAnalogyTab === 'ctx4'
                                  ? 'bg-theme-comp text-theme-bg'
                                  : 'text-theme-text hover:bg-theme-comp/10'
                              }`}
                            >
                              <Sliders className="w-3 h-3" />
                              Context {currentAnalogyPuzzle.context4} Space
                            </button>
                          )}
                        </div>

                        {innerCarouselEnabled ? (
                          <div className="flex flex-col gap-4">
                            {(() => {
                              const def = currentAnalogyPuzzle?.nodeDefinitions[innerPremiseIndex];
                              if (!def) return <div className="text-xs text-theme-text/50 font-mono italic">No definitions available</div>;
                              return (
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-theme-bg border border-theme-comp px-5 py-4 transition-all duration-150 shadow-sm relative min-h-[70px]">
                                  <span className="flex items-center gap-2 flex-wrap text-theme-text text-sm sm:text-base">
                                    <span className="w-1.5 h-1.5 border border-theme-comp rotate-45"></span>
                                    <strong className="text-theme-text font-mono font-black">{def.node}</strong>
                                    <span className="opacity-80 font-serif italic text-xs sm:text-sm">is</span>
                                    <span className="font-mono font-bold px-2 py-0.5 text-xs sm:text-sm" style={{ backgroundColor: 'var(--main-color-complementary)', color: 'var(--main-color)' }}>{def.relation}</span>
                                    <span className="opacity-80 font-serif italic text-xs sm:text-sm">of</span>
                                    <strong className="text-theme-text font-mono font-black">{def.targetNode}</strong>
                                  </span>
                                  <span className="text-[10px] font-mono text-theme-text/70 bg-theme-comp/10 px-2 py-0.5 border border-theme-comp/30 font-bold mt-2 sm:mt-0">Mapping #{innerPremiseIndex + 1}</span>
                                </div>
                              );
                            })()}

                            {/* Carousel Navigation */}
                            <div className="flex items-center justify-between pt-2 border-t border-theme-comp/10 select-none">
                              <button
                                onClick={() => setInnerPremiseIndex(prev => {
                                  const len = currentAnalogyPuzzle?.nodeDefinitions.length || 1;
                                  return (prev - 1 + len) % len;
                                })}
                                className="flex items-center gap-1 px-3 py-1.5 border border-theme-comp/30 hover:border-theme-comp bg-theme-bg hover:bg-theme-comp/10 text-theme-text text-[10px] sm:text-xs font-mono font-bold cursor-pointer transition-all duration-150"
                              >
                                <ChevronLeft className="w-3.5 h-3.5 text-theme-comp" />
                                <span>Prev</span>
                              </button>

                              <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] font-mono font-bold text-theme-text/80">
                                  Definition {innerPremiseIndex + 1} of {currentAnalogyPuzzle?.nodeDefinitions.length || 0}
                                </span>
                                <div className="flex gap-1.5">
                                  {currentAnalogyPuzzle?.nodeDefinitions.map((_, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => setInnerPremiseIndex(idx)}
                                      className={`w-1.5 h-1.5 rounded-full cursor-pointer transition-all duration-150 ${
                                        innerPremiseIndex === idx ? 'bg-theme-comp scale-125' : 'bg-theme-comp/20 hover:bg-theme-comp/40'
                                      }`}
                                    />
                                  ))}
                                </div>
                              </div>

                              <button
                                onClick={() => setInnerPremiseIndex(prev => {
                                  const len = currentAnalogyPuzzle?.nodeDefinitions.length || 1;
                                  return (prev + 1) % len;
                                })}
                                className="flex items-center gap-1 px-3 py-1.5 border border-theme-comp/30 hover:border-theme-comp bg-theme-bg hover:bg-theme-comp/10 text-theme-text text-[10px] sm:text-xs font-mono font-bold cursor-pointer transition-all duration-150"
                              >
                                <span>Next</span>
                                <ChevronRight className="w-3.5 h-3.5 text-theme-comp" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1.5 font-sans text-xs max-h-[250px] overflow-y-auto">
                            {currentAnalogyPuzzle?.nodeDefinitions.map((def, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-theme-bg border border-theme-comp/30 px-3 py-1.5">
                                <span className="flex items-center gap-2 flex-wrap text-theme-text font-medium">
                                  <span className="w-1.5 h-1.5 border border-theme-comp rotate-45"></span>
                                  <strong className="text-theme-text font-mono">{def.node}</strong>
                                  <span className="opacity-80 font-serif italic">is</span>
                                  <span className="font-mono font-bold px-1.5 py-0.5" style={{ backgroundColor: 'var(--main-color-complementary)', color: 'var(--main-color)' }}>{def.relation}</span>
                                  <span className="opacity-80 font-serif italic">of</span>
                                  <strong className="text-theme-text font-mono">{def.targetNode}</strong>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="bg-theme-bg border border-theme-comp/20 p-4 text-[11px] text-theme-text/80 leading-relaxed font-sans mt-auto">
                      <div className="flex items-center gap-2 mb-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-theme-comp" />
                        <span className="font-mono font-bold uppercase tracking-wider text-[9px]">Workspace Helper</span>
                      </div>
                      {workoutMode === 'classic' 
                        ? 'Trace the geometric relative positions from one entity to another across these rules. Once resolved, advance to Stage 2 or 3 to submit your deduction.'
                        : 'Review these anchor mappings first. They set the initial points from which dimensions get rotated or scaled in the next stage.'
                      }
                    </div>
                  </div>
                )}

                {/* Step 2: Context Window Switches */}
                {carouselIndex === 1 && (
                  <div className="flex-1 flex flex-col gap-3">
                    <div className="border-b border-theme-comp/20 pb-2">
                      <h4 className="font-mono text-xs font-bold uppercase text-theme-accent tracking-wide">
                        {workoutMode === 'classic' ? 'Standard Grid Coordinate Parameters' : 'Active Context Modifiers'}
                      </h4>
                      <p className="text-[10px] text-theme-text/60 font-sans mt-0.5">
                        {workoutMode === 'classic'
                          ? 'No active scaling or rotation shifts exist in the Classic deduction model.'
                          : 'These context values represent actively compiled transformation vectors modifying the space dimensions.'
                        }
                      </p>
                    </div>

                    {workoutMode === 'classic' && (
                      <div className="flex flex-col gap-4 mt-2">
                        <div className="bg-theme-bg border border-theme-comp/35 p-5 font-mono text-xs text-theme-text space-y-3.5">
                          <div className="flex items-center gap-2 text-theme-accent font-bold uppercase tracking-wide">
                            <Compass className="w-4 h-4" />
                            <span>Static Grid System Log</span>
                          </div>
                          <p className="font-sans leading-relaxed text-theme-text/90">
                            Deductions are resolved under constant, symmetric Cartesian coordinate axes. Vector scaling multipliers are locked at absolute 1:1, meaning each unit represents a standard shift relation.
                          </p>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-theme-comp/20">
                            <div className="p-3 bg-theme-card border border-theme-comp/10">
                              <div className="font-bold text-theme-accent uppercase tracking-wider text-[10px] mb-1">Session Dimensions</div>
                              <div className="text-sm font-bold">{selectedDim}D Cartesian Plane</div>
                            </div>
                            <div className="p-3 bg-theme-card border border-theme-comp/10">
                              <div className="font-bold text-theme-accent uppercase tracking-wider text-[10px] mb-1">Scaling Vector</div>
                              <div className="text-xs">[1.0, 1.0{selectedDim > 2 ? ', 1.0' : ''}] Constant</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {workoutMode === 'context' && (
                      innerCarouselEnabled ? (
                        <div className="flex flex-col gap-4">
                          {(() => {
                            const ctx = currentCtxPuzzle?.contextVehicles[innerModifierIndex];
                            if (!ctx) return <div className="text-xs text-theme-text/50 font-mono italic">No modifiers available</div>;
                            const deps = getContextDependencies(ctx);
                            return (
                              <div className="flex flex-col gap-3 bg-theme-bg border border-theme-comp px-5 py-4 transition-all duration-150 shadow-sm relative min-h-[100px]">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="flex items-center gap-2 flex-wrap font-mono font-black text-theme-text text-sm">
                                    <Sliders className="w-4 h-4 text-theme-comp" />
                                    <span>{ctx.text}</span>
                                  </span>
                                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 border uppercase ${
                                    ctx.isAnchor
                                      ? 'bg-theme-bg border-theme-comp/30 text-theme-text'
                                      : ctx.shiftMultiplier < 0 
                                        ? 'bg-theme-comp/10 border-theme-comp/50 text-theme-accent' 
                                        : 'bg-theme-comp/20 border-theme-comp text-theme-accent'
                                  }`}>
                                    {ctx.isAnchor ? 'Relative Vector' : ctx.shiftMultiplier < 0 ? 'Inversion' : 'Scale'}
                                  </span>
                                </div>
                                {deps.length > 0 && (
                                  <div className="pl-6 font-mono text-[10px] text-theme-accent flex items-center gap-1.5 uppercase tracking-wider font-bold">
                                    <span>Dependency Chain:</span>
                                    <span className="flex items-center gap-1 flex-wrap">
                                      {deps.map((d, dIdx) => (
                                        <span key={dIdx} className="flex items-center gap-1">
                                          {dIdx > 0 && <span className="opacity-40">&rarr;</span>}
                                          <span className="bg-theme-comp/10 border border-theme-comp/20 px-1.5 py-0.5 rounded-sm text-theme-text font-black">{d}</span>
                                        </span>
                                      ))}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Carousel Navigation */}
                          <div className="flex items-center justify-between pt-2 border-t border-theme-comp/10 select-none">
                            <button
                              onClick={() => setInnerModifierIndex(prev => {
                                const len = currentCtxPuzzle?.contextVehicles.length || 1;
                                return (prev - 1 + len) % len;
                              })}
                              className="flex items-center gap-1 px-3 py-1.5 border border-theme-comp/30 hover:border-theme-comp bg-theme-bg hover:bg-theme-comp/10 text-theme-text text-[10px] sm:text-xs font-mono font-bold cursor-pointer transition-all duration-150"
                            >
                              <ChevronLeft className="w-3.5 h-3.5 text-theme-comp" />
                              <span>Prev</span>
                            </button>

                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[10px] font-mono font-bold text-theme-text/80">
                                Modifier {innerModifierIndex + 1} of {currentCtxPuzzle?.contextVehicles.length || 0}
                              </span>
                              <div className="flex gap-1.5 flex-wrap justify-center">
                                {currentCtxPuzzle?.contextVehicles.map((_, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => setInnerModifierIndex(idx)}
                                    className={`w-1.5 h-1.5 rounded-full cursor-pointer transition-all duration-150 ${
                                      innerModifierIndex === idx ? 'bg-theme-comp scale-125' : 'bg-theme-comp/20 hover:bg-theme-comp/40'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>

                            <button
                              onClick={() => setInnerModifierIndex(prev => {
                                const len = currentCtxPuzzle?.contextVehicles.length || 1;
                                return (prev + 1) % len;
                              })}
                              className="flex items-center gap-1 px-3 py-1.5 border border-theme-comp/30 hover:border-theme-comp bg-theme-bg hover:bg-theme-comp/10 text-theme-text text-[10px] sm:text-xs font-mono font-bold cursor-pointer transition-all duration-150"
                            >
                              <span>Next</span>
                              <ChevronRight className="w-3.5 h-3.5 text-theme-comp" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5 font-sans select-text max-h-[300px] overflow-y-auto mt-1">
                          {currentCtxPuzzle?.contextVehicles.map((ctx, idx) => {
                            const deps = getContextDependencies(ctx);
                            return (
                              <div key={idx} className="flex flex-col gap-1 bg-theme-bg border border-theme-comp/30 px-4 py-2.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="flex items-center gap-2 flex-wrap font-mono font-bold text-theme-text">
                                    <Sliders className="w-3.5 h-3.5 text-theme-comp" />
                                    <span>{ctx.text}</span>
                                  </span>
                                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 border uppercase ${
                                    ctx.isAnchor
                                      ? 'bg-theme-bg border-theme-comp/30 text-theme-text'
                                      : ctx.shiftMultiplier < 0 
                                        ? 'bg-theme-comp/10 border-theme-comp/50 text-theme-accent' 
                                        : 'bg-theme-comp/20 border-theme-comp text-theme-accent'
                                  }`}>
                                    {ctx.isAnchor ? 'Relative Vector' : ctx.shiftMultiplier < 0 ? 'Inversion' : 'Scale'}
                                  </span>
                                </div>
                                {deps.length > 0 && (
                                  <div className="pl-5.5 font-mono text-[9px] text-theme-accent flex items-center gap-1.5 uppercase tracking-wider font-bold">
                                    <span>Dependency Chain:</span>
                                    <span className="flex items-center gap-1">
                                      {deps.map((d, dIdx) => (
                                        <span key={dIdx} className="flex items-center gap-1">
                                          {dIdx > 0 && <span className="opacity-40">&rarr;</span>}
                                          <span className="bg-theme-comp/10 border border-theme-comp/20 px-1 py-0.2 rounded-sm text-theme-text font-black">{d}</span>
                                        </span>
                                      ))}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )
                    )}

                    {workoutMode === 'analogy' && (
                      innerCarouselEnabled ? (
                        <div className="flex flex-col gap-4">
                          {(() => {
                            const ctx = currentAnalogyPuzzle?.contextVehicles[innerModifierIndex];
                            if (!ctx) return <div className="text-xs text-theme-text/50 font-mono italic">No modifiers available</div>;
                            const isC1 = ctx.id === currentAnalogyPuzzle?.context1;
                            const isC2 = ctx.id === currentAnalogyPuzzle?.context2;
                            const isC3 = !!currentAnalogyPuzzle?.context3 && ctx.id === currentAnalogyPuzzle.context3;
                            const isC4 = !!currentAnalogyPuzzle?.context4 && ctx.id === currentAnalogyPuzzle.context4;
                            const highlight = isC1 || isC2 || isC3 || isC4;
                            const deps = getContextDependencies(ctx);
                            return (
                              <div className={`flex flex-col gap-3 bg-theme-bg border px-5 py-4 transition-all duration-150 shadow-sm relative min-h-[100px] ${highlight ? 'border-theme-comp font-bold' : 'border-theme-comp/25 opacity-70'}`}>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="flex items-center gap-2 flex-wrap font-mono font-black text-theme-text text-sm">
                                    <Sliders className="w-4 h-4 text-theme-comp" />
                                    <span>{ctx.text}</span>
                                  </span>
                                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 border uppercase ${
                                    ctx.isAnchor ? 'bg-theme-bg border-theme-comp/30 text-theme-text' : 'bg-theme-comp/15 text-theme-accent'
                                  }`}>
                                    {ctx.isAnchor ? 'Relative Vector' : ctx.shiftMultiplier < 0 ? 'Inversion' : 'Scale'}
                                  </span>
                                </div>
                                {deps.length > 0 && (
                                  <div className="pl-6 font-mono text-[10px] text-theme-accent flex items-center gap-1.5 uppercase tracking-wider font-bold">
                                    <span>Dependency Chain:</span>
                                    <span className="flex items-center gap-1 flex-wrap">
                                      {deps.map((d, dIdx) => (
                                        <span key={dIdx} className="flex items-center gap-1">
                                          {dIdx > 0 && <span className="opacity-40">&rarr;</span>}
                                          <span className="bg-theme-comp/10 border border-theme-comp/20 px-1.5 py-0.5 rounded-sm text-theme-text font-black">{d}</span>
                                        </span>
                                      ))}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Carousel Navigation */}
                          <div className="flex items-center justify-between pt-2 border-t border-theme-comp/10 select-none">
                            <button
                              onClick={() => setInnerModifierIndex(prev => {
                                const len = currentAnalogyPuzzle?.contextVehicles.length || 1;
                                return (prev - 1 + len) % len;
                              })}
                              className="flex items-center gap-1 px-3 py-1.5 border border-theme-comp/30 hover:border-theme-comp bg-theme-bg hover:bg-theme-comp/10 text-theme-text text-[10px] sm:text-xs font-mono font-bold cursor-pointer transition-all duration-150"
                            >
                              <ChevronLeft className="w-3.5 h-3.5 text-theme-comp" />
                              <span>Prev</span>
                            </button>

                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[10px] font-mono font-bold text-theme-text/80">
                                Modifier {innerModifierIndex + 1} of {currentAnalogyPuzzle?.contextVehicles.length || 0}
                              </span>
                              <div className="flex gap-1.5 flex-wrap justify-center">
                                {currentAnalogyPuzzle?.contextVehicles.map((_, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => setInnerModifierIndex(idx)}
                                    className={`w-1.5 h-1.5 rounded-full cursor-pointer transition-all duration-150 ${
                                      innerModifierIndex === idx ? 'bg-theme-comp scale-125' : 'bg-theme-comp/20 hover:bg-theme-comp/40'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>

                            <button
                              onClick={() => setInnerModifierIndex(prev => {
                                const len = currentAnalogyPuzzle?.contextVehicles.length || 1;
                                return (prev + 1) % len;
                              })}
                              className="flex items-center gap-1 px-3 py-1.5 border border-theme-comp/30 hover:border-theme-comp bg-theme-bg hover:bg-theme-comp/10 text-theme-text text-[10px] sm:text-xs font-mono font-bold cursor-pointer transition-all duration-150"
                            >
                              <span>Next</span>
                              <ChevronRight className="w-3.5 h-3.5 text-theme-comp" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5 font-sans select-text max-h-[300px] overflow-y-auto mt-1">
                          {currentAnalogyPuzzle?.contextVehicles.map((ctx, idx) => {
                            const isC1 = ctx.id === currentAnalogyPuzzle?.context1;
                            const isC2 = ctx.id === currentAnalogyPuzzle?.context2;
                            const isC3 = !!currentAnalogyPuzzle?.context3 && ctx.id === currentAnalogyPuzzle.context3;
                            const isC4 = !!currentAnalogyPuzzle?.context4 && ctx.id === currentAnalogyPuzzle.context4;
                            const highlight = isC1 || isC2 || isC3 || isC4;
                            const deps = getContextDependencies(ctx);
                            return (
                              <div key={idx} className={`flex flex-col gap-1 bg-theme-bg border px-4 py-2.5 text-xs ${highlight ? 'border-theme-comp font-bold' : 'border-theme-comp/20 opacity-60'}`}>
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-2 flex-wrap font-mono text-theme-text">
                                    <Sliders className="w-3.5 h-3.5 text-theme-comp" />
                                    <span>{ctx.text}</span>
                                  </span>
                                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 border uppercase ${
                                    ctx.isAnchor ? 'bg-theme-bg border-theme-comp/30 text-theme-text' : 'bg-theme-comp/15 text-theme-accent'
                                  }`}>
                                    {ctx.isAnchor ? 'Relative Vector' : ctx.shiftMultiplier < 0 ? 'Inversion' : 'Scale'}
                                  </span>
                                </div>
                                {deps.length > 0 && (
                                  <div className="pl-5.5 font-mono text-[9px] text-theme-accent flex items-center gap-1.5 uppercase tracking-wider font-bold">
                                    <span>Dependency Chain:</span>
                                    <span className="flex items-center gap-1">
                                      {deps.map((d, dIdx) => (
                                        <span key={dIdx} className="flex items-center gap-1">
                                          {dIdx > 0 && <span className="opacity-40">&rarr;</span>}
                                          <span className="bg-theme-comp/10 border border-theme-comp/20 px-1 py-0.2 rounded-sm text-theme-text font-black">{d}</span>
                                        </span>
                                      ))}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )
                    )}

                    <div className="bg-theme-bg border border-theme-comp/20 p-4 text-[11px] text-theme-text/80 leading-relaxed font-sans mt-auto">
                      <div className="flex items-center gap-2 mb-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-theme-comp" />
                        <span className="font-mono font-bold uppercase tracking-wider text-[9px]">Shift Mechanics Tip</span>
                      </div>
                      {workoutMode === 'classic'
                        ? 'Because there are no mutations active, move to Stage 3 to view the query directly and input your answer!'
                        : 'These modifiers stack sequentially. Any Inversion flips axis direction (multiplies by -1), while Scaling scales the magnitude.'
                      }
                    </div>
                  </div>
                )}

                {/* Step 3: Conclusion Frame */}
                {carouselIndex === 2 && (
                  <div className="flex-1 flex flex-col gap-3">
                    <div className="border-b border-theme-comp/20 pb-2">
                      <h4 className="font-mono text-xs font-bold uppercase text-theme-accent tracking-wide">
                        Deduction Resolution & Submission
                      </h4>
                      <p className="text-[10px] text-theme-text/60 font-sans mt-0.5">
                        Evaluate the relations, select your target response card, and submit your cognitive deductions.
                      </p>
                    </div>
                       {/* Inquiry & Explanations (Slide 0) */}
                    {(!innerCarouselEnabled || innerStage3Index === 0) && (
                      <>
                        {workoutMode === 'classic' && currentPuzzle && (
                          <div className="bg-theme-bg border border-theme-comp p-4 my-1 select-text">
                            <div className="flex gap-2.5 items-start">
                              <HelpCircle className="w-5 h-5 shrink-0 mt-0.5 text-theme-comp" />
                              <div className="flex flex-col">
                                <p className="text-[10px] font-mono font-bold text-theme-text uppercase tracking-wide opacity-75">Deduce Vector Displacement</p>
                                <p className="text-sm font-sans font-bold text-theme-text leading-relaxed mt-1">
                                  Determine the coordinates position of <strong className="font-mono px-1 ml-1" style={{ backgroundColor: 'var(--main-color-complementary)', color: 'var(--main-color)' }}>{currentPuzzle.question.entityA}</strong> with respect to <strong className="font-mono border border-theme-comp/40 px-1 ml-1 bg-theme-card">{currentPuzzle.question.entityB}</strong>.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {workoutMode === 'context' && currentCtxPuzzle && (
                          <div className="bg-theme-bg border border-theme-comp p-4 my-1 select-text font-sans">
                            <div className="flex gap-2.5 items-start">
                              <HelpCircle className="w-5 h-5 shrink-0 mt-0.5 text-theme-comp" />
                              <div className="flex flex-col flex-1">
                                <p className="text-[10px] font-mono font-bold text-theme-text uppercase tracking-wide opacity-60">Hyperspatial Resolution Inquiry</p>
                                <p className="text-theme-text font-bold leading-relaxed mt-1 text-sm md:text-base">
                                  What is <strong className="font-mono px-1.5 py-0.5 text-xs" style={{ backgroundColor: 'var(--main-color-complementary)', color: 'var(--main-color)' }}>{currentCtxPuzzle.queryNode}::{currentCtxPuzzle.queryTarget}</strong> in context <strong className="font-mono border border-theme-comp px-1.5 py-0.5 bg-theme-card font-extrabold text-theme-accent text-xs">[{currentCtxPuzzle.activeContextGroup.join('')}]</strong>?
                                </p>
                                
                                <div className="mt-3 flex items-center justify-between border-t border-dashed border-theme-comp/20 pt-2.5 flex-wrap gap-2">
                                  <span className="text-[10px] font-mono text-theme-text/60 font-medium">Need help spatializing the transformations?</span>
                                  <button
                                    onClick={() => setShowCtxExplanation(prev => !prev)}
                                    className="px-2.5 py-1 bg-theme-card hover:bg-theme-comp/10 text-theme-text text-[10px] font-mono font-bold border border-theme-comp flex items-center gap-1.5 cursor-pointer uppercase tracking-tight select-none transition-all duration-150"
                                  >
                                    <Brain className="w-3 h-3" />
                                    {showCtxExplanation ? 'Hide Derivation' : 'Explain Process'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {workoutMode === 'analogy' && currentAnalogyPuzzle && (
                          <div className="bg-theme-bg border border-theme-comp p-4 my-1 select-text font-sans">
                            <div className="flex gap-2.5 items-start">
                              <HelpCircle className="w-5 h-5 shrink-0 mt-0.5 text-theme-comp animate-pulse" />
                              <div className="flex flex-col flex-1">
                                <p className="text-[10px] font-mono font-bold text-theme-text uppercase tracking-wide opacity-65">Cognitive Analogy Statement</p>
                                
                                {currentAnalogyPuzzle.analogyStructureType === 'nested' ? (
                                  <div className="flex flex-col gap-2 mt-2 p-3 bg-theme-card border border-theme-comp/40 text-xs">
                                    <div className="text-center font-mono text-[9px] uppercase tracking-wider text-theme-text/40 mb-0.5">- Left Meta Relation -</div>
                                    <div className="flex flex-col gap-1 border border-theme-comp/10 p-2 bg-theme-bg/30">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-mono uppercase text-theme-accent/80">Context {currentAnalogyPuzzle.context1}</span>
                                        <span className="font-mono font-bold text-theme-text">{currentAnalogyPuzzle.nodeA} : {currentAnalogyPuzzle.nodeB}</span>
                                      </div>
                                      <div className="text-center italic font-serif text-[10px] opacity-40">::</div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-mono uppercase text-theme-accent/80">Context {currentAnalogyPuzzle.context2}</span>
                                        <span className="font-mono font-bold text-theme-text">{currentAnalogyPuzzle.nodeC} : {currentAnalogyPuzzle.nodeD}</span>
                                      </div>
                                    </div>

                                    <div className="text-center italic font-serif text-xs py-1 text-theme-accent font-extrabold select-none">is meta-analogous to</div>

                                    <div className="text-center font-mono text-[9px] uppercase tracking-wider text-theme-text/40 mb-0.5">- Right Meta Relation -</div>
                                    <div className="flex flex-col gap-1 border border-theme-comp/10 p-2 bg-theme-bg/30">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-mono uppercase text-theme-accent/80">Context {currentAnalogyPuzzle.context3}</span>
                                        <span className="font-mono font-bold text-theme-text">{currentAnalogyPuzzle.nodeE} : {currentAnalogyPuzzle.nodeF}</span>
                                      </div>
                                      <div className="text-center italic font-serif text-[10px] opacity-40">::</div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-mono uppercase text-theme-accent/80">Context {currentAnalogyPuzzle.context4}</span>
                                        <span className="font-mono font-bold text-theme-text">
                                          {currentAnalogyPuzzle.nodeG} : <span className="font-extrabold text-theme-accent bg-theme-comp/15 px-1 py-0.5 border border-theme-comp">{currentAnalogyPuzzle.nodeH}</span>
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ) : currentAnalogyPuzzle.analogyChainLength === 3 ? (
                                  <div className="flex flex-col gap-1.5 mt-2 p-3 bg-theme-card border border-theme-comp/40 text-xs">
                                    <div className="flex items-center justify-between border-b border-theme-comp/10 pb-1.5">
                                      <span className="text-[10px] font-mono uppercase text-theme-accent/80">Context {currentAnalogyPuzzle.context1} (Term 1)</span>
                                      <span className="font-mono font-bold text-theme-text">
                                        <span className="text-theme-accent font-extrabold">{currentAnalogyPuzzle.nodeA}</span> : {currentAnalogyPuzzle.nodeB}
                                      </span>
                                    </div>
                                    <div className="text-center italic font-serif text-[10px] opacity-50">::</div>
                                    <div className="flex items-center justify-between py-1 bg-theme-bg/20 border-y border-theme-comp/5">
                                      <span className="text-[10px] font-mono uppercase text-theme-accent/80">Context {currentAnalogyPuzzle.context2} (Term 2)</span>
                                      <span className="font-mono font-bold text-theme-text">{currentAnalogyPuzzle.nodeC} : {currentAnalogyPuzzle.nodeD}</span>
                                    </div>
                                    <div className="text-center italic font-serif text-[10px] opacity-50">::</div>
                                    <div className="flex items-center justify-between border-t border-theme-comp/10 pt-1.5">
                                      <span className="text-[10px] font-mono uppercase text-theme-accent/80">Context {currentAnalogyPuzzle.context3} (Term 3)</span>
                                      <span className="font-mono font-bold text-theme-text flex items-center gap-1">
                                        {currentAnalogyPuzzle.nodeE} : <span className="font-extrabold text-theme-accent bg-theme-comp/15 px-1 py-0.5 border border-theme-comp">{currentAnalogyPuzzle.nodeF}</span>
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-1.5 mt-2 p-3 bg-theme-card border border-theme-comp/40 text-xs">
                                    <div className="flex items-center justify-between border-b border-theme-comp/10 pb-1.5">
                                      <span className="text-[10px] font-mono uppercase text-theme-accent/80">Context {currentAnalogyPuzzle.context1} (Term 1)</span>
                                      <span className="font-mono font-bold text-theme-text">
                                        <span className="text-theme-accent font-extrabold">{currentAnalogyPuzzle.nodeA}</span> : {currentAnalogyPuzzle.nodeB}
                                      </span>
                                    </div>
                                    <div className="text-center italic font-serif text-[11px] opacity-60">is analogous to</div>
                                    <div className="flex items-center justify-between border-t border-theme-comp/10 pt-1.5">
                                      <span className="text-[10px] font-mono uppercase text-theme-accent/80">Context {currentAnalogyPuzzle.context2} (Term 2)</span>
                                      <span className="font-mono font-bold text-theme-text">
                                        {currentAnalogyPuzzle.nodeC} : <span className="font-extrabold text-theme-accent bg-theme-comp/15 px-1.5 py-0.5 border border-theme-comp">{currentAnalogyPuzzle.nodeD}</span>
                                      </span>
                                    </div>
                                  </div>
                                )}

                                <p className="text-theme-text text-[11px] leading-relaxed mt-3">
                                  {currentAnalogyPuzzle.analogyStructureType === 'nested'
                                    ? `Determine if the relationship difference (Left Meta Offset) between Context ${currentAnalogyPuzzle.context1} and ${currentAnalogyPuzzle.context2} aligns perfectly with the difference (Right Meta Offset) between Context ${currentAnalogyPuzzle.context3} and ${currentAnalogyPuzzle.context4}.`
                                    : currentAnalogyPuzzle.analogyChainLength === 3
                                      ? `Evaluate whether the spatial relationships across all 3 Terms after applying their respective context modifiers are completely congruent.`
                                      : `Evaluate whether the spatial relationship in Term 1 (under Context ${currentAnalogyPuzzle.context1}) matches exactly with the relationship in Term 2 (under Context ${currentAnalogyPuzzle.context2}) after respective shift products are applied.`
                                  }
                                </p>
                                
                                <div className="mt-3 flex items-center justify-between border-t border-dashed border-theme-comp/20 pt-2.5 flex-wrap gap-2">
                                  <span className="text-[10px] font-mono text-theme-text/60 font-medium">Need help spatializing the transformations?</span>
                                  <button
                                    onClick={() => setShowAnalogyExplanation(prev => !prev)}
                                    className="px-2.5 py-1 bg-theme-card hover:bg-theme-comp/10 text-theme-text text-[10px] font-mono font-bold border border-theme-comp flex items-center gap-1.5 cursor-pointer uppercase tracking-tight select-none transition-all duration-150"
                                  >
                                    <Brain className="w-3 h-3" />
                                    {showAnalogyExplanation ? 'Hide Derivation' : 'Explain Process'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {showCtxExplanation && workoutMode === 'context' && currentCtxPuzzle && (
                          <div className="bg-theme-bg border border-theme-comp p-4 my-1 text-[11px] font-mono max-h-[200px] overflow-y-auto select-text animate-fadeIn">
                            <div className="flex items-center gap-1.5 text-theme-text font-bold border-b border-theme-comp pb-2 mb-2 uppercase tracking-wide text-[10px]">
                              <Activity className="w-4 h-4 text-theme-comp animate-pulse" />
                              <span>Hyperspatial Logic Resolution Log</span>
                            </div>
                            <div className="space-y-3 text-theme-text leading-relaxed">
                              <div>
                                <span className="font-bold border-b border-theme-comp/30 pb-0.5">1. Baseline Coordinate Difference:</span> <br />
                                - The initial spatial offset <strong className="font-bold">{currentCtxPuzzle.queryNode}::{currentCtxPuzzle.queryTarget}</strong> matches relation: <br />
                                <code className="bg-theme-card px-2 py-0.5 font-bold border border-theme-comp/25 inline-block mt-1">
                                  [{currentCtxPuzzle.baseOffsetVector.slice(0, selectedDim).join(', ')}] ({currentCtxPuzzle.baseRelation})
                                </code>
                              </div>
                              
                              <div>
                                <span className="font-bold border-b border-theme-comp/30 pb-0.5">2. Compiling Modifiers Stack:</span> <br />
                                {currentCtxPuzzle.contextVehicles.map((cv, id) => {
                                  const isActive = currentCtxPuzzle.activeContextGroup.includes(cv.id);
                                  const repVec = cv.representedVector || Array(selectedDim).fill(0);
                                  const relationName = describeContextVector(repVec, selectedDim);
                                  return (
                                    <span key={id} className="block pl-3 mt-1.5 border-l border-dashed border-theme-comp/30">
                                      • <strong className="text-[11px]">{cv.text}</strong> &rarr; <span className={isActive ? "font-bold bg-theme-comp/10 border border-theme-comp text-theme-accent px-1" : "opacity-45"}>
                                        {isActive ? 'ACTIVE IN STACK' : 'BYPASSED'}
                                      </span>
                                      {isActive && (
                                        <span className="block text-[10px] pl-2 mt-0.5 text-theme-text/85">
                                          Result: <strong className="font-sans font-bold text-xs text-theme-accent">{relationName} [{repVec.slice(0, selectedDim).join(', ')}]</strong>
                                        </span>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                              
                              <div className="border-t border-dashed border-theme-comp/20 pt-2">
                                <span className="font-bold border-b border-theme-comp/30 pb-0.5">3. Compounding Result:</span> <br />
                                <code className="px-2 py-1 inline-block mt-1 font-bold text-xs" style={{ backgroundColor: 'var(--main-color-complementary)', color: 'var(--main-color)' }}>
                                  [{currentCtxPuzzle.projectedVector.slice(0, selectedDim).join(', ')}] ({currentCtxPuzzle.projectedRelation})
                                </code>
                              </div>
                            </div>
                          </div>
                        )}

                        {showAnalogyExplanation && workoutMode === 'analogy' && currentAnalogyPuzzle && (
                          <div className="bg-theme-bg border border-theme-comp p-4 my-1 text-[11px] font-mono max-h-[200px] overflow-y-auto select-text animate-fadeIn">
                            <div className="flex items-center gap-1.5 text-theme-text font-bold border-b border-theme-comp pb-2 mb-2 uppercase tracking-wide text-[10px]">
                              <Activity className="w-4 h-4 text-theme-comp animate-pulse" />
                              <span>Analogy Logic Resolution Log</span>
                            </div>
                            <div className="space-y-2 text-theme-text leading-relaxed">
                              {currentAnalogyPuzzle.explanation.split('\n\n').map((paragraph, pIdx) => (
                                <p key={pIdx} dangerouslySetInnerHTML={{ 
                                  __html: paragraph
                                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                    .replace(/\$(.*?)\$/g, '<code class="bg-theme-card border border-theme-comp/20 px-1 font-mono">$1</code>')
                                }} />
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Multiple Choice & Submit Buttons (Slide 1) */}
                    {(!innerCarouselEnabled || innerStage3Index === 1) && (
                      <>
                        <div className="flex flex-col gap-2 mt-2 select-none">
                          <span className="text-[10px] font-mono text-theme-text/60 font-bold uppercase tracking-wider">SELECT RESPONSE CARD</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {workoutMode === 'classic' && currentPuzzle?.options.map((opt, idx) => {
                              const isSelected = selectedAnswerIdx === idx;
                              let cardStyle = "border-theme-comp/30 bg-theme-bg/50 text-theme-text hover:bg-theme-comp/10";
                              if (isSelected) cardStyle = "border border-theme-comp bg-theme-comp text-theme-bg font-bold";
                              if (isSubmitted) {
                                if (opt.isCorrect) {
                                  cardStyle = "border border-green-600 bg-theme-bg text-green-500 font-bold shadow-sm";
                                } else if (isSelected) {
                                  cardStyle = "border border-red-500 bg-theme-bg text-red-500 line-through opacity-70";
                                } else {
                                  cardStyle = "border-theme-comp/10 bg-theme-bg/10 opacity-30 cursor-not-allowed";
                                }
                              }

                              return (
                                <button
                                  key={idx}
                                  onClick={() => handleSelectAnswer(idx)}
                                  disabled={isSubmitted}
                                  className={`text-left p-3 border transition-all duration-150 cursor-pointer flex items-center justify-between rounded-none text-xs ${cardStyle}`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <span className={`w-4.5 h-4.5 border text-[9px] font-mono flex items-center justify-center font-bold rounded-none ${
                                      isSelected ? 'bg-theme-comp border-theme-comp text-theme-bg' : 'border-theme-comp text-theme-text/50'
                                    }`}>
                                      {String.fromCharCode(65 + idx)}
                                    </span>
                                    <span className="font-mono text-xs font-bold uppercase tracking-wide">{opt.relation}</span>
                                  </div>
                                </button>
                              );
                            })}

                            {workoutMode === 'context' && currentCtxPuzzle?.options.map((opt, idx) => {
                              const isSelected = selectedCtxAnswerIdx === idx;
                              let cardStyle = "border-theme-comp/30 bg-theme-bg/50 text-theme-text hover:bg-theme-comp/10";
                              if (isSelected) cardStyle = "border border-theme-comp bg-theme-comp text-theme-bg font-bold";
                              if (isSubmitted) {
                                if (opt.isCorrect) {
                                  cardStyle = "border border-green-600 bg-theme-bg text-green-500 font-bold shadow-sm";
                                } else if (isSelected) {
                                  cardStyle = "border border-red-500 bg-theme-bg text-red-500 line-through opacity-70";
                                } else {
                                  cardStyle = "border-theme-comp/10 bg-theme-bg/10 opacity-30 cursor-not-allowed";
                                }
                              }

                              return (
                                <button
                                  key={idx}
                                  onClick={() => handleSelectAnswer(idx)}
                                  disabled={isSubmitted}
                                  className={`text-left p-3 border transition-all duration-150 cursor-pointer flex items-center justify-between rounded-none text-xs ${cardStyle}`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <span className={`w-4.5 h-4.5 border text-[9px] font-mono flex items-center justify-center font-bold rounded-none ${
                                      isSelected ? 'bg-theme-comp border-theme-comp text-theme-bg' : 'border-theme-comp text-theme-text/50'
                                    }`}>
                                      {String.fromCharCode(65 + idx)}
                                    </span>
                                    <span className="font-mono text-xs font-bold uppercase tracking-wide">{opt.text}</span>
                                  </div>
                                </button>
                              );
                            })}

                            {workoutMode === 'analogy' && currentAnalogyPuzzle?.options.map((opt, idx) => {
                              const isSelected = selectedAnalogyAnswerIdx === idx;
                              let cardStyle = "border-theme-comp/30 bg-theme-bg/50 text-theme-text hover:bg-theme-comp/10";
                              if (isSelected) cardStyle = "border border-theme-comp bg-theme-comp text-theme-bg font-bold";
                              if (isSubmitted) {
                                if (opt.isCorrect) {
                                  cardStyle = "border border-green-600 bg-theme-bg text-green-500 font-bold shadow-sm";
                                } else if (isSelected) {
                                  cardStyle = "border border-red-500 bg-theme-bg text-red-500 line-through opacity-70";
                                } else {
                                  cardStyle = "border-theme-comp/10 bg-theme-bg/10 opacity-30 cursor-not-allowed";
                                }
                              }

                              return (
                                <button
                                  key={idx}
                                  onClick={() => handleSelectAnswer(idx)}
                                  disabled={isSubmitted}
                                  className={`text-left p-3 border transition-all duration-150 cursor-pointer flex items-center justify-between rounded-none text-xs ${cardStyle}`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <span className={`w-4.5 h-4.5 border text-[9px] font-mono flex items-center justify-center font-bold rounded-none ${
                                      isSelected ? 'bg-theme-comp border-theme-comp text-theme-bg' : 'border-theme-comp text-theme-text/50'
                                    }`}>
                                      {String.fromCharCode(65 + idx)}
                                    </span>
                                    <span className="font-mono text-xs font-bold uppercase tracking-wide">{opt.text}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Submit & Next Actions Block */}
                        <div className="mt-4 pt-3 border-t border-theme-comp/30 select-none">
                          {!isSubmitted ? (
                            <button
                              onClick={handleSubmitAnswer}
                              disabled={
                                (workoutMode === 'classic' && selectedAnswerIdx === null) ||
                                (workoutMode === 'context' && selectedCtxAnswerIdx === null) ||
                                (workoutMode === 'analogy' && selectedAnalogyAnswerIdx === null)
                              }
                              className="w-full bg-theme-comp hover:bg-theme-comp/90 disabled:opacity-30 disabled:cursor-not-allowed text-theme-bg text-xs font-mono font-bold py-3 px-4 border border-theme-comp flex items-center justify-center gap-2 cursor-pointer transition-all duration-150 uppercase tracking-widest h-[44px]"
                            >
                              <span>
                                {workoutMode === 'classic' 
                                  ? 'Submit Relational Deductions' 
                                  : workoutMode === 'context' 
                                    ? 'Submit Projections deductions' 
                                    : 'Submit Analogy Resolution'
                                }
                              </span>
                              <ArrowRight className="w-4 h-4 ml-0.5" />
                            </button>
                          ) : (
                            <div className="flex flex-col gap-3">
                              <div className="text-center py-1 text-xs font-sans font-bold uppercase tracking-wider">
                                {workoutMode === 'classic' && (
                                  currentPuzzle?.options[selectedAnswerIdx ?? 0]?.isCorrect ? (
                                    <span className="text-green-500 flex items-center justify-center gap-1.5 bg-theme-bg border border-green-600 py-2 font-bold font-mono">
                                      <Trophy className="w-4 h-4" /> SUCCESS • +{100 + Math.max(0, Math.floor((60 - seconds) * 1.5))} SCORE ACCUMULATED
                                    </span>
                                  ) : (
                                    <span className="text-red-500 flex items-center justify-center gap-1.5 bg-theme-bg border border-red-500 py-2 font-bold font-mono">
                                      DEDUCTION ENCOUNTERED COGNITIVE DIVERGENCE
                                    </span>
                                  )
                                )}

                                {workoutMode === 'context' && (
                                  currentCtxPuzzle?.options[selectedCtxAnswerIdx ?? 0]?.isCorrect ? (
                                    <span className="text-green-500 flex items-center justify-center gap-1.5 bg-theme-bg border border-green-600 py-2 font-bold font-mono">
                                      <Trophy className="w-4 h-4" /> SUCCESS • +{120 + Math.max(0, Math.floor((90 - seconds) * 1.5))} SCORE GAINED
                                    </span>
                                  ) : (
                                    <span className="text-red-500 flex items-center justify-center gap-1.5 bg-theme-bg border border-red-500 py-2 font-bold font-mono">
                                      PROJECTION DEVIAVATION DETECTED BY MATRIX
                                    </span>
                                  )
                                )}

                                {workoutMode === 'analogy' && (
                                  currentAnalogyPuzzle?.options[selectedAnalogyAnswerIdx ?? 0]?.isCorrect ? (
                                    <span className="text-green-500 flex items-center justify-center gap-1.5 bg-theme-bg border border-green-600 py-2 font-bold font-mono">
                                      <Trophy className="w-4 h-4" /> SUCCESS • +{150 + Math.max(0, Math.floor((120 - seconds) * 1.5))} SCORE GAINED
                                    </span>
                                  ) : (
                                    <span className="text-red-500 flex items-center justify-center gap-1.5 bg-theme-bg border border-red-500 py-2 font-bold font-mono">
                                      ANALOGOUS RESOLUTION MISALIGNED
                                    </span>
                                  )
                                )}
                              </div>
                              
                              <button
                                onClick={handleNextPuzzle}
                                className="w-full bg-theme-comp hover:bg-theme-comp/90 text-theme-bg text-xs font-sans font-bold py-3 px-4 border border-theme-comp flex items-center justify-center gap-2 cursor-pointer transition-all uppercase tracking-wide h-[44px]"
                              >
                                <RotateCw className="w-3.5 h-3.5" />
                                <span>
                                  {workoutMode === 'classic' 
                                    ? 'Request Next Vector Matrix' 
                                    : workoutMode === 'context' 
                                      ? 'Request Next Coordinate Domain' 
                                      : 'Request Next Analogy Matrix'
                                  }
                                </span>
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Nested Stage 3 Inner Carousel Sub-stepper */}
                    {innerCarouselEnabled && (
                      <div className="flex items-center justify-between pt-4 mt-2 border-t border-theme-comp/20 select-none">
                        <button
                          onClick={() => setInnerStage3Index(0)}
                          disabled={innerStage3Index === 0}
                          className="flex items-center gap-1 px-3 py-1.5 border border-theme-comp/30 hover:border-theme-comp disabled:opacity-30 disabled:cursor-not-allowed bg-theme-bg hover:bg-theme-comp/10 text-theme-text text-[10px] sm:text-xs font-mono font-bold cursor-pointer transition-all duration-150"
                        >
                          <ChevronLeft className="w-3.5 h-3.5 text-theme-comp" />
                          <span>01. Inquiry</span>
                        </button>

                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[10px] font-mono font-bold text-theme-text/80">
                            Stage 3 Resolution: Panel {innerStage3Index + 1} of 2
                          </span>
                          <div className="flex gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${innerStage3Index === 0 ? 'bg-theme-comp scale-110' : 'bg-theme-comp/20'}`} />
                            <span className={`w-1.5 h-1.5 rounded-full ${innerStage3Index === 1 ? 'bg-theme-comp scale-110' : 'bg-theme-comp/20'}`} />
                          </div>
                        </div>

                        <button
                          onClick={() => setInnerStage3Index(1)}
                          disabled={innerStage3Index === 1}
                          className="flex items-center gap-1 px-3 py-1.5 border border-theme-comp/30 hover:border-theme-comp disabled:opacity-30 disabled:cursor-not-allowed bg-theme-bg hover:bg-theme-comp/10 text-theme-text text-[10px] sm:text-xs font-mono font-bold cursor-pointer transition-all duration-150"
                        >
                          <span>02. Options</span>
                          <ChevronRight className="w-3.5 h-3.5 text-theme-comp" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Bottom Stepper Arrow Controls */}
            <div className="flex items-center justify-between border-t border-theme-comp/20 pt-4 mt-6 select-none z-10">
              <button
                disabled={carouselIndex === 0}
                onClick={() => setCarouselIndex(prev => Math.max(0, prev - 1))}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold uppercase border border-theme-comp text-theme-text hover:bg-theme-comp/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              
              <div className="flex items-center gap-2 text-xs font-mono text-theme-text/70">
                <span>Stage {carouselIndex + 1} of 3</span>
                <div className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${carouselIndex === 0 ? 'bg-theme-comp' : 'bg-theme-comp/20'}`}></span>
                  <span className={`w-1.5 h-1.5 rounded-full ${carouselIndex === 1 ? 'bg-theme-comp' : 'bg-theme-comp/20'}`}></span>
                  <span className={`w-1.5 h-1.5 rounded-full ${carouselIndex === 2 ? 'bg-theme-comp' : 'bg-theme-comp/20'}`}></span>
                </div>
              </div>

              <button
                disabled={carouselIndex === 2}
                onClick={() => setCarouselIndex(prev => Math.min(2, prev + 1))}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold uppercase border border-theme-comp text-theme-text hover:bg-theme-comp/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
