import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { extractEngine } from '../helpers/extract.js';

/**
 * Property 8: Shared service boundary detection
 *
 * Feature: lgr-transition-planning, Property 8: Shared service boundary detection
 *
 * Validates: Requirements 6.3, 6.4
 */

const ctx = extractEngine();
const detectSharedServiceBoundary = ctx.detectSharedServiceBoundary;

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Generate a council name like "Council-A", "Council-B", etc. */
const arbCouncilName = fc.stringMatching(/^Council-[A-Z]{1,3}$/);

/** Generate a successor name like "Successor-Alpha", "Successor-Beta", etc. */
const arbSuccessorName = fc.stringMatching(/^Successor-[A-Z]{1,3}$/);

/**
 * Generate a system node with a _sourceCouncil and an optional sharedWith array.
 * The councils are drawn from a provided pool.
 */
function arbSystemNode(councilPool) {
  return fc.record({
    id: fc.uuid().map(u => `sys-${u}`),
    label: fc.constant('Shared System'),
    type: fc.constant('ITSystem'),
    _sourceCouncil: fc.constantFrom(...councilPool),
    sharedWith: fc.subarray(councilPool, { minLength: 0, maxLength: councilPool.length }),
  });
}

/**
 * Scenario: all councils map to the SAME successor.
 *
 * Generates:
 * - 2–5 council names
 * - 1 successor name
 * - A councilToSuccessorMap where every council maps to [sameSuccessor]
 * - A system node whose _sourceCouncil and sharedWith are drawn from those councils
 */
const arbSameSuccessorScenario = fc
  .tuple(
    fc.uniqueArray(arbCouncilName, { minLength: 2, maxLength: 5, comparator: (a, b) => a === b }),
    arbSuccessorName,
  )
  .chain(([councils, successor]) => {
    // Build a map where every council maps to the same single successor
    const councilToSuccessorMap = new Map();
    councils.forEach(c => councilToSuccessorMap.set(c, [successor]));

    return fc.record({
      systemNode: fc.record({
        id: fc.uuid().map(u => `sys-${u}`),
        label: fc.constant('Shared System'),
        type: fc.constant('ITSystem'),
        _sourceCouncil: fc.constantFrom(...councils),
        // sharedWith must include at least 1 other council to be a shared service
        sharedWith: fc.subarray(councils, { minLength: 1, maxLength: councils.length }),
      }),
      councilToSuccessorMap: fc.constant(councilToSuccessorMap),
    });
  });

/**
 * Scenario: councils map to DIFFERENT successors (at least 2 distinct).
 *
 * Generates:
 * - 2–5 council names
 * - 2–4 successor names (guaranteed distinct)
 * - A councilToSuccessorMap where at least 2 councils map to different successors
 * - A system node whose _sourceCouncil and sharedWith span councils in different successors
 */
const arbDifferentSuccessorScenario = fc
  .tuple(
    fc.uniqueArray(arbCouncilName, { minLength: 2, maxLength: 5, comparator: (a, b) => a === b }),
    fc.uniqueArray(arbSuccessorName, { minLength: 2, maxLength: 4, comparator: (a, b) => a === b }),
  )
  .chain(([councils, successors]) => {
    // Assign councils to successors ensuring at least 2 different successors are used.
    // First council → first successor, second council → second successor,
    // remaining councils → random successor.
    return fc.array(
      fc.constantFrom(...successors),
      { minLength: Math.max(0, councils.length - 2), maxLength: Math.max(0, councils.length - 2) }
    ).map(remainingAssignments => {
      const councilToSuccessorMap = new Map();
      councilToSuccessorMap.set(councils[0], [successors[0]]);
      councilToSuccessorMap.set(councils[1], [successors[1]]);
      for (let i = 2; i < councils.length; i++) {
        councilToSuccessorMap.set(councils[i], [remainingAssignments[i - 2]]);
      }
      return { councils, councilToSuccessorMap };
    }).chain(({ councils, councilToSuccessorMap }) => {
      // Build a system node that spans councils in different successors.
      // _sourceCouncil is the first council (successor[0]),
      // sharedWith must include the second council (successor[1]) to guarantee boundary crossing.
      const otherCouncils = councils.slice(1);
      return fc.record({
        systemNode: fc.record({
          id: fc.uuid().map(u => `sys-${u}`),
          label: fc.constant('Shared System'),
          type: fc.constant('ITSystem'),
          _sourceCouncil: fc.constant(councils[0]),
          // Always include councils[1] (different successor) plus optionally others
          sharedWith: fc.subarray(otherCouncils, { minLength: 1, maxLength: otherCouncils.length })
            .map(arr => arr.includes(councils[1]) ? arr : [councils[1], ...arr]),
        }),
        councilToSuccessorMap: fc.constant(councilToSuccessorMap),
      });
    });
  });

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Property 8: Shared service boundary detection', {
  tags: [
    'Feature: lgr-transition-planning',
    'Property 8: Shared service boundary detection',
  ],
}, () => {

  it('all councils in same successor → no unwinding flag', () => {
    fc.assert(
      fc.property(arbSameSuccessorScenario, ({ systemNode, councilToSuccessorMap }) => {
        const result = detectSharedServiceBoundary(systemNode, councilToSuccessorMap);

        expect(result.unwinding).toBe(false);
        // Should not have a successors array when unwinding is false
        expect(result.successors).toBeUndefined();
      }),
      { numRuns: 200 }
    );
  });

  it('councils in different successors → unwinding required', () => {
    fc.assert(
      fc.property(arbDifferentSuccessorScenario, ({ systemNode, councilToSuccessorMap }) => {
        const result = detectSharedServiceBoundary(systemNode, councilToSuccessorMap);

        expect(result.unwinding).toBe(true);
        // Should have a successors array with 2+ distinct entries
        expect(Array.isArray(result.successors)).toBe(true);
        expect(result.successors.length).toBeGreaterThanOrEqual(2);

        // Every successor in the result should be a real successor from the map
        const allSuccessorsInMap = new Set();
        for (const succs of councilToSuccessorMap.values()) {
          succs.forEach(s => allSuccessorsInMap.add(s));
        }
        for (const s of result.successors) {
          expect(allSuccessorsInMap.has(s)).toBe(true);
        }

        // The successors should be unique
        const uniqueSuccessors = new Set(result.successors);
        expect(uniqueSuccessors.size).toBe(result.successors.length);
      }),
      { numRuns: 200 }
    );
  });
});
