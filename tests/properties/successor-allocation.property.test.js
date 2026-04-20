import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { extractEngine } from '../helpers/extract.js';

/**
 * Property 1: Successor allocation correctness
 *
 * Feature: lgr-transition-planning, Property 1: Successor allocation correctness
 *
 * Validates: Requirements 1.4, 1.5, 1.6, 1.7, 7.1, 7.4
 */

const ctx = extractEngine();
const buildSuccessorAllocation = ctx.buildSuccessorAllocation;

// ---------------------------------------------------------------------------
// Helpers: build minimal but valid estates for property testing
// ---------------------------------------------------------------------------

/**
 * Build a minimal estate (nodes + edges) from a list of council descriptors.
 * Each council gets one Function node and one ITSystem node connected by a
 * REALIZES edge. The function's lgaFunctionId is shared across councils so
 * that collisions are possible.
 */
function buildEstate(councils) {
  const nodes = [];
  const edges = [];

  councils.forEach(c => {
    c.systems.forEach((sys, sIdx) => {
      nodes.push(sys);
      // Each system needs at least one function to REALIZE
      sys._functions.forEach(fnId => {
        const fnNodeId = `${c.name}-fn-${fnId}`;
        // Only add the function node once per council+fnId combo
        if (!nodes.find(n => n.id === fnNodeId)) {
          nodes.push({
            id: fnNodeId,
            label: `Function ${fnId}`,
            type: 'Function',
            lgaFunctionId: fnId,
            _sourceCouncil: c.name,
          });
        }
        edges.push({
          source: sys.id,
          target: fnNodeId,
          relationship: 'REALIZES',
        });
      });
    });
  });

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/**
 * Generate a self-consistent estate + transition structure for property testing.
 *
 * Strategy:
 * - Generate 2–4 council names
 * - Generate 2–3 successor names
 * - Assign each council as either full or partial predecessor
 * - Generate 1–3 systems per council, each realizing 1–2 functions
 * - Optionally give some systems targetAuthorities
 */
const arbScenario = fc
  .record({
    councilCount: fc.integer({ min: 2, max: 4 }),
    successorCount: fc.integer({ min: 2, max: 3 }),
    vestingDate: fc.constantFrom('2027-04-01', '2028-04-01', '2029-04-01'),
  })
  .chain(({ councilCount, successorCount, vestingDate }) => {
    const councilNames = Array.from({ length: councilCount }, (_, i) => `Council-${String.fromCharCode(65 + i)}`);
    const successorNames = Array.from({ length: successorCount }, (_, i) => `Successor-${i + 1}`);

    // Decide full vs partial for each council
    const arbAssignments = fc.tuple(
      ...councilNames.map(name =>
        fc.constantFrom('full', 'partial').map(type => ({ name, type }))
      )
    );

    return arbAssignments.chain(assignments => {
      // Build transition structure
      const successors = successorNames.map(sName => ({
        name: sName,
        fullPredecessors: [],
        partialPredecessors: [],
      }));

      assignments.forEach((a, idx) => {
        if (a.type === 'full') {
          // Full predecessor goes to exactly one successor
          successors[idx % successors.length].fullPredecessors.push(a.name);
        } else {
          // Partial predecessor goes to ALL successors
          successors.forEach(s => s.partialPredecessors.push(a.name));
        }
      });

      const transitionStructure = { vestingDate, successors };

      // Generate systems for each council
      const arbCouncils = fc.tuple(
        ...councilNames.map(cName => {
          const systemCount = fc.integer({ min: 1, max: 3 });
          return systemCount.chain(count => {
            return fc.tuple(
              ...Array.from({ length: count }, (_, sIdx) =>
                fc.record({
                  functionIds: fc.uniqueArray(
                    fc.constantFrom('1', '2', '3', '4', '5'),
                    { minLength: 1, maxLength: 2, comparator: (a, b) => a === b }
                  ),
                  hasTargetAuthorities: fc.boolean(),
                  targetAuthorityCount: fc.integer({ min: 1, max: Math.min(successorNames.length, 3) }),
                }).map(({ functionIds, hasTargetAuthorities, targetAuthorityCount }) => {
                  const sys = {
                    id: `${cName}-sys-${sIdx}`,
                    label: `${cName} System ${sIdx}`,
                    type: 'ITSystem',
                    _sourceCouncil: cName,
                    _functions: functionIds, // helper field, not part of real schema
                  };
                  if (hasTargetAuthorities) {
                    // Pick a subset of successor names
                    sys.targetAuthorities = successorNames.slice(0, targetAuthorityCount);
                  }
                  return sys;
                })
              )
            ).map(systems => ({
              name: cName,
              systems,
            }));
          });
        })
      );

      return arbCouncils.map(councils => ({
        councils,
        transitionStructure,
        successorNames,
      }));
    });
  });

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Property 1: Successor allocation correctness', { tags: ['Feature: lgr-transition-planning', 'Property 1: Successor allocation correctness'] }, () => {

  it('full predecessor systems (no targetAuthorities) appear in exactly one successor with allocationType "full" and needsAllocationReview false', () => {
    fc.assert(
      fc.property(arbScenario, ({ councils, transitionStructure, successorNames }) => {
        const { nodes, edges } = buildEstate(councils);
        const { allocation } = buildSuccessorAllocation(nodes, edges, transitionStructure);

        // For each system from a full predecessor without targetAuthorities
        councils.forEach(c => {
          c.systems.forEach(sys => {
            if (sys.targetAuthorities) return; // skip targeted systems

            // Find which successor has this council as a full predecessor
            const fullSuccessors = transitionStructure.successors.filter(s =>
              (s.fullPredecessors || []).includes(c.name)
            );

            if (fullSuccessors.length === 0) return; // not a full predecessor

            // Also check it's not a partial predecessor (could be both — skip those)
            const isAlsoPartial = transitionStructure.successors.some(s =>
              (s.partialPredecessors || []).includes(c.name)
            );
            if (isAlsoPartial) return;

            // Count how many successors contain this system
            let appearances = 0;
            for (const [successorName, funcMap] of allocation.entries()) {
              for (const [funcId, allocs] of funcMap.entries()) {
                const matching = allocs.filter(a => a.system.id === sys.id);
                matching.forEach(a => {
                  expect(a.allocationType).toBe('full');
                  expect(a.needsAllocationReview).toBe(false);
                });
                appearances += matching.length > 0 ? 1 : 0;
              }
            }

            // System should appear in exactly one successor (per function it realizes)
            // Count unique successors
            const successorsContaining = new Set();
            for (const [successorName, funcMap] of allocation.entries()) {
              for (const [funcId, allocs] of funcMap.entries()) {
                if (allocs.some(a => a.system.id === sys.id)) {
                  successorsContaining.add(successorName);
                }
              }
            }

            expect(successorsContaining.size).toBe(1);
            // And that successor should be the one that has this council as full predecessor
            const expectedSuccessor = fullSuccessors[0].name;
            expect(successorsContaining.has(expectedSuccessor)).toBe(true);
          });
        });
      }),
      { numRuns: 100 }
    );
  });

  it('partial predecessor systems (no targetAuthorities) appear in every successor listing that council as partial, with needsAllocationReview true and isDisaggregation true when 2+ successors', () => {
    fc.assert(
      fc.property(arbScenario, ({ councils, transitionStructure, successorNames }) => {
        const { nodes, edges } = buildEstate(councils);
        const { allocation } = buildSuccessorAllocation(nodes, edges, transitionStructure);

        councils.forEach(c => {
          c.systems.forEach(sys => {
            if (sys.targetAuthorities) return; // skip targeted systems

            // Find successors that list this council as partial predecessor
            const partialSuccessors = transitionStructure.successors.filter(s =>
              (s.partialPredecessors || []).includes(c.name)
            );

            if (partialSuccessors.length === 0) return; // not a partial predecessor

            // Also check it's not a full predecessor (could be both — the implementation
            // processes full and partial independently, so both allocations would exist)
            const isAlsoFull = transitionStructure.successors.some(s =>
              (s.fullPredecessors || []).includes(c.name)
            );
            if (isAlsoFull) return;

            // The system should appear in every successor that lists the council as partial
            const expectedSuccessorNames = new Set(partialSuccessors.map(s => s.name));

            // Collect actual successors containing this system
            const actualSuccessors = new Map(); // successorName → allocations[]
            for (const [successorName, funcMap] of allocation.entries()) {
              for (const [funcId, allocs] of funcMap.entries()) {
                const matching = allocs.filter(a => a.system.id === sys.id);
                if (matching.length > 0) {
                  if (!actualSuccessors.has(successorName)) actualSuccessors.set(successorName, []);
                  actualSuccessors.get(successorName).push(...matching);
                }
              }
            }

            // Every expected successor should contain this system
            for (const expectedName of expectedSuccessorNames) {
              expect(actualSuccessors.has(expectedName)).toBe(true);
            }

            // Check allocation properties
            for (const [successorName, allocs] of actualSuccessors.entries()) {
              allocs.forEach(a => {
                if (expectedSuccessorNames.has(successorName)) {
                  expect(a.allocationType).toBe('partial');
                  expect(a.needsAllocationReview).toBe(true);

                  // isDisaggregation should be true when system appears in 2+ successors
                  if (expectedSuccessorNames.size >= 2) {
                    expect(a.isDisaggregation).toBe(true);
                  }
                }
              });
            }
          });
        });
      }),
      { numRuns: 100 }
    );
  });

  it('targetAuthorities overrides predecessor allocation; isDisaggregation true when listing 2+ successors', () => {
    fc.assert(
      fc.property(arbScenario, ({ councils, transitionStructure, successorNames }) => {
        const { nodes, edges } = buildEstate(councils);
        const { allocation } = buildSuccessorAllocation(nodes, edges, transitionStructure);

        councils.forEach(c => {
          c.systems.forEach(sys => {
            if (!sys.targetAuthorities || sys.targetAuthorities.length === 0) return;

            // Filter to only valid successor names
            const validTargets = sys.targetAuthorities.filter(t =>
              transitionStructure.successors.some(s => s.name === t)
            );

            if (validTargets.length === 0) return;

            const expectedTargets = new Set(validTargets);

            // Collect actual successors containing this system
            const actualSuccessors = new Map();
            for (const [successorName, funcMap] of allocation.entries()) {
              for (const [funcId, allocs] of funcMap.entries()) {
                const matching = allocs.filter(a => a.system.id === sys.id);
                if (matching.length > 0) {
                  if (!actualSuccessors.has(successorName)) actualSuccessors.set(successorName, []);
                  actualSuccessors.get(successorName).push(...matching);
                }
              }
            }

            // System should appear in exactly the targeted successors
            const actualSuccessorNames = new Set(actualSuccessors.keys());
            expect(actualSuccessorNames).toEqual(expectedTargets);

            // Check allocation properties
            for (const [successorName, allocs] of actualSuccessors.entries()) {
              allocs.forEach(a => {
                expect(a.allocationType).toBe('targeted');

                // isDisaggregation should be true when 2+ targets
                if (expectedTargets.size >= 2) {
                  expect(a.isDisaggregation).toBe(true);
                } else {
                  expect(a.isDisaggregation).toBe(false);
                }
              });
            }
          });
        });
      }),
      { numRuns: 100 }
    );
  });
});
