import { Vector, Premise, SolverResult, EntityNode, Contradiction, DimensionCount, Puzzle, PuzzleDifficulty, AbstractRelationMapping } from '../types';

export const DEFAULT_BASIS_2D: Record<string, Vector> = {
  'NORTH': [1, 0],
  'SOUTH': [-1, 0],
  'EAST': [0, 1],
  'WEST': [0, -1],
  'NORTHEAST': [1, 1],
  'NORTHWEST': [1, -1],
  'SOUTHEAST': [-1, 1],
  'SOUTHWEST': [-1, -1]
};

export const DEFAULT_BASIS_3D: Record<string, Vector> = {
  'NORTH': [1, 0, 0],
  'SOUTH': [-1, 0, 0],
  'EAST': [0, 1, 0],
  'WEST': [0, -1, 0],
  'NORTHEAST': [1, 1, 0],
  'NORTHWEST': [1, -1, 0],
  'SOUTHEAST': [-1, 1, 0],
  'SOUTHWEST': [-1, -1, 0],
  'ABOVE': [0, 0, 1],
  'BELOW': [0, 0, -1],
  'NORTH-ABOVE': [1, 0, 1],
  'SOUTH-BELOW': [-1, 0, -1],
  'EAST-ABOVE': [0, 1, 1],
  'WEST-BELOW': [0, -1, -1],
  'NORTHEAST-ABOVE': [1, 1, 1],
  'SOUTHWEST-BELOW': [-1, -1, -1]
};

export const DEFAULT_BASIS_4D: Record<string, Vector> = {
  'NORTH': [1, 0, 0, 0],
  'SOUTH': [-1, 0, 0, 0],
  'EAST': [0, 1, 0, 0],
  'WEST': [0, -1, 0, 0],
  'NORTHEAST': [1, 1, 0, 0],
  'NORTHWEST': [1, -1, 0, 0],
  'SOUTHEAST': [-1, 1, 0, 0],
  'SOUTHWEST': [-1, -1, 0, 0],
  'ABOVE': [0, 0, 1, 0],
  'BELOW': [0, 0, -1, 0],
  'AFTER': [0, 0, 0, 1],   // Inward/future/hyper-up
  'BEFORE': [0, 0, 0, -1], // Outward/past/hyper-down
  'NORTH-ABOVE': [1, 0, 1, 0],
  'SOUTH-BELOW': [-1, 0, -1, 0],
  'EAST-ABOVE': [0, 1, 1, 0],
  'WEST-BELOW': [0, -1, -1, 0],
  'NORTHEAST-ABOVE': [1, 1, 1, 0],
  'SOUTHWEST-BELOW': [-1, -1, -1, 0],
  'NORTHEAST-ABOVE-AFTER': [1, 1, 1, 1],
  'SOUTHWEST-BELOW-BEFORE': [-1, -1, -1, -1]
};

export function getBasisRelations(dimension: DimensionCount): Record<string, Vector> {
  if (dimension === 2) return DEFAULT_BASIS_2D;
  if (dimension === 3) return DEFAULT_BASIS_3D;
  return DEFAULT_BASIS_4D;
}

export function parseVector(str: string, dimension: number): Vector | null {
  try {
    const raw = str.trim();
    if (!raw) return null;
    
    let cleaned = raw;
    if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
      cleaned = cleaned.slice(1, -1);
    }
    
    const parts = cleaned.includes(',') 
      ? cleaned.split(',') 
      : cleaned.trim().split(/\s+/);
      
    if (parts.length !== dimension) return null;
    
    const parsed = parts.map(p => parseFloat(p.trim()));
    if (parsed.some(isNaN)) return null;
    
    return parsed;
  } catch (err) {
    return null;
  }
}

// Helper to check array equality
export function vectorsEqual(v1: Vector, v2: Vector): boolean {
  if (v1.length !== v2.length) return false;
  return v1.every((val, index) => Math.abs(val - v2[index]) < 1e-5);
}

