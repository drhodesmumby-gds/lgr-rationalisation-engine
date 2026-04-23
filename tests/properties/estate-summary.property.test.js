import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeEstateSummaryMetrics } from '../../src/analysis/metrics.js';
import { buildSuccessorAllocation, detectSharedServiceBoundary } from '../../src/analysis/allocation.js';
import { arbEstate } from '../generators/arbEstate.js';

/**
 * Property 9: Estate summary metrics correctness
 *
 * Feature: lgr-transition-planning, Property 9: Estate summary metrics correctness
 *
 * Validates: Requirements 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 */

const estateArb = arbEstate({ buildSuccessorAllocation, detectSharedServiceBoundary });

describe('Property 9: Estate summary metrics correctness', {
  tags: [
    'Feature: lgr-transition-planning',
    'Property 9: Estate summary metrics correctness',
  ],
}, () => {

  it('predecessor count equals mergedArchitecture.councils.size', () => {
    fc.assert(
      fc.property(estateArb, ({ mergedArchitecture, lgaFunctionMap, transitionStructure, successorAllocationMap }) => {
        const metrics = computeEstateSummaryMetrics(
          mergedArchitecture, lgaFunctionMap, transitionStructure, successorAllocationMap
        );
        expect(metrics.predecessorCount).toBe(mergedArchitecture.councils.size);
      }),
      { numRuns: 100 }
    );
  });

  it('system count equals count of ITSystem nodes', () => {
    fc.assert(
      fc.property(estateArb, ({ mergedArchitecture, lgaFunctionMap, transitionStructure, successorAllocationMap }) => {
        const metrics = computeEstateSummaryMetrics(
          mergedArchitecture, lgaFunctionMap, transitionStructure, successorAllocationMap
        );
        const expectedCount = mergedArchitecture.nodes.filter(n => n.type === 'ITSystem').length;
        expect(metrics.systemCount).toBe(expectedCount);
      }),
      { numRuns: 100 }
    );
  });

  it('collision count equals lgaFunctionMap entries with councils.size > 1', () => {
    fc.assert(
      fc.property(estateArb, ({ mergedArchitecture, lgaFunctionMap, transitionStructure, successorAllocationMap }) => {
        const metrics = computeEstateSummaryMetrics(
          mergedArchitecture, lgaFunctionMap, transitionStructure, successorAllocationMap
        );
        let expectedCollisions = 0;
        lgaFunctionMap.forEach(entry => {
          if (entry.councils && entry.councils.size > 1) expectedCollisions++;
        });
        expect(metrics.collisionCount).toBe(expectedCollisions);
      }),
      { numRuns: 100 }
    );
  });

  it('annual spend equals sum of all annualCost values', () => {
    fc.assert(
      fc.property(estateArb, ({ mergedArchitecture, lgaFunctionMap, transitionStructure, successorAllocationMap }) => {
        const metrics = computeEstateSummaryMetrics(
          mergedArchitecture, lgaFunctionMap, transitionStructure, successorAllocationMap
        );
        const systems = mergedArchitecture.nodes.filter(n => n.type === 'ITSystem');
        const systemsWithCost = systems.filter(s => typeof s.annualCost === 'number' && !isNaN(s.annualCost));

        if (systemsWithCost.length === 0) {
          expect(metrics.totalAnnualSpend).toBeNull();
        } else {
          const expectedSpend = systemsWithCost.reduce((sum, s) => sum + s.annualCost, 0);
          expect(metrics.totalAnnualSpend).toBe(expectedSpend);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('pre-vesting count matches systems with notice trigger before vesting month', () => {
    fc.assert(
      fc.property(estateArb, ({ mergedArchitecture, lgaFunctionMap, transitionStructure, successorAllocationMap }) => {
        const metrics = computeEstateSummaryMetrics(
          mergedArchitecture, lgaFunctionMap, transitionStructure, successorAllocationMap
        );

        if (!transitionStructure || !transitionStructure.vestingDate) {
          expect(metrics.preVestingNoticeCount).toBeNull();
          return;
        }

        const vDate = new Date(transitionStructure.vestingDate);
        const vestingMonth = vDate.getFullYear() * 12 + (vDate.getMonth() + 1);
        const systems = mergedArchitecture.nodes.filter(n => n.type === 'ITSystem');

        let expectedCount = 0;
        systems.forEach(sys => {
          if (sys.endYear && typeof sys.noticePeriod === 'number') {
            const noticeTriggerMonth = sys.endYear * 12 + (sys.endMonth || 12) - sys.noticePeriod;
            if (noticeTriggerMonth < vestingMonth) {
              expectedCount++;
            }
          }
        });

        expect(metrics.preVestingNoticeCount).toBe(expectedCount);
      }),
      { numRuns: 100 }
    );
  });

  it('disaggregation count matches systems with isDisaggregation: true', () => {
    fc.assert(
      fc.property(estateArb, ({ mergedArchitecture, lgaFunctionMap, transitionStructure, successorAllocationMap }) => {
        const metrics = computeEstateSummaryMetrics(
          mergedArchitecture, lgaFunctionMap, transitionStructure, successorAllocationMap
        );

        const isTransitionMode = !!(
          transitionStructure &&
          transitionStructure.successors &&
          transitionStructure.successors.length > 0 &&
          successorAllocationMap
        );

        if (!isTransitionMode) {
          expect(metrics.disaggregationCount).toBeNull();
          return;
        }

        // Collect unique system IDs with isDisaggregation: true
        const disaggregatedIds = new Set();
        successorAllocationMap.forEach(funcMap => {
          funcMap.forEach(allocations => {
            allocations.forEach(alloc => {
              if (alloc.isDisaggregation) {
                disaggregatedIds.add(alloc.system.id);
              }
            });
          });
        });

        expect(metrics.disaggregationCount).toBe(disaggregatedIds.size);
      }),
      { numRuns: 100 }
    );
  });

  it('monolithic-disaggregation count matches systems with both flags', () => {
    fc.assert(
      fc.property(estateArb, ({ mergedArchitecture, lgaFunctionMap, transitionStructure, successorAllocationMap }) => {
        const metrics = computeEstateSummaryMetrics(
          mergedArchitecture, lgaFunctionMap, transitionStructure, successorAllocationMap
        );

        const isTransitionMode = !!(
          transitionStructure &&
          transitionStructure.successors &&
          transitionStructure.successors.length > 0 &&
          successorAllocationMap
        );

        if (!isTransitionMode) {
          expect(metrics.monolithicDisaggregationCount).toBeNull();
          return;
        }

        // Collect unique system IDs with isDisaggregation AND dataPartitioning === 'Monolithic'
        const monolithicDisaggregatedIds = new Set();
        successorAllocationMap.forEach(funcMap => {
          funcMap.forEach(allocations => {
            allocations.forEach(alloc => {
              if (alloc.isDisaggregation && alloc.system.dataPartitioning === 'Monolithic') {
                monolithicDisaggregatedIds.add(alloc.system.id);
              }
            });
          });
        });

        expect(metrics.monolithicDisaggregationCount).toBe(monolithicDisaggregatedIds.size);
      }),
      { numRuns: 100 }
    );
  });

});
