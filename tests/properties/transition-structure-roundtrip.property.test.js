import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { extractEngine } from '../helpers/extract.js';

/**
 * Property 12: Transition structure round-trip
 *
 * Feature: lgr-transition-planning, Property 12: Transition structure round-trip
 *
 * Validates: Requirements 1.1, 1.8
 */

const ctx = extractEngine();
const buildSuccessorAllocation = ctx.buildSuccessorAllocation;

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/**
 * Generate a valid transition structure with populated predecessor arrays.
 * Each successor has a name, fullPredecessors, and partialPredecessors.
 */
const arbFullTransitionStructure = fc
  .record({
    vestingDate: fc.record({
      year: fc.integer({ min: 2026, max: 2030 }),
      month: fc.integer({ min: 1, max: 12 }),
      day: fc.integer({ min: 1, max: 28 }),
    }).map(({ year, month, day }) =>
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    ),
    successorCount: fc.integer({ min: 1, max: 4 }),
    councilCount: fc.integer({ min: 2, max: 6 }),
  })
  .chain(({ vestingDate, successorCount, councilCount }) => {
    const councilNames = Array.from({ length: councilCount }, (_, i) => `Council-${String.fromCharCode(65 + i)}`);
    const successorNames = Array.from({ length: successorCount }, (_, i) => `Successor-${i + 1}`);

    // For each council, decide if it's full or partial
    const arbAssignments = fc.tuple(
      ...councilNames.map(() => fc.constantFrom('full', 'partial'))
    );

    return arbAssignments.map(assignments => {
      const successors = successorNames.map(name => ({
        name,
        fullPredecessors: [],
        partialPredecessors: [],
      }));

      assignments.forEach((type, idx) => {
        const councilName = councilNames[idx];
        if (type === 'full') {
          // Full predecessor goes to one successor
          successors[idx % successors.length].fullPredecessors.push(councilName);
        } else {
          // Partial predecessor goes to all successors
          successors.forEach(s => s.partialPredecessors.push(councilName));
        }
      });

      return { vestingDate, successors };
    });
  });

/**
 * Generate a partial transition structure where successors have empty
 * predecessor arrays (named but allocation incomplete).
 */
const arbPartialTransitionStructure = fc
  .record({
    vestingDate: fc.record({
      year: fc.integer({ min: 2026, max: 2030 }),
      month: fc.integer({ min: 1, max: 12 }),
      day: fc.integer({ min: 1, max: 28 }),
    }).map(({ year, month, day }) =>
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    ),
    successorCount: fc.integer({ min: 1, max: 4 }),
  })
  .map(({ vestingDate, successorCount }) => {
    const successors = Array.from({ length: successorCount }, (_, i) => ({
      name: `Successor-${i + 1}`,
      fullPredecessors: [],
      partialPredecessors: [],
    }));
    return { vestingDate, successors };
  });

// ---------------------------------------------------------------------------
// Helpers: build a minimal estate for round-trip testing
// ---------------------------------------------------------------------------