// Vector addition
export function vecAdd(v1: Vector, v2: Vector): Vector {
  return v1.map((val, idx) => val + (v2[idx] || 0));
}

// Vector subtraction
export function vecSub(v1: Vector, v2: Vector): Vector {
  return v1.map((val, idx) => val - (v2[idx] || 0));
}

// Vector scalar multiplication
export function vecMult(v: Vector, s: number): Vector {
  return v.map(val => val * s);
}

// Dynamic Coordinate Solver
export function solveRelations(
  premises: Premise[],
  basisRelations: Record<string, Vector>,
  dimension: DimensionCount
): SolverResult {
  const list: Record<string, { neighbor: string; relationName: string; vector: Vector; isForward: boolean; premiseId: string }[]> = {};
  const activeEntities = new Set<string>();

  // Extract all entities mentioned
  premises.forEach(p => {
    if (p.entityA && p.entityB) {
      activeEntities.add(p.entityA);
      activeEntities.add(p.entityB);
    }
  });

  // Build Adjacency List
  // A is R of B => A = B + vecR => B -> A (weight: vecR), A -> B (weight: -vecR)
  premises.forEach(p => {
    const { entityA, entityB, relation, id } = p;
    if (!entityA || !entityB || !relation) return;
    let vec = basisRelations[relation];
    if (!vec) {
      vec = parseVector(relation, dimension) || undefined;
    }
    if (!vec) return;

    if (!list[entityB]) list[entityB] = [];
    list[entityB].push({ neighbor: entityA, relationName: relation, vector: vec, isForward: true, premiseId: id });

    if (!list[entityA]) list[entityA] = [];
    list[entityA].push({ neighbor: entityB, relationName: relation, vector: vec, isForward: false, premiseId: id });
  });

  const entities: Record<string, EntityNode> = {};
  const visited = new Set<string>();
  let componentId = 0;

  // We want to track paths from the source to nodes to detail contradiction paths if any
  const pathsFromRoot: Record<string, { node: string; edgeDescr: string }[]> = {};

  for (const startEntity of activeEntities) {
    if (visited.has(startEntity)) continue;

    componentId++;
    const queue: string[] = [startEntity];
    visited.add(startEntity);
    
    // Assign root coordinate
    entities[startEntity] = {
      name: startEntity,
      coordinates: Array(dimension).fill(0),
      componentId
    };
    pathsFromRoot[startEntity] = [];

    while (queue.length > 0) {
      const u = queue.shift()!;
      const uCoords = entities[u].coordinates;

      const edges = list[u] || [];
      for (const edge of edges) {
        const { neighbor, relationName, vector, isForward, premiseId } = edge;
        // Expected coordinate for neighbor
        const expected = isForward 
          ? vecAdd(uCoords, vector)
          : vecSub(uCoords, vector);

        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          entities[neighbor] = {
            name: neighbor,
            coordinates: expected,
            componentId
          };
          
          pathsFromRoot[neighbor] = [
            ...pathsFromRoot[u],
            { 
              node: u, 
              edgeDescr: isForward 
                ? `${neighbor} is ${relationName} of ${u}`
                : `${u} is ${relationName} of ${neighbor}`
            }
          ];
          queue.push(neighbor);
        } else {
          // Verify consistency
          const current = entities[neighbor].coordinates;
          if (!vectorsEqual(current, expected)) {
            // Contradiction detected!
            return {
              entities,
              componentCount: componentId,
              isConsistent: false,
              contradiction: {
                entityA: u,
                entityB: neighbor,
                expectedVector: expected,
                actualVector: current,
                pathA: pathsFromRoot[u].map(e => e.edgeDescr),
                pathB: [
                  ...pathsFromRoot[neighbor].map(e => e.edgeDescr),
                  isForward 
                    ? `BUT we assert: ${neighbor} is ${relationName} of ${u} (which would require displacement ${vector.join(', ')})`
                    : `BUT we assert: ${u} is ${relationName} of ${neighbor} (which would require displacement ${vector.join(', ')})`
                ]
              }
            };
          }
        }
      }
    }
  }

  return {
    entities,
    componentCount: componentId,
    isConsistent: true
  };
}

