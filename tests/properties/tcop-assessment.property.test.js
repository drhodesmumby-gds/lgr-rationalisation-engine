import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { extractEngine } from '../helpers/extract.js';

/**
 * Property 7: TCoP assessment correctness
 *
 * Feature: lgr-transition-planning, Property 7: TCoP assessment correctness
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

const ctx = extractEngine();
const computeTcopAssessment = ctx.computeTcopAssessment;

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/**
 * Generate an ITSystem node with random combinations of the four TCoP-relevant
 * fields: isCloud, portability, isERP, dataPartitioning.
 * Each field may be present with a valid value or absent (undefined).
 */
const arbTcopSystem = fc.record({
  id: fc.uuid().map(u => `sys-${u}`),
  label: fc.constant('Test System'),
  type: fc.constant('ITSystem'),
  isCloud: fc.constantFrom(true, false, undefined),
  portability: fc.constantFrom('High', 'Medium', 'Low', undefined),
  isERP: fc.constantFrom(true, false, undefined),
  dataPartitioning: fc.constantFrom('Segmented', 'Monolithic', undefined),
}).map(rec => {
  // Strip undefined values so they behave like absent fields
  const cleaned = {};
  for (const [k, v] of Object.entries(rec)) {
    if (v !== undefined) cleaned[k] = v;
  }
  return cleaned;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check whether a specific point appears in an array of { point, description } */
function hasPoint(arr, point) {
  return arr.some(item => item.point === point);
}

/** Count occurrences of a specific point in an array */
function countPoint(arr, point) {
  return arr.filter(item => item.point === point).length;
}

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Property 7: TCoP assessment correctness', {
  tags: [
    'Feature: lgr-transition-planning',
    'Property 7: TCoP assessment correctness',
  ],
}, () => {

  it('each field combination produces exactly the expected alignments and concerns', () => {
    fc.assert(
      fc.property(arbTcopSystem, (system) => {
        const result = computeTcopAssessment(system);

        // --- isCloud rules ---
        if (system.isCloud === true) {
          expect(hasPoint(result.alignments, 5)).toBe(true);
          expect(hasPoint(result.concerns, 5)).toBe(false);
        } else if (system.isCloud === false) {
          expect(hasPoint(result.concerns, 5)).toBe(true);
          expect(hasPoint(result.alignments, 5)).toBe(false);
        } else {
          // isCloud undefined → no Point 5 in either
          expect(hasPoint(result.alignments, 5)).toBe(false);
          expect(hasPoint(result.concerns, 5)).toBe(false);
        }

        // --- portability rules ---
        if (system.portability === 'High') {
          expect(hasPoint(result.alignments, 4)).toBe(true);
        } else {
          // No alignment for Point 4 unless portability is High
          expect(hasPoint(result.alignments, 4)).toBe(false);
        }

        if (system.portability === 'Low') {
          expect(hasPoint(result.concerns, 3)).toBe(true);
          expect(hasPoint(result.concerns, 4)).toBe(true);
          expect(hasPoint(result.concerns, 11)).toBe(true);
        } else {
          // No concerns for Points 3, 11 unless portability is Low
          expect(hasPoint(result.concerns, 3)).toBe(false);
          expect(hasPoint(result.concerns, 11)).toBe(false);
          // Point 4 concern only from Low portability (not from isCloud)
          if (system.isCloud !== false || system.portability !== 'Low') {
            // Point 4 concern only comes from portability === 'Low'
            expect(countPoint(result.concerns, 4)).toBe(0);
          }
        }

        // --- isERP + dataPartitioning rule ---
        if (system.isERP === true && system.dataPartitioning === 'Monolithic') {
          expect(hasPoint(result.concerns, 9)).toBe(true);
        } else {
          expect(hasPoint(result.concerns, 9)).toBe(false);
        }
      }),
      { numRuns: 200 }
    );
  });

  it('no spurious alignments or concerns for unrelated field combinations', () => {
    fc.assert(
      fc.property(arbTcopSystem, (system) => {
        const result = computeTcopAssessment(system);

        // Compute the exact expected set of alignment points
        const expectedAlignmentPoints = new Set();
        if (system.isCloud === true) expectedAlignmentPoints.add(5);
        if (system.portability === 'High') expectedAlignmentPoints.add(4);

        // Compute the exact expected set of concern points (with multiplicity)
        const expectedConcernPoints = [];
        if (system.isCloud === false) expectedConcernPoints.push(5);
        if (system.portability === 'Low') {
          expectedConcernPoints.push(3);
          expectedConcernPoints.push(4);
          expectedConcernPoints.push(11);
        }
        if (system.isERP === true && system.dataPartitioning === 'Monolithic') {
          expectedConcernPoints.push(9);
        }

        // Verify alignment count and points match exactly
        expect(result.alignments.length).toBe(expectedAlignmentPoints.size);
        for (const a of result.alignments) {
          expect(expectedAlignmentPoints.has(a.point)).toBe(true);
        }

        // Verify concern count and points match exactly
        const actualConcernPoints = result.concerns.map(c => c.point).sort();
        const sortedExpected = [...expectedConcernPoints].sort();
        expect(actualConcernPoints).toEqual(sortedExpected);

        // Every entry must have a non-empty description
        for (const a of result.alignments) {
          expect(typeof a.description).toBe('string');
          expect(a.description.length).toBeGreaterThan(0);
        }
        for (const c of result.concerns) {
          expect(typeof c.description).toBe('string');
          expect(c.description.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 200 }
    );
  });
});
