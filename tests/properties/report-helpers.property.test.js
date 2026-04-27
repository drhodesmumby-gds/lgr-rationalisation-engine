import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  computeNoticeTrigger,
  formatVestingRelative,
  generatePostureNarrative,
} from '../../src/features/report-export.js';

/**
 * Property tests for pure helper functions in report-export.js
 *
 * Functions under test:
 *   - computeNoticeTrigger
 *   - formatVestingRelative
 *   - generatePostureNarrative
 */

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** A valid endYear in a realistic range */
const arbEndYear = fc.integer({ min: 2025, max: 2040 });

/** A valid endMonth 1–12 */
const arbEndMonth = fc.integer({ min: 1, max: 12 });

/** A valid positive notice period (months) */
const arbPositiveNotice = fc.integer({ min: 1, max: 60 });

/**
 * A system object with all fields required for a valid computeNoticeTrigger
 * result. endMonth is always provided here.
 */
const arbValidSys = fc.record({
  endYear: arbEndYear,
  endMonth: arbEndMonth,
  noticePeriod: arbPositiveNotice,
});

/**
 * A system object with endMonth omitted (should default to 12 inside the
 * function).
 */
const arbValidSysNoEndMonth = fc.record({
  endYear: arbEndYear,
  noticePeriod: arbPositiveNotice,
});