export function getStableHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function scrambleParts(parts: string[]): string[] {
  const shuffled = [...parts];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  return shuffled;
}

// Describe a vector in terms of base directions
export function describeVector(
  vector: Vector,
  basisRelations: Record<string, Vector>,
  scramble?: boolean
): string {
  const nonZeroCount = vector.filter(val => val !== 0).length;

  if (!scramble || nonZeroCount <= 1) {
    // Try direct match
    for (const [name, vec] of Object.entries(basisRelations)) {
      if (vectorsEqual(vector, vec)) {
        return name;
      }
    }

    // Try opposite match
    const oppositeVec = vecMult(vector, -1);
    for (const [name, vec] of Object.entries(basisRelations)) {
      if (vectorsEqual(oppositeVec, vec)) {
        return `OPPOSITE of ${name}`;
      }
    }
  }

  // Multi-dimensional breakdown descriptive text
  let parts: string[] = [];
  
  vector.forEach((val, idx) => {
    if (val === 0) return;
    
    let directionStr = '';
    if (idx === 0) {
      directionStr = val > 0 ? 'NORTH' : 'SOUTH';
    } else if (idx === 1) {
      directionStr = val > 0 ? 'EAST' : 'WEST';
    } else if (idx === 2) {
      directionStr = val > 0 ? 'ABOVE' : 'BELOW';
    } else if (idx === 3) {
      directionStr = val > 0 ? 'AFTER' : 'BEFORE';
    } else {
      directionStr = `Dim ${idx + 1}`;
    }

    if (Math.abs(val) !== 1) {
      parts.push(`${directionStr}-scaled`);
    } else {
      parts.push(directionStr);
    }
  });

  if (parts.length === 0) return 'COINCIDENT (Same Position)';
  if (scramble && parts.length > 1) {
    parts = scrambleParts(parts);
    return parts.join('-');
  }

  return parts.join(', ');
}

export function generateCVC(): string {
  const consonants = 'BCDFGHJKLMNPQRSTVWXYZ';
  const vowels = 'AEIOU';
  const c1 = consonants[Math.floor(Math.random() * consonants.length)];
  const v = vowels[Math.floor(Math.random() * vowels.length)];
  const c2 = consonants[Math.floor(Math.random() * consonants.length)];
  return c1 + v + c2;
}

export function generateUniqueCVCNames(count: number): string[] {
  const names = new Set<string>();
  while (names.size < count) {
    names.add(generateCVC());
  }
  return Array.from(names);
}

