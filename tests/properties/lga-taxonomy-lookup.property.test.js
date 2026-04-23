import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getLgaFunction, getLgaBreadcrumb } from '../../src/taxonomy.js';
import { LGA_FUNCTIONS } from '../../src/constants/lga-functions.js';

/**
 * Tier 2 — Data Integrity: LGA taxonomy lookup functions
 *
 * Tests getLgaFunction and getLgaBreadcrumb, which are used throughout
 * baselining to resolve ESD function IDs into display labels and
 * breadcrumb paths.
 */

// ---------------------------------------------------------------------------
// Derived sets — computed once at module load from the real LGA_FUNCTIONS array
// ---------------------------------------------------------------------------

/** All valid IDs as a Set for fast membership checks */
const ALL_VALID_IDS = new Set(LGA_FUNCTIONS.map(f => f.id));

/** IDs of root entries: parentId === null */
const ROOT_IDS = LGA_FUNCTIONS
  .filter(f => f.parentId === null)
  .map(f => f.id);

/** IDs of direct children of root: parent exists and parent has parentId === null */
const DIRECT_CHILD_IDS = LGA_FUNCTIONS
  .filter(f => {
    if (!f.parentId) return false;
    const parent = LGA_FUNCTIONS.find(p => p.id === f.parentId);
    return parent && parent.parentId === null;
  })
  .map(f => f.id);

/** IDs of grandchildren: parent exists and parent also has a non-null parentId */
const GRANDCHILD_IDS = LGA_FUNCTIONS
  .filter(f => {
    if (!f.parentId) return false;
    const parent = LGA_FUNCTIONS.find(p => p.id === f.parentId);
    return parent && parent.parentId !== null;
  })
  .map(f => f.id);

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Pick any valid ESD function ID from LGA_FUNCTIONS */
const arbValidId = fc.constantFrom(...LGA_FUNCTIONS.map(f => f.id));

/** Pick an ID that does not exist in LGA_FUNCTIONS */
const arbInvalidId = fc.string({ minLength: 1, maxLength: 10 })
  .filter(s => !ALL_VALID_IDS.has(s));

/** Pick a root ID (parentId === null) */
const arbRootId = fc.constantFrom(...ROOT_IDS);

/** Pick a direct child of root ID */
const arbDirectChildId = fc.constantFrom(...DIRECT_CHILD_IDS);

/** Pick a grandchild ID */
const arbGrandchildId = fc.constantFrom(...GRANDCHILD_IDS);

// ---------------------------------------------------------------------------
// getLgaFunction tests
// ---------------------------------------------------------------------------

describe('getLgaFunction', () => {

  it('returns the correct entry for any valid ID', () => {
    fc.assert(
      fc.property(arbValidId, (id) => {
        const result = getLgaFunction(id);

        // Must return an object, not undefined
        expect(result).toBeDefined();

        // The returned entry must have exactly the id requested
        expect(result.id).toBe(id);

        // Must have a non-empty label string
        expect(typeof result.label).toBe('string');
        expect(result.label.length).toBeGreaterThan(0);

        // parentId must be either null or a string
        expect(result.parentId === null || typeof result.parentId === 'string').toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('returned entry matches the original LGA_FUNCTIONS entry exactly', () => {
    fc.assert(
      fc.property(arbValidId, (id) => {
        const result = getLgaFunction(id);
        const expected = LGA_FUNCTIONS.find(f => f.id === id);

        expect(result).toBe(expected); // same object reference — no cloning
      }),
      { numRuns: 200 }
    );
  });

  it('returns undefined for IDs not present in LGA_FUNCTIONS', () => {
    fc.assert(
      fc.property(arbInvalidId, (id) => {
        const result = getLgaFunction(id);
        expect(result).toBeUndefined();
      }),
      { numRuns: 200 }
    );
  });

  it('all 176 ESD taxonomy IDs resolve to a defined entry', () => {
    // Exhaustive check — not random, but a useful regression guard
    expect(LGA_FUNCTIONS.length).toBe(176);

    for (const entry of LGA_FUNCTIONS) {
      const result = getLgaFunction(entry.id);
      expect(result).toBeDefined();
      expect(result.id).toBe(entry.id);
    }
  });

  it('each entry returned has the expected shape { id, label, parentId }', () => {
    fc.assert(
      fc.property(arbValidId, (id) => {
        const result = getLgaFunction(id);

        expect(Object.prototype.hasOwnProperty.call(result, 'id')).toBe(true);
        expect(Object.prototype.hasOwnProperty.call(result, 'label')).toBe(true);
        expect(Object.prototype.hasOwnProperty.call(result, 'parentId')).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

});

// ---------------------------------------------------------------------------
// getLgaBreadcrumb tests
// ---------------------------------------------------------------------------

describe('getLgaBreadcrumb', () => {

  it('returns null for root entries (no parentId)', () => {
    fc.assert(
      fc.property(arbRootId, (id) => {
        const result = getLgaBreadcrumb(id);
        expect(result).toBeNull();
      }),
      { numRuns: 200 }
    );
  });

  it('returns null for direct children of root', () => {
    fc.assert(
      fc.property(arbDirectChildId, (id) => {
        const result = getLgaBreadcrumb(id);
        expect(result).toBeNull();
      }),
      { numRuns: 200 }
    );
  });

  it('returns "Parent \u203a Label" format for grandchild entries', () => {
    fc.assert(
      fc.property(arbGrandchildId, (id) => {
        const fn = getLgaFunction(id);
        const parent = getLgaFunction(fn.parentId);

        const result = getLgaBreadcrumb(id);

        // Must be a non-null string
        expect(typeof result).toBe('string');
        expect(result).not.toBeNull();

        // Must equal "parent.label › fn.label"
        const expected = parent.label + ' \u203a ' + fn.label;
        expect(result).toBe(expected);
      }),
      { numRuns: 200 }
    );
  });

  it('breadcrumb for grandchildren contains the parent label as the first segment', () => {
    fc.assert(
      fc.property(arbGrandchildId, (id) => {
        const fn = getLgaFunction(id);
        const parent = getLgaFunction(fn.parentId);

        const result = getLgaBreadcrumb(id);

        expect(result).not.toBeNull();
        expect(result.startsWith(parent.label)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('breadcrumb for grandchildren ends with the function label', () => {
    fc.assert(
      fc.property(arbGrandchildId, (id) => {
        const fn = getLgaFunction(id);

        const result = getLgaBreadcrumb(id);

        expect(result).not.toBeNull();
        expect(result.endsWith(fn.label)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('returns null for IDs not present in LGA_FUNCTIONS', () => {
    fc.assert(
      fc.property(arbInvalidId, (id) => {
        const result = getLgaBreadcrumb(id);
        expect(result).toBeNull();
      }),
      { numRuns: 200 }
    );
  });

  it('breadcrumb separator is the \u203a character (U+203A), not a plain > character', () => {
    fc.assert(
      fc.property(arbGrandchildId, (id) => {
        const result = getLgaBreadcrumb(id);

        expect(result).not.toBeNull();
        // Must contain the single right-pointing angle quotation mark
        expect(result.includes('\u203a')).toBe(true);
        // The separator is " \u203a " (with spaces) not ">"
        expect(result.includes(' \u203a ')).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('all LGA_FUNCTIONS entries return null or a non-empty string \u2014 never throws', () => {
    // Exhaustive check across all 176 entries
    for (const entry of LGA_FUNCTIONS) {
      const result = getLgaBreadcrumb(entry.id);
      expect(result === null || (typeof result === 'string' && result.length > 0)).toBe(true);
    }
  });

});