/** A vesting date string in "YYYY-MM-DD" format */
const arbVestingDateStr = fc
  .record({
    year: fc.integer({ min: 2025, max: 2035 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
  })
  .map(
    ({ year, month, day }) =>
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  );

/** A triggerTotalMonths value in a realistic range */
const arbTriggerTotalMonths = fc.integer({ min: 24000, max: 24500 });

/**
 * A posture snapshot for generatePostureNarrative.
 * Values are small non-negative integers; total >= onPrem to keep cloud % sane.
 */
const arbPostureSnapshot = fc
  .record({
    onPrem: fc.integer({ min: 0, max: 10 }),
    erp: fc.integer({ min: 0, max: 5 }),
    monolithic: fc.integer({ min: 0, max: 5 }),
    lowPortability: fc.integer({ min: 0, max: 5 }),
    extra: fc.integer({ min: 0, max: 5 }),
  })
  .map(({ onPrem, erp, monolithic, lowPortability, extra }) => ({
    onPrem,
    erp,
    monolithic,
    lowPortability,
    total: onPrem + extra, // total >= onPrem so cloud % is valid
  }));

// ---------------------------------------------------------------------------
// computeNoticeTrigger — property tests
// ---------------------------------------------------------------------------

describe('computeNoticeTrigger', () => {

  it('trigger is always strictly before contract end for valid inputs', () => {
    fc.assert(
      fc.property(arbValidSys, (sys) => {
        const result = computeNoticeTrigger(sys);
        expect(result).not.toBeNull();
        const endTotalMonths = sys.endYear * 12 + sys.endMonth;
        expect(result.triggerTotalMonths).toBeLessThan(endTotalMonths);
      }),
      { numRuns: 200 }
    );
  });

  it('triggerTotalMonths equals (endYear * 12 + endMonth) - noticePeriod', () => {
    fc.assert(
      fc.property(arbValidSys, (sys) => {
        const result = computeNoticeTrigger(sys);
        expect(result).not.toBeNull();
        const expected = sys.endYear * 12 + sys.endMonth - sys.noticePeriod;
        expect(result.triggerTotalMonths).toBe(expected);
      }),
      { numRuns: 200 }
    );
  });

  it('triggerDate matches YYYY-MM pattern', () => {
    fc.assert(
      fc.property(arbValidSys, (sys) => {
        const result = computeNoticeTrigger(sys);
        expect(result).not.toBeNull();
        expect(result.triggerDate).toMatch(/^\d{4}-\d{2}$/);
      }),
      { numRuns: 200 }
    );
  });

  it('returns null when endYear is missing', () => {
    fc.assert(
      fc.property(
        fc.record({ endMonth: arbEndMonth, noticePeriod: arbPositiveNotice }),
        (sys) => {
          const result = computeNoticeTrigger(sys);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns null when noticePeriod is 0', () => {
    fc.assert(
      fc.property(
        fc.record({ endYear: arbEndYear, endMonth: arbEndMonth }),
        (sys) => {
          const result = computeNoticeTrigger({ ...sys, noticePeriod: 0 });
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns null when noticePeriod is negative', () => {
    fc.assert(
      fc.property(
        fc.record({ endYear: arbEndYear, endMonth: arbEndMonth }),
        fc.integer({ min: -100, max: -1 }),
        (sys, negNotice) => {
          const result = computeNoticeTrigger({ ...sys, noticePeriod: negNotice });
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns null when noticePeriod is not a number', () => {
    fc.assert(
      fc.property(
        fc.record({ endYear: arbEndYear, endMonth: arbEndMonth }),
        fc.constantFrom('12', null, undefined, true, []),
        (sys, badNotice) => {
          const result = computeNoticeTrigger({ ...sys, noticePeriod: badNotice });
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('when endMonth is omitted it defaults to 12 (same result as endMonth: 12)', () => {
    fc.assert(
      fc.property(arbValidSysNoEndMonth, (sys) => {
        const withDefault = computeNoticeTrigger(sys);
        const withExplicit = computeNoticeTrigger({ ...sys, endMonth: 12 });
        expect(withDefault).not.toBeNull();
        expect(withExplicit).not.toBeNull();
        expect(withDefault.triggerTotalMonths).toBe(withExplicit.triggerTotalMonths);
        expect(withDefault.triggerDate).toBe(withExplicit.triggerDate);
      }),
      { numRuns: 100 }
    );
  });

  it('isOverdue is a boolean', () => {
    fc.assert(
      fc.property(arbValidSys, (sys) => {
        const result = computeNoticeTrigger(sys);
        expect(result).not.toBeNull();
        expect(typeof result.isOverdue).toBe('boolean');
      }),
      { numRuns: 100 }
    );
  });

});

// ---------------------------------------------------------------------------
// formatVestingRelative — property tests
// ---------------------------------------------------------------------------

describe('formatVestingRelative', () => {

  it('returns null when vestingDateStr is null', () => {
    fc.assert(
      fc.property(arbTriggerTotalMonths, (triggerTotalMonths) => {
        expect(formatVestingRelative(triggerTotalMonths, null)).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('returns null when vestingDateStr is undefined', () => {
    fc.assert(
      fc.property(arbTriggerTotalMonths, (triggerTotalMonths) => {
        expect(formatVestingRelative(triggerTotalMonths, undefined)).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('returns a string containing "before" when trigger is before vesting', () => {
    fc.assert(
      fc.property(arbVestingDateStr, fc.integer({ min: 1, max: 60 }), (vestingDateStr, offset) => {
        const vDate = new Date(vestingDateStr);
        const vestingMonth = vDate.getFullYear() * 12 + (vDate.getMonth() + 1);
        // trigger is earlier than vesting by `offset` months
        const triggerTotalMonths = vestingMonth - offset;
        const result = formatVestingRelative(triggerTotalMonths, vestingDateStr);
        expect(result).toBeTypeOf('string');
        expect(result).toContain('before');
      }),
      { numRuns: 100 }
    );
  });

  it('returns a string containing "after" when trigger is after vesting', () => {
    fc.assert(
      fc.property(arbVestingDateStr, fc.integer({ min: 1, max: 60 }), (vestingDateStr, offset) => {
        const vDate = new Date(vestingDateStr);
        const vestingMonth = vDate.getFullYear() * 12 + (vDate.getMonth() + 1);
        // trigger is later than vesting by `offset` months
        const triggerTotalMonths = vestingMonth + offset;
        const result = formatVestingRelative(triggerTotalMonths, vestingDateStr);
        expect(result).toBeTypeOf('string');
        expect(result).toContain('after');
      }),
      { numRuns: 100 }
    );
  });

  it('returns "vesting month" when trigger equals the vesting month', () => {
    fc.assert(
      fc.property(arbVestingDateStr, (vestingDateStr) => {
        const vDate = new Date(vestingDateStr);
        const vestingMonth = vDate.getFullYear() * 12 + (vDate.getMonth() + 1);
        const result = formatVestingRelative(vestingMonth, vestingDateStr);
        expect(result).toBe('vesting month');
      }),
      { numRuns: 100 }
    );
  });

  it('uses singular "1 month" not "1 months" when diff is exactly 1', () => {
    fc.assert(
      fc.property(arbVestingDateStr, (vestingDateStr) => {
        const vDate = new Date(vestingDateStr);
        const vestingMonth = vDate.getFullYear() * 12 + (vDate.getMonth() + 1);

        // 1 month before vesting
        const resultBefore = formatVestingRelative(vestingMonth - 1, vestingDateStr);
        expect(resultBefore).toBe('1 month before vesting');

        // 1 month after vesting
        const resultAfter = formatVestingRelative(vestingMonth + 1, vestingDateStr);
        expect(resultAfter).toBe('1 month after vesting');
      }),
      { numRuns: 100 }
    );
  });

  it('the month count in the output matches the actual difference', () => {
    fc.assert(
      fc.property(
        arbVestingDateStr,
        fc.integer({ min: 2, max: 60 }),
        fc.constantFrom(-1, 1),
        (vestingDateStr, diff, sign) => {
          const vDate = new Date(vestingDateStr);
          const vestingMonth = vDate.getFullYear() * 12 + (vDate.getMonth() + 1);
          const triggerTotalMonths = vestingMonth - diff * sign;
          const result = formatVestingRelative(triggerTotalMonths, vestingDateStr);
          expect(result).toBeTypeOf('string');
          // The result should contain the exact diff number
          expect(result).toContain(String(diff));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('output uses plural "months" when diff is 2 or more', () => {
    fc.assert(
      fc.property(
        arbVestingDateStr,
        fc.integer({ min: 2, max: 60 }),
        (vestingDateStr, diff) => {
          const vDate = new Date(vestingDateStr);
          const vestingMonth = vDate.getFullYear() * 12 + (vDate.getMonth() + 1);

          const resultBefore = formatVestingRelative(vestingMonth - diff, vestingDateStr);
          expect(resultBefore).toContain('months');

          const resultAfter = formatVestingRelative(vestingMonth + diff, vestingDateStr);
          expect(resultAfter).toContain('months');
        }
      ),
      { numRuns: 100 }
    );
  });

});

// ---------------------------------------------------------------------------
// generatePostureNarrative — property tests
// ---------------------------------------------------------------------------

describe('generatePostureNarrative', () => {

  it('returns an empty array when before and after are identical', () => {
    fc.assert(
      fc.property(arbPostureSnapshot, (snapshot) => {
        const result = generatePostureNarrative(snapshot, { ...snapshot });
        expect(result).toEqual([]);
      }),
      { numRuns: 100 }
    );
  });

  it('returns a non-empty array when at least one value differs', () => {
    fc.assert(
      fc.property(
        arbPostureSnapshot,
        fc.integer({ min: 1, max: 5 }),
        (snapshot, delta) => {
          const after = { ...snapshot, total: snapshot.total + delta };
          const result = generatePostureNarrative(snapshot, after);
          expect(result.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('number of bullets is at most 6 (one per metric)', () => {
    fc.assert(
      fc.property(arbPostureSnapshot, arbPostureSnapshot, (before, after) => {
        const result = generatePostureNarrative(before, after);
        expect(result.length).toBeLessThanOrEqual(6);
      }),
      { numRuns: 200 }
    );
  });

  it('every bullet is a non-empty string', () => {
    fc.assert(
      fc.property(arbPostureSnapshot, arbPostureSnapshot, (before, after) => {
        const result = generatePostureNarrative(before, after);
        for (const bullet of result) {
          expect(typeof bullet).toBe('string');
          expect(bullet.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('ERP bullet mentions "ERP footprint" when erp values differ', () => {
    fc.assert(
      fc.property(
        arbPostureSnapshot,
        fc.integer({ min: 1, max: 5 }),
        (snapshot, delta) => {
          const after = { ...snapshot, erp: snapshot.erp + delta };
          const result = generatePostureNarrative(snapshot, after);
          const erpBullets = result.filter(b => b.includes('ERP footprint'));
          expect(erpBullets.length).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no ERP bullet when erp values are equal', () => {
    fc.assert(
      fc.property(arbPostureSnapshot, (snapshot) => {
        // Only differ on total so we get at least one bullet but not an ERP bullet
        const after = { ...snapshot, total: snapshot.total + 1 };
        // Ensure ERP is identical
        const result = generatePostureNarrative(snapshot, after);
        const erpBullets = result.filter(b => b.includes('ERP footprint'));
        expect(erpBullets.length).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('Monolithic bullet mentions "Monolithic" when monolithic values differ', () => {
    fc.assert(
      fc.property(
        arbPostureSnapshot,
        fc.integer({ min: 1, max: 5 }),
        (snapshot, delta) => {
          const after = { ...snapshot, monolithic: snapshot.monolithic + delta };
          const result = generatePostureNarrative(snapshot, after);
          const monoBullets = result.filter(b => b.includes('Monolithic'));
          expect(monoBullets.length).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('ERP bullet contains "reduces" when erp count decreases', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        arbPostureSnapshot,
        (erpBefore, snapshot) => {
          const before = { ...snapshot, erp: erpBefore };
          const after = { ...snapshot, erp: erpBefore - 1 };
          const result = generatePostureNarrative(before, after);
          const erpBullet = result.find(b => b.includes('ERP footprint'));
          expect(erpBullet).toBeDefined();
          expect(erpBullet).toContain('reduces');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('ERP bullet contains "increases" when erp count increases', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9 }),
        arbPostureSnapshot,
        (erpBefore, snapshot) => {
          const before = { ...snapshot, erp: erpBefore };
          const after = { ...snapshot, erp: erpBefore + 1 };
          const result = generatePostureNarrative(before, after);
          const erpBullet = result.find(b => b.includes('ERP footprint'));
          expect(erpBullet).toBeDefined();
          expect(erpBullet).toContain('increases');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('cloud % bullet mentions "moves" when cloud proportion changes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 2, max: 10 }),
        (totalBefore, extraOnPremAfter) => {
          // before: all cloud (onPrem=0, total=totalBefore)
          const before = {
            total: totalBefore,
            onPrem: 0,
            erp: 0,
            monolithic: 0,
            lowPortability: 0,
          };
          // after: some on-prem added so cloud % changes, total must stay >= onPrem
          const onPremAfter = Math.min(extraOnPremAfter, totalBefore);
          if (onPremAfter === 0) return; // skip degenerate: no change in cloud %
          const after = {
            total: totalBefore,
            onPrem: onPremAfter,
            erp: 0,
            monolithic: 0,
            lowPortability: 0,
          };
          const result = generatePostureNarrative(before, after);
          const cloudBullet = result.find(b => b.includes('moves'));
          // If the rounded percentages actually differ, we should have a bullet
          const beforeCloud = Math.round(((before.total - before.onPrem) / before.total) * 100);
          const afterCloud = Math.round(((after.total - after.onPrem) / after.total) * 100);
          if (beforeCloud !== afterCloud) {
            expect(cloudBullet).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns empty array when both before and after have total=0', () => {
    const zeroPosture = { total: 0, onPrem: 0, erp: 0, monolithic: 0, lowPortability: 0 };
    const result = generatePostureNarrative(zeroPosture, { ...zeroPosture });
    expect(result).toEqual([]);
  });

});