// Generate relational logical training riddle
export function generateTrainerPuzzle(
  dimension: DimensionCount,
  difficulty: PuzzleDifficulty,
  customNodeCount?: number,
  customScramble?: 'none' | 'partial' | 'full',
  scrambleComponentOrder?: boolean
): Puzzle {
  const basis = getBasisRelations(dimension);
  const basisKeys = Object.keys(basis).filter(k => {
    // Limit beginner to cardinal 2D directions
    if (difficulty === 'Beginner') {
      return ['NORTH', 'SOUTH', 'EAST', 'WEST'].includes(k);
    }
    // Limit intermediate key selections to omit 4D or complex diags if 3D
    return true;
  });

  // Number of nodes based on difficulty, or overridden by customNodeCount
  let nodeCount = 3;
  if (customNodeCount !== undefined && customNodeCount > 0) {
    nodeCount = customNodeCount;
  } else {
    if (difficulty === 'Intermediate') nodeCount = 4;
    else if (difficulty === 'Advanced') nodeCount = 5;
    else if (difficulty === 'Master') nodeCount = 6;
  }

  // Pick unique CVC entity names randomly
  const selectedNames = generateUniqueCVCNames(nodeCount);
  
  // Create a coordinates grid starting at origin for node 0
  const nodesCoords: Record<string, Vector> = {};
  nodesCoords[selectedNames[0]] = Array(dimension).fill(0);

  const premises: Premise[] = [];
  const connected = [selectedNames[0]];
  const remaining = selectedNames.slice(1);

  // Growth loop: attach a random unplaced node to an already placed node using a random relation
  while (remaining.length > 0) {
    const parent = connected[Math.floor(Math.random() * connected.length)];
    const child = remaining.shift()!;
    const relation = basisKeys[Math.floor(Math.random() * basisKeys.length)];
    const relVec = basis[relation];

    // child is relation of parent => childCoords = parentCoords + relVec
    nodesCoords[child] = vecAdd(nodesCoords[parent], relVec);
    
    // Generate unique ID for each generated premise to adhere to the Premise model
    const prmId = `pzp_gen_${Math.floor(Math.random() * 1000000)}`;

    // If scrambleComponentOrder is true, we should represent the premise relation in its scrambled form!
    const activeRelation = scrambleComponentOrder
      ? describeVector(relVec, basis, true)
      : relation;

    // We frame it as either: "child is relation of parent" OR "parent is opposite of child"
    // Let's randomize presentation
    if (Math.random() > 0.4) {
      premises.push({ id: prmId, entityA: child, relation: activeRelation, entityB: parent });
    } else {
      // Find opposite relation
      const oppVec = vecMult(relVec, -1);
      let oppRelation = '';
      for (const [k, v] of Object.entries(basis)) {
        if (vectorsEqual(v, oppVec)) {
          oppRelation = scrambleComponentOrder ? describeVector(oppVec, basis, true) : k;
          break;
        }
      }
      
      if (oppRelation) {
        premises.push({ id: prmId, entityA: parent, relation: oppRelation, entityB: child });
      } else {
        premises.push({ id: prmId, entityA: child, relation: activeRelation, entityB: parent });
      }
    }
    
    connected.push(child);
  }

  // Shuffle/scramble premises to increase working memory load (not linear sequence)
  const shuffledPremises = [...premises];
  const scramble = customScramble ?? 'full';
  if (scramble === 'full') {
    shuffledPremises.sort(() => Math.random() - 0.5);
  } else if (scramble === 'partial') {
    if (Math.random() < 0.4) {
      shuffledPremises.sort(() => Math.random() - 0.5);
    } else if (shuffledPremises.length >= 2) {
      const temp = shuffledPremises[0];
      shuffledPremises[0] = shuffledPremises[1];
      shuffledPremises[1] = temp;
    }
  } else {
    // none: leave them in natural logical generation order
  }

  // Randomly choose the two distinct items in the conclusion, not just first and last elements (Alpha and Delta)
  let idxA = Math.floor(Math.random() * selectedNames.length);
  let idxB = Math.floor(Math.random() * selectedNames.length);
  while (idxA === idxB) {
    idxB = Math.floor(Math.random() * selectedNames.length);
  }
  const bestA = selectedNames[idxA];
  const bestB = selectedNames[idxB];

  // Calculate coordinates distance or path vector
  const targetVector = vecSub(nodesCoords[bestA], nodesCoords[bestB]);

  // Render a human descriptive answer for the correct relationship
  const correctAnswerName = describeVector(targetVector, basis, scrambleComponentOrder);

  // Let's generate options with unique underlying vectors and canonical names
  const options: { relation: string; vector: Vector; isCorrect: boolean }[] = [];
  const usedVectors = new Set<string>([targetVector.join(',')]);
  const canonicalCorrectName = describeVector(targetVector, basis, false);
  const usedCanonicalNames = new Set<string>([canonicalCorrectName]);

  // 1. Correct option
  options.push({
    relation: correctAnswerName,
    vector: targetVector,
    isCorrect: true
  });

  // Calculate decoy options
  let loopCount = 0;
  while (options.length < 4 && loopCount < 100) {
    loopCount++;
    // Choose a random combination of dimensional values or a random basis relation
    let decoyVec: Vector;

    if (Math.random() > 0.5) {
      const randomBasisKey = basisKeys[Math.floor(Math.random() * basisKeys.length)];
      decoyVec = basis[randomBasisKey];
    } else {
      // Perturb target vector
      decoyVec = targetVector.map((val, idx) => {
        // Perturb one dimension
        if (idx === Math.floor(Math.random() * dimension)) {
          const shift = Math.random() > 0.5 ? 1 : -1;
          return val + shift;
        }
        return val;
      });
    }

    const vecStr = decoyVec.join(',');
    const canonicalName = describeVector(decoyVec, basis, false);

    if (canonicalName && !usedVectors.has(vecStr) && !usedCanonicalNames.has(canonicalName)) {
      usedVectors.add(vecStr);
      usedCanonicalNames.add(canonicalName);
      options.push({
        relation: scrambleComponentOrder ? describeVector(decoyVec, basis, true) : canonicalName,
        vector: decoyVec,
        isCorrect: false
      });
    }
  }

  // Fallbacks if we couldn't get enough unique decoy options
  if (options.length < 4) {
    const fallbackVectors = [
      Array(dimension).fill(0).map((_, i) => (i === 0 ? 1 : 0)),
      Array(dimension).fill(0).map((_, i) => (i === 1 ? -1 : 0)),
      Array(dimension).fill(0).map((_, i) => (i === 2 && dimension > 2 ? 1 : (i === 0 ? -1 : 0))),
      Array(dimension).fill(0).map((_, i) => (i === 3 && dimension > 3 ? -1 : (i === 1 ? 1 : 0)))
    ];
    for (const fv of fallbackVectors) {
      if (options.length >= 4) break;
      const vecStr = fv.join(',');
      const canonicalName = describeVector(fv, basis, false);
      if (canonicalName && !usedVectors.has(vecStr) && !usedCanonicalNames.has(canonicalName)) {
        usedVectors.add(vecStr);
        usedCanonicalNames.add(canonicalName);
        options.push({
          relation: scrambleComponentOrder ? describeVector(fv, basis, true) : canonicalName,
          vector: fv,
          isCorrect: false
        });
      }
    }
  }

  // Shuffle options
  const shuffledOptions = [...options].sort(() => Math.random() - 0.5);

  // Prepare clear step-by-step logic explanation
  const solver = solveRelations(premises, basis, dimension);
  const explainedSteps: string[] = [];
  
  explainedSteps.push(`Let's place **${selectedNames[0]}** at the origin: $${selectedNames[0]} = (${Array(dimension).fill(0).join(', ')})$`);
  
  // Group premises conceptually to show deduction
  premises.forEach(p => {
    const coordsA = nodesCoords[p.entityA];
    const coordsB = nodesCoords[p.entityB];
    const pVec = basis[p.relation] || parseStandardRelation(p.relation, dimension) || Array(dimension).fill(0);
    explainedSteps.push(
      `• Since **${p.entityA}** is **${p.relation}** of **${p.entityB}**, we have:  \n  $${p.entityA} = ${p.entityB} + [${pVec.join(', ')}] = (${coordsA.join(', ')})$`
    );
  });

  explainedSteps.push(`Now, let's find **${bestA}** with respect to **${bestB}**:  \n  ` +
    `$Vector = \\vec{v}_{${bestA}} - \\vec{v}_{${bestB}} = (${nodesCoords[bestA].join(', ')}) - (${nodesCoords[bestB].join(', ')}) = [${targetVector.join(', ')}]$`
  );
  explainedSteps.push(`This spatial displacement corresponds to **${correctAnswerName}**.`);

  return {
    id: `puzzle_${Math.floor(Math.random() * 1000000)}`,
    premises: shuffledPremises,
    question: {
      entityA: bestA,
      entityB: bestB
    },
    options: shuffledOptions,
    explanation: explainedSteps.join('\n\n'),
    dimension,
    difficulty
  };
}