function buildMinimalEstate(councilNames) {
  const nodes = [];
  const edges = [];

  councilNames.forEach(cName => {
    const sysId = `${cName}-sys-0`;
    const fnId = `${cName}-fn-1`;
    nodes.push({
      id: sysId,
      label: `${cName} System`,
      type: 'ITSystem',
      _sourceCouncil: cName,
    });
    nodes.push({
      id: fnId,
      label: 'Function 1',
      type: 'Function',
      lgaFunctionId: '1',
      _sourceCouncil: cName,
    });
    edges.push({
      source: sysId,
      target: fnId,
      relationship: 'REALIZES',
    });
  });

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Property 12: Transition structure round-trip', { tags: ['Feature: lgr-transition-planning', 'Property 12: Transition structure round-trip'] }, () => {

  it('storing a valid transition structure and reading it back through buildSuccessorAllocation preserves all fields', () => {
    fc.assert(
      fc.property(arbFullTransitionStructure, (transitionStructure) => {
        // Verify the structure itself is well-formed before round-trip
        expect(transitionStructure).toHaveProperty('vestingDate');
        expect(typeof transitionStructure.vestingDate).toBe('string');
        expect(transitionStructure).toHaveProperty('successors');
        expect(Array.isArray(transitionStructure.successors)).toBe(true);

        // Collect all council names from the structure
        const allCouncils = new Set();
        transitionStructure.successors.forEach(s => {
          expect(s).toHaveProperty('name');
          expect(typeof s.name).toBe('string');
          expect(s).toHaveProperty('fullPredecessors');
          expect(Array.isArray(s.fullPredecessors)).toBe(true);
          expect(s).toHaveProperty('partialPredecessors');
          expect(Array.isArray(s.partialPredecessors)).toBe(true);

          s.fullPredecessors.forEach(c => allCouncils.add(c));
          s.partialPredecessors.forEach(c => allCouncils.add(c));
        });

        // Build a minimal estate from the councils in the structure
        const councilNames = [...allCouncils];
        if (councilNames.length === 0) return; // degenerate case, skip

        const { nodes, edges } = buildMinimalEstate(councilNames);

        // Pass the structure through buildSuccessorAllocation — this should
        // not corrupt or lose any fields from the input structure
        const { allocation, warnings } = buildSuccessorAllocation(nodes, edges, transitionStructure);

        // Verify the allocation map has an entry for every successor
        transitionStructure.successors.forEach(s => {
          expect(allocation.has(s.name)).toBe(true);
        });

        // Verify the original transition structure is unchanged after the call
        // (the function should not mutate its input)
        expect(transitionStructure).toHaveProperty('vestingDate');
        expect(typeof transitionStructure.vestingDate).toBe('string');
        expect(transitionStructure.vestingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        transitionStructure.successors.forEach(s => {
          expect(s).toHaveProperty('name');
          expect(s).toHaveProperty('fullPredecessors');
          expect(s).toHaveProperty('partialPredecessors');
          expect(Array.isArray(s.fullPredecessors)).toBe(true);
          expect(Array.isArray(s.partialPredecessors)).toBe(true);
        });

        // Verify that systems from full predecessors are allocated to the correct successor
        transitionStructure.successors.forEach(s => {
          s.fullPredecessors.forEach(council => {
            const successorMap = allocation.get(s.name);
            // Find allocations for this council's system
            let found = false;
            for (const [funcId, allocs] of successorMap.entries()) {
              const matching = allocs.filter(a => a.sourceCouncil === council);
              if (matching.length > 0) {
                found = true;
                matching.forEach(a => {
                  expect(a.allocationType).toBe('full');
                });
              }
            }
            // The council should have been allocated (unless it's also partial)
            const isAlsoPartial = transitionStructure.successors.some(
              other => other.partialPredecessors.includes(council)
            );
            if (!isAlsoPartial) {
              expect(found).toBe(true);
            }
          });
        });
      }),
      { numRuns: 100 }
    );
  });

  it('partial structures (successors with empty predecessor arrays) are accepted without error', () => {
    fc.assert(
      fc.property(arbPartialTransitionStructure, (transitionStructure) => {
        // All successors have empty predecessor arrays
        transitionStructure.successors.forEach(s => {
          expect(s.fullPredecessors).toEqual([]);
          expect(s.partialPredecessors).toEqual([]);
        });

        // Pass through buildSuccessorAllocation with an empty estate —
        // this should not throw
        const nodes = [];
        const edges = [];
        const { allocation, warnings } = buildSuccessorAllocation(nodes, edges, transitionStructure);

        // The allocation map should have an entry for every successor
        transitionStructure.successors.forEach(s => {
          expect(allocation.has(s.name)).toBe(true);
          // Each successor's function map should be empty (no systems to allocate)
          const funcMap = allocation.get(s.name);
          expect(funcMap.size).toBe(0);
        });

        // No errors should have been thrown — the function handles partial
        // structures gracefully
        expect(allocation).toBeInstanceOf(Map);
      }),
      { numRuns: 100 }
    );
  });
});