// === ABSTRACT RELATIONS ENGINE HELPERS ===

export function generateAbstractMapping(): AbstractRelationMapping {
  const words = generateUniqueCVCNames(8);
  return {
    '0_pos': words[0],
    '0_neg': words[1],
    '1_pos': words[2],
    '1_neg': words[3],
    '2_pos': words[4],
    '2_neg': words[5],
    '3_pos': words[6],
    '3_neg': words[7]
  };
}

export function describeAbstractVector(
  vector: Vector,
  mapping: AbstractRelationMapping,
  dimension: number,
  scramble?: boolean
): string {
  let parts: string[] = [];
  
  for (let idx = 0; idx < dimension; idx++) {
    const val = vector[idx] || 0;
    if (val === 0) continue;
    
    let baseWord = '';
    if (val > 0) {
      baseWord = mapping[`${idx}_pos` as keyof AbstractRelationMapping];
    } else {
      baseWord = mapping[`${idx}_neg` as keyof AbstractRelationMapping];
    }
    
    if (Math.abs(val) !== 1) {
      parts.push(`${baseWord}-Scaled`);
    } else {
      parts.push(baseWord);
    }
  }

  if (parts.length === 0) return 'COINCIDENT';
  if (parts.length === 1) return parts[0];

  if (scramble) {
    parts = scrambleParts(parts);
  }

  return `[${parts.join('-')}]`;
}

export function parseAbstractRelation(name: string, mapping: AbstractRelationMapping, dimension: DimensionCount): Vector | null {
  try {
    let cleaned = name.trim();
    if (!cleaned) return null;
    
    if (cleaned.startsWith('[') && cleaned.endsWith(']') && cleaned.includes(',')) {
      return null;
    }
    
    if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
      cleaned = cleaned.slice(1, -1);
    }
    
    const parts = cleaned.split('-');
    const vector = Array(dimension).fill(0);
    let matchedAny = false;
    
    for (const part of parts) {
      let isScaled = false;
      let baseWord = part;
      if (part.endsWith('_Scaled') || part.endsWith('-Scaled')) {
        isScaled = true;
        baseWord = part.slice(0, -7);
      } else if (part.includes('Scaled')) {
        isScaled = true;
        baseWord = part.replace('Scaled', '').replace('-', '').replace('_', '');
      }
      
      let foundKey: string | null = null;
      for (const [key, word] of Object.entries(mapping)) {
        if ((word as string).toUpperCase() === baseWord.toUpperCase()) {
          foundKey = key;
          break;
        }
      }
      
      if (foundKey) {
        matchedAny = true;
        const [axisStr, dir] = foundKey.split('_');
        const axisIdx = parseInt(axisStr);
        if (axisIdx < dimension) {
          const sign = dir === 'pos' ? 1 : -1;
          const val = isScaled ? sign * 2 : sign;
          vector[axisIdx] = val;
        }
      }
    }
    
    return matchedAny ? vector : null;
  } catch (err) {
    return null;
  }
}

export function parseStandardRelation(name: string, dimension: DimensionCount): Vector | null {
  try {
    let cleaned = name.trim();
    if (!cleaned) return null;
    
    const basis = getBasisRelations(dimension);
    if (basis[cleaned]) {
      return basis[cleaned];
    }
    const foundKey = Object.keys(basis).find(k => k.toLowerCase() === cleaned.toLowerCase());
    if (foundKey) {
      return basis[foundKey];
    }
    
    const separators = /[-\s,]+/;
    const parts = cleaned.split(separators);
    const vector = Array(dimension).fill(0);
    let matchedAny = false;
    
    for (const part of parts) {
      if (!part) continue;
      
      const upperPart = part.toUpperCase();
      let isScaled = upperPart.endsWith('SCALED') || upperPart.endsWith('SCALED)');
      let baseWord = upperPart;
      if (isScaled) {
        baseWord = upperPart.replace('SCALED', '').replace('-', '').replace('_', '').trim();
      }
      
      if (baseWord === 'NORTH') {
        vector[0] = isScaled ? 2 : 1;
        matchedAny = true;
      } else if (baseWord === 'SOUTH') {
        vector[0] = isScaled ? -2 : -1;
        matchedAny = true;
      } else if (baseWord === 'EAST') {
        if (dimension > 1) {
          vector[1] = isScaled ? 2 : 1;
          matchedAny = true;
        }
      } else if (baseWord === 'WEST') {
        if (dimension > 1) {
          vector[1] = isScaled ? -2 : -1;
          matchedAny = true;
        }
      } else if (baseWord === 'NORTHEAST') {
        vector[0] = 1;
        if (dimension > 1) vector[1] = 1;
        matchedAny = true;
      } else if (baseWord === 'NORTHWEST') {
        vector[0] = 1;
        if (dimension > 1) vector[1] = -1;
        matchedAny = true;
      } else if (baseWord === 'SOUTHEAST') {
        vector[0] = -1;
        if (dimension > 1) vector[1] = 1;
        matchedAny = true;
      } else if (baseWord === 'SOUTHWEST') {
        vector[0] = -1;
        if (dimension > 1) vector[1] = -1;
        matchedAny = true;
      } else if (baseWord === 'ABOVE') {
        if (dimension > 2) {
          vector[2] = isScaled ? 2 : 1;
          matchedAny = true;
        }
      } else if (baseWord === 'BELOW') {
        if (dimension > 2) {
          vector[2] = isScaled ? -2 : -1;
          matchedAny = true;
        }
      } else if (baseWord === 'AFTER') {
        if (dimension > 3) {
          vector[3] = isScaled ? 2 : 1;
          matchedAny = true;
        }
      } else if (baseWord === 'BEFORE') {
        if (dimension > 3) {
          vector[3] = isScaled ? -2 : -1;
          matchedAny = true;
        }
      }
    }
    
    return matchedAny ? vector : null;
  } catch (err) {
    return null;
  }
}

export function translateStandardRelationToAbstract(
  standardName: string,
  mapping: AbstractRelationMapping,
  dimension: DimensionCount,
  scramble?: boolean
): string {
  let vec = parseStandardRelation(standardName, dimension);
  if (vec) {
    return describeAbstractVector(vec, mapping, dimension, scramble);
  }
  return standardName;
}

export function translateTextToAbstract(
  text: string,
  mapping: AbstractRelationMapping,
  dimension: DimensionCount,
  scramble?: boolean
): string {
  if (!text) return text;
  let translated = text;
  
  const standardBasis = getBasisRelations(dimension);
  const sortedKeys = Object.keys(standardBasis).sort((a, b) => b.length - a.length);
  
  for (const key of sortedKeys) {
    const vec = standardBasis[key];
    const abstractName = describeAbstractVector(vec, mapping, dimension, scramble);
    const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedKey}\\b`, 'gi');
    translated = translated.replace(regex, abstractName);
  }
  
  return translated;
}

export function scrambleStandardRelation(
  standardName: string,
  dimension: DimensionCount,
  scramble?: boolean
): string {
  if (!scramble) return standardName;
  let vec = parseStandardRelation(standardName, dimension);
  if (vec) {
    return describeVector(vec, getBasisRelations(dimension), scramble);
  }
  return standardName;
}

export function scrambleTextStandard(
  text: string,
  dimension: DimensionCount,
  scramble?: boolean
): string {
  if (!text || !scramble) return text;
  let scrambled = text;
  
  const standardBasis = getBasisRelations(dimension);
  const sortedKeys = Object.keys(standardBasis).sort((a, b) => b.length - a.length);
  
  for (const key of sortedKeys) {
    const vec = standardBasis[key];
    const scrambledName = describeVector(vec, standardBasis, scramble);
    const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedKey}\\b`, 'gi');
    scrambled = scrambled.replace(regex, scrambledName);
  }
  
  return scrambled;
}



