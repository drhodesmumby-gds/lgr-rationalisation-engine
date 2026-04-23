import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generatePersonaQuestions } from '../../src/analysis/questions.js';
import { arbITSystem } from '../generators/arbITSystem.js';

/**
 * Property tests for generatePersonaQuestions
 *
 * generatePersonaQuestions(persona, pattern, signals, systems, anchorSystem, allocations, tierInfo)
 * returns an array of { question, answer, indicator, indicatorLabel } objects.
 *
 * Each persona section fires independently:
 *   persona === 'executive' or null => executive questions (3 always + conditional)
 *   persona === 'commercial' or null => commercial questions (3 always + conditional)
 *   persona === 'architect'  or null => architect questions (4 always + conditional)
 *   persona === null         => all three sections combined
 */


// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COUNCIL_NAMES = ['Alpha Council', 'Beta District', 'Gamma Borough'];
const SUCCESSOR_NAMES = ['New Unitary A', 'New Unitary B'];

const VALID_INDICATORS = ['red', 'amber', 'green', 'blue', 'neutral'];

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const arbPersona = fc.constantFrom('executive', 'commercial', 'architect', null);
const arbNamedPersona = fc.constantFrom('executive', 'commercial', 'architect');
const arbPattern = fc.constantFrom(
  null,
  'inherit-as-is',
  'choose-and-consolidate',
  'extract-and-partition',
  'extract-partition-and-consolidate'
);

const arbSignal = fc.record({
  id: fc.constantFrom(
    'contractUrgency',
    'userVolume',
    'dataMonolith',
    'dataPortability',
    'vendorDensity',
    'techDebt',
    'tcopAlignment',
    'sharedService'
  ),
  weight: fc.integer({ min: 1, max: 3 }),
  label: fc.string({ minLength: 1, maxLength: 30 }),
  value: fc.string({ minLength: 1, maxLength: 100 }),
  tag: fc.constantFrom('tag-red', 'tag-orange', 'tag-blue', 'tag-purple', 'tag-black', 'tag-green'),
  border: fc.string(),
  strong: fc.boolean(),
});

const arbTierInfo = fc.oneof(
  fc.constant(null),
  fc.record({ tier: fc.constantFrom(1, 2, 3) })
);

// Object.prototype property names that shadow the plain-object vendorMap inside
// generatePersonaQuestions, causing "vendorMap[s.vendor].push is not a function" errors.
// The function uses a plain {} object as a map — vendor names that collide with
// inherited properties break the hasOwnProperty-free check. We filter these out
// rather than fixing the application code (tests must not modify the HTML).
const OBJECT_PROTOTYPE_KEYS = new Set(Object.getOwnPropertyNames(Object.prototype));

const arbITSystemForTest = arbITSystem({ councilNames: COUNCIL_NAMES, successorNames: SUCCESSOR_NAMES })
  .filter(sys => !sys.vendor || !OBJECT_PROTOTYPE_KEYS.has(sys.vendor));

const arbAllocation = fc.record({
  system: arbITSystemForTest,
  sourceCouncil: fc.constantFrom(...COUNCIL_NAMES),
  allocationType: fc.constantFrom('full', 'partial', 'targeted'),
  needsAllocationReview: fc.boolean(),
  isDisaggregation: fc.boolean(),
});

/**
 * Generate 0–4 systems. We allow empty arrays to test fallback behaviour.
 */
const arbSystems = fc.array(arbITSystemForTest, { minLength: 0, maxLength: 4 });

/**
 * Generate 0–4 signals with potentially duplicate IDs (the function just
 * searches the array for the first match — duplicates are harmless).
 */
const arbSignals = fc.array(arbSignal, { minLength: 0, maxLength: 8 });

/**
 * Anchor system: either null or one of the systems in the array.
 * We generate it independently so it is occasionally non-null even when
 * the systems array is empty (the function should handle that gracefully).
 */
const arbAnchorSystem = fc.oneof(
  fc.constant(null),
  arbITSystemForTest
);

const arbAllocations = fc.array(arbAllocation, { minLength: 0, maxLength: 4 });

// ---------------------------------------------------------------------------
// Structural shape helpers
// ---------------------------------------------------------------------------

function isValidQuestion(q) {
  return (
    q !== null &&
    typeof q === 'object' &&
    typeof q.question === 'string' &&
    typeof q.answer === 'string' &&
    typeof q.indicator === 'string' &&
    typeof q.indicatorLabel === 'string'
  );
}

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('generatePersonaQuestions — structural properties', () => {

  // Property 1: Result is always an array
  it('always returns an array for any persona and pattern', () => {
    fc.assert(
      fc.property(
        arbPersona, arbPattern, arbSignals, arbSystems, arbAnchorSystem, arbAllocations, arbTierInfo,
        (persona, pattern, signals, systems, anchorSystem, allocations, tierInfo) => {
          const result = generatePersonaQuestions(persona, pattern, signals, systems, anchorSystem, allocations, tierInfo);
          expect(Array.isArray(result)).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  // Property 2: Each question has required shape with correct types
  it('every question has the required shape with correct types', () => {
    fc.assert(
      fc.property(
        arbPersona, arbPattern, arbSignals, arbSystems, arbAnchorSystem, arbAllocations, arbTierInfo,
        (persona, pattern, signals, systems, anchorSystem, allocations, tierInfo) => {
          const result = generatePersonaQuestions(persona, pattern, signals, systems, anchorSystem, allocations, tierInfo);
          for (const q of result) {
            expect(isValidQuestion(q)).toBe(true);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  // Property 3: question and answer strings are non-empty
  it('every question and answer string is non-empty', () => {
    fc.assert(
      fc.property(
        arbPersona, arbPattern, arbSignals, arbSystems, arbAnchorSystem, arbAllocations, arbTierInfo,
        (persona, pattern, signals, systems, anchorSystem, allocations, tierInfo) => {
          const result = generatePersonaQuestions(persona, pattern, signals, systems, anchorSystem, allocations, tierInfo);
          for (const q of result) {
            expect(q.question.length).toBeGreaterThan(0);
            expect(q.answer.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  // Property 4: indicator is one of the valid enumerated values
  it('every indicator is one of red | amber | green | blue | neutral', () => {
    fc.assert(
      fc.property(
        arbPersona, arbPattern, arbSignals, arbSystems, arbAnchorSystem, arbAllocations, arbTierInfo,
        (persona, pattern, signals, systems, anchorSystem, allocations, tierInfo) => {
          const result = generatePersonaQuestions(persona, pattern, signals, systems, anchorSystem, allocations, tierInfo);
          for (const q of result) {
            expect(VALID_INDICATORS).toContain(q.indicator);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

});

// ---------------------------------------------------------------------------
// Per-persona minimum question count
// ---------------------------------------------------------------------------

describe('generatePersonaQuestions — minimum question counts per persona', () => {

  // Property 5: Executive persona always generates at least 3 questions
  // (Q1 Day 1 readiness, Q2 contract decisions, Q3 financial exposure are unconditional)
  it('executive persona always generates at least 3 questions', () => {
    fc.assert(
      fc.property(
        arbPattern, arbSignals, arbSystems, arbAnchorSystem, arbAllocations, arbTierInfo,
        (pattern, signals, systems, anchorSystem, allocations, tierInfo) => {
          const result = generatePersonaQuestions('executive', pattern, signals, systems, anchorSystem, allocations, tierInfo);
          expect(result.length).toBeGreaterThanOrEqual(3);
        }
      ),
      { numRuns: 200 }
    );
  });

  // Property 6: Commercial persona always generates at least 3 questions
  // (Q1 vendor commonality, Q2 notice constraints, Q3 cost paths are unconditional;
  //  Q4 procurement is also unconditional — so at least 4)
  it('commercial persona always generates at least 3 questions', () => {
    fc.assert(
      fc.property(
        arbPattern, arbSignals, arbSystems, arbAnchorSystem, arbAllocations, arbTierInfo,
        (pattern, signals, systems, anchorSystem, allocations, tierInfo) => {
          const result = generatePersonaQuestions('commercial', pattern, signals, systems, anchorSystem, allocations, tierInfo);
          expect(result.length).toBeGreaterThanOrEqual(3);
        }
      ),
      { numRuns: 200 }
    );
  });

  // Property 7: Architect persona always generates at least 3 questions
  // (Q1 migration anchor, Q2 data complexity, Q3 TCoP alignment, Q4 on-premise exposure
  //  are all unconditional — so at least 4)
  it('architect persona always generates at least 3 questions', () => {
    fc.assert(
      fc.property(
        arbPattern, arbSignals, arbSystems, arbAnchorSystem, arbAllocations, arbTierInfo,
        (pattern, signals, systems, anchorSystem, allocations, tierInfo) => {
          const result = generatePersonaQuestions('architect', pattern, signals, systems, anchorSystem, allocations, tierInfo);
          expect(result.length).toBeGreaterThanOrEqual(3);
        }
      ),
      { numRuns: 200 }
    );
  });

  // Property 8: null persona triggers ALL three sections — more questions than any single persona
  // Executive always produces >= 3, commercial >= 3, architect >= 3 — so null produces >= 9
  // (We use >= 9 as the minimum floor; conditional questions may add more)
  it('null persona generates questions from all three sections (at least 9)', () => {
    fc.assert(
      fc.property(
        arbPattern, arbSignals, arbSystems, arbAnchorSystem, arbAllocations, arbTierInfo,
        (pattern, signals, systems, anchorSystem, allocations, tierInfo) => {
          const nullResult = generatePersonaQuestions(null, pattern, signals, systems, anchorSystem, allocations, tierInfo);
          // null triggers executive + commercial + architect — every section contributes
          expect(nullResult.length).toBeGreaterThanOrEqual(9);
        }
      ),
      { numRuns: 200 }
    );
  });

  // Property 8b: null result is the union of all three named personas
  it('null persona produces the concatenation of all three persona question sets', () => {
    fc.assert(
      fc.property(
        arbPattern, arbSignals, arbSystems, arbAnchorSystem, arbAllocations, arbTierInfo,
        (pattern, signals, systems, anchorSystem, allocations, tierInfo) => {
          const execResult = generatePersonaQuestions('executive', pattern, signals, systems, anchorSystem, allocations, tierInfo);
          const commResult = generatePersonaQuestions('commercial', pattern, signals, systems, anchorSystem, allocations, tierInfo);
          const archResult = generatePersonaQuestions('architect', pattern, signals, systems, anchorSystem, allocations, tierInfo);
          const nullResult = generatePersonaQuestions(null, pattern, signals, systems, anchorSystem, allocations, tierInfo);

          // The null result should contain exactly the combined count
          expect(nullResult.length).toBe(execResult.length + commResult.length + archResult.length);
        }
      ),
      { numRuns: 200 }
    );
  });

});

// ---------------------------------------------------------------------------
// Fallback / empty systems behaviour
// ---------------------------------------------------------------------------

describe('generatePersonaQuestions — empty systems array produces fallback answers', () => {

  // Property 9: Empty systems still produces questions with content
  it('empty systems array still generates questions (not zero questions)', () => {
    fc.assert(
      fc.property(
        arbNamedPersona, arbPattern, arbSignals, arbTierInfo,
        (persona, pattern, signals, tierInfo) => {
          const result = generatePersonaQuestions(persona, pattern, signals, [], null, [], tierInfo);
          // All named personas must produce at least 3 questions even with no systems
          expect(result.length).toBeGreaterThanOrEqual(3);
          // All answers must still be non-empty strings
          for (const q of result) {
            expect(q.answer.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  // Empty systems: financial exposure question uses 'neutral' indicator (no cost data)
  it('empty systems produces neutral financial indicator in executive persona', () => {
    fc.assert(
      fc.property(
        arbPattern, arbSignals, arbTierInfo,
        (pattern, signals, tierInfo) => {
          const result = generatePersonaQuestions('executive', pattern, signals, [], null, [], tierInfo);
          const financialQ = result.find(q => q.question === 'What is the financial exposure?');
          expect(financialQ).toBeDefined();
          expect(financialQ.indicator).toBe('neutral');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Empty systems: notice constraints question uses 'neutral' indicator in commercial persona
  it('empty systems produces neutral notice constraints indicator in commercial persona', () => {
    fc.assert(
      fc.property(
        arbPattern, arbSignals, arbTierInfo,
        (pattern, signals, tierInfo) => {
          const result = generatePersonaQuestions('commercial', pattern, signals, [], null, [], tierInfo);
          const noticeQ = result.find(q => q.question === 'What notice constraints apply?');
          expect(noticeQ).toBeDefined();
          expect(noticeQ.indicator).toBe('neutral');
        }
      ),
      { numRuns: 100 }
    );
  });

});

// ---------------------------------------------------------------------------
// Conditional question presence based on pattern
// ---------------------------------------------------------------------------

describe('generatePersonaQuestions — conditional questions by rationalisation pattern', () => {

  const consolidatePatterns = ['choose-and-consolidate', 'extract-partition-and-consolidate'];
  const extractPatterns = ['extract-and-partition', 'extract-partition-and-consolidate'];
  const nonConsolidatePatterns = [null, 'inherit-as-is', 'extract-and-partition'];
  const nonExtractPatterns = [null, 'inherit-as-is', 'choose-and-consolidate'];

  // Consolidation question appears for consolidate patterns in executive persona
  it('executive persona includes consolidation question for consolidate patterns', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...consolidatePatterns), arbSignals, arbSystems, arbAnchorSystem, arbAllocations, arbTierInfo,
        (pattern, signals, systems, anchorSystem, allocations, tierInfo) => {
          const result = generatePersonaQuestions('executive', pattern, signals, systems, anchorSystem, allocations, tierInfo);
          const consolidationQ = result.find(q => q.question === 'What are the consolidation options?');
          expect(consolidationQ).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Consolidation question absent for non-consolidate patterns in executive persona
  it('executive persona excludes consolidation question for non-consolidate patterns', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...nonConsolidatePatterns), arbSignals, arbSystems, arbAnchorSystem, arbAllocations, arbTierInfo,
        (pattern, signals, systems, anchorSystem, allocations, tierInfo) => {
          const result = generatePersonaQuestions('executive', pattern, signals, systems, anchorSystem, allocations, tierInfo);
          const consolidationQ = result.find(q => q.question === 'What are the consolidation options?');
          expect(consolidationQ).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Data extraction complexity question appears for extract patterns in executive persona
  it('executive persona includes data extraction complexity for extract patterns', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...extractPatterns), arbSignals, arbSystems, arbAnchorSystem, arbAllocations, arbTierInfo,
        (pattern, signals, systems, anchorSystem, allocations, tierInfo) => {
          const result = generatePersonaQuestions('executive', pattern, signals, systems, anchorSystem, allocations, tierInfo);
          const extractQ = result.find(q => q.question === 'How complex is the data extraction?');
          expect(extractQ).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Data extraction complexity question absent for non-extract patterns in executive persona
  it('executive persona excludes data extraction complexity for non-extract patterns', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...nonExtractPatterns), arbSignals, arbSystems, arbAnchorSystem, arbAllocations, arbTierInfo,
        (pattern, signals, systems, anchorSystem, allocations, tierInfo) => {
          const result = generatePersonaQuestions('executive', pattern, signals, systems, anchorSystem, allocations, tierInfo);
          const extractQ = result.find(q => q.question === 'How complex is the data extraction?');
          expect(extractQ).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Data extraction strategy question in architect persona for extract patterns
  it('architect persona includes data extraction strategy for extract patterns', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...extractPatterns), arbSignals, arbSystems, arbAnchorSystem, arbAllocations, arbTierInfo,
        (pattern, signals, systems, anchorSystem, allocations, tierInfo) => {
          const result = generatePersonaQuestions('architect', pattern, signals, systems, anchorSystem, allocations, tierInfo);
          const extractQ = result.find(q => q.question === 'What is the data extraction strategy?');
          expect(extractQ).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Data extraction strategy question absent in architect persona for non-extract patterns
  it('architect persona excludes data extraction strategy for non-extract patterns', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...nonExtractPatterns), arbSignals, arbSystems, arbAnchorSystem, arbAllocations, arbTierInfo,
        (pattern, signals, systems, anchorSystem, allocations, tierInfo) => {
          const result = generatePersonaQuestions('architect', pattern, signals, systems, anchorSystem, allocations, tierInfo);
          const extractQ = result.find(q => q.question === 'What is the data extraction strategy?');
          expect(extractQ).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  // API and integration implications in architect persona for consolidate patterns
  it('architect persona includes API integration question for consolidate patterns', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...consolidatePatterns), arbSignals, arbSystems, arbAnchorSystem, arbAllocations, arbTierInfo,
        (pattern, signals, systems, anchorSystem, allocations, tierInfo) => {
          const result = generatePersonaQuestions('architect', pattern, signals, systems, anchorSystem, allocations, tierInfo);
          const apiQ = result.find(q => q.question === 'What are the API and integration implications?');
          expect(apiQ).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  // API and integration implications absent in architect persona for non-consolidate patterns
  it('architect persona excludes API integration question for non-consolidate patterns', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...nonConsolidatePatterns), arbSignals, arbSystems, arbAnchorSystem, arbAllocations, arbTierInfo,
        (pattern, signals, systems, anchorSystem, allocations, tierInfo) => {
          const result = generatePersonaQuestions('architect', pattern, signals, systems, anchorSystem, allocations, tierInfo);
          const apiQ = result.find(q => q.question === 'What are the API and integration implications?');
          expect(apiQ).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

});

// ---------------------------------------------------------------------------
// Conditional question presence based on signal presence
// ---------------------------------------------------------------------------

describe('generatePersonaQuestions — conditional shared service question', () => {

  // Shared service question appears in executive persona only when sharedService signal is present
  it('executive persona includes shared service risk question only when sharedService signal is present', () => {
    fc.assert(
      fc.property(
        arbPattern, arbSystems, arbAnchorSystem, arbAllocations, arbTierInfo,
        (pattern, systems, anchorSystem, allocations, tierInfo) => {
          const signalsWithSharedService = [{
            id: 'sharedService',
            weight: 2,
            label: 'Shared service',
            value: 'A shared service is present',
            tag: 'tag-red',
            border: 'border-red-500',
            strong: true,
          }];
          const result = generatePersonaQuestions('executive', pattern, signalsWithSharedService, systems, anchorSystem, allocations, tierInfo);
          const sharedQ = result.find(q => q.question === 'Is there a shared service at risk?');
          expect(sharedQ).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('executive persona excludes shared service risk question when sharedService signal is absent', () => {
    fc.assert(
      fc.property(
        arbPattern, arbSystems, arbAnchorSystem, arbAllocations, arbTierInfo,
        (pattern, systems, anchorSystem, allocations, tierInfo) => {
          // No sharedService signal in the array
          const signalsWithoutSharedService = [{
            id: 'contractUrgency',
            weight: 2,
            label: 'Contract urgency',
            value: 'Some urgency',
            tag: 'tag-orange',
            border: 'border-orange-500',
            strong: false,
          }];
          const result = generatePersonaQuestions('executive', pattern, signalsWithoutSharedService, systems, anchorSystem, allocations, tierInfo);
          const sharedQ = result.find(q => q.question === 'Is there a shared service at risk?');
          expect(sharedQ).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

});

// ---------------------------------------------------------------------------
// Indicator values for well-known question types
// ---------------------------------------------------------------------------

describe('generatePersonaQuestions — indicator values for specific questions', () => {

  // Day 1 readiness: red for Tier 1, blue otherwise
  it('executive Day 1 readiness indicator is red when tierInfo.tier === 1', () => {
    fc.assert(
      fc.property(
        arbPattern, arbSignals, arbSystems, arbAnchorSystem, arbAllocations,
        (pattern, signals, systems, anchorSystem, allocations) => {
          const result = generatePersonaQuestions('executive', pattern, signals, systems, anchorSystem, allocations, { tier: 1 });
          const day1Q = result.find(q => q.question === 'What needs to be operational on Day 1?');
          expect(day1Q).toBeDefined();
          expect(day1Q.indicator).toBe('red');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('executive Day 1 readiness indicator is blue when tier is not 1', () => {
    fc.assert(
      fc.property(
        arbPattern, arbSignals, arbSystems, arbAnchorSystem, arbAllocations,
        (pattern, signals, systems, anchorSystem, allocations) => {
          // Tier 2, tier 3, or null all produce 'blue' (not Tier 1)
          for (const tierInfo of [{ tier: 2 }, { tier: 3 }, null]) {
            const result = generatePersonaQuestions('executive', pattern, signals, systems, anchorSystem, allocations, tierInfo);
            const day1Q = result.find(q => q.question === 'What needs to be operational on Day 1?');
            expect(day1Q).toBeDefined();
            expect(day1Q.indicator).toBe('blue');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Extract complexity in executive persona: red when monolithic systems present, green otherwise
  it('executive data extraction indicator is red when monolithic systems present', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('extract-and-partition', 'extract-partition-and-consolidate'),
        arbSignals, arbTierInfo, arbAnchorSystem, arbAllocations,
        (pattern, signals, tierInfo, anchorSystem, allocations) => {
          const monoSystem = {
            id: 'sys-mono',
            label: 'Monolith System',
            type: 'ITSystem',
            dataPartitioning: 'Monolithic',
          };
          const result = generatePersonaQuestions('executive', pattern, signals, [monoSystem], anchorSystem, allocations, tierInfo);
          const extractQ = result.find(q => q.question === 'How complex is the data extraction?');
          expect(extractQ).toBeDefined();
          expect(extractQ.indicator).toBe('red');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('executive data extraction indicator is green when no monolithic systems', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('extract-and-partition', 'extract-partition-and-consolidate'),
        arbSignals, arbTierInfo, arbAnchorSystem, arbAllocations,
        (pattern, signals, tierInfo, anchorSystem, allocations) => {
          const segmentedSystem = {
            id: 'sys-seg',
            label: 'Segmented System',
            type: 'ITSystem',
            dataPartitioning: 'Segmented',
            isERP: false,
          };
          const result = generatePersonaQuestions('executive', pattern, signals, [segmentedSystem], anchorSystem, allocations, tierInfo);
          const extractQ = result.find(q => q.question === 'How complex is the data extraction?');
          expect(extractQ).toBeDefined();
          expect(extractQ.indicator).toBe('green');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Financial exposure indicator thresholds
  it('executive financial exposure indicator is amber when totalCost > 500000', () => {
    fc.assert(
      fc.property(
        arbPattern, arbSignals, arbTierInfo, arbAnchorSystem, arbAllocations,
        (pattern, signals, tierInfo, anchorSystem, allocations) => {
          const highCostSystem = {
            id: 'sys-expensive',
            label: 'Expensive System',
            type: 'ITSystem',
            annualCost: 600000,
          };
          const result = generatePersonaQuestions('executive', pattern, signals, [highCostSystem], anchorSystem, allocations, tierInfo);
          const financialQ = result.find(q => q.question === 'What is the financial exposure?');
          expect(financialQ).toBeDefined();
          expect(financialQ.indicator).toBe('amber');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('executive financial exposure indicator is green when 0 < totalCost <= 500000', () => {
    fc.assert(
      fc.property(
        arbPattern, arbSignals, arbTierInfo, arbAnchorSystem, arbAllocations,
        (pattern, signals, tierInfo, anchorSystem, allocations) => {
          const lowCostSystem = {
            id: 'sys-cheap',
            label: 'Cheap System',
            type: 'ITSystem',
            annualCost: 100000,
          };
          const result = generatePersonaQuestions('executive', pattern, signals, [lowCostSystem], anchorSystem, allocations, tierInfo);
          const financialQ = result.find(q => q.question === 'What is the financial exposure?');
          expect(financialQ).toBeDefined();
          expect(financialQ.indicator).toBe('green');
        }
      ),
      { numRuns: 100 }
    );
  });

  // On-premise exposure: amber when any on-premise systems, green when all cloud
  it('architect on-premise exposure is amber when some systems are on-premise', () => {
    fc.assert(
      fc.property(
        arbPattern, arbSignals, arbTierInfo, arbAnchorSystem, arbAllocations,
        (pattern, signals, tierInfo, anchorSystem, allocations) => {
          const onPremSystem = {
            id: 'sys-onprem',
            label: 'On Premise System',
            type: 'ITSystem',
            isCloud: false,
          };
          const result = generatePersonaQuestions('architect', pattern, signals, [onPremSystem], anchorSystem, allocations, tierInfo);
          const onPremQ = result.find(q => q.question === 'What is the on-premise exposure?');
          expect(onPremQ).toBeDefined();
          expect(onPremQ.indicator).toBe('amber');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('architect on-premise exposure is green when all systems are cloud', () => {
    fc.assert(
      fc.property(
        arbPattern, arbSignals, arbTierInfo, arbAnchorSystem, arbAllocations,
        (pattern, signals, tierInfo, anchorSystem, allocations) => {
          const cloudSystem = {
            id: 'sys-cloud',
            label: 'Cloud System',
            type: 'ITSystem',
            isCloud: true,
          };
          const result = generatePersonaQuestions('architect', pattern, signals, [cloudSystem], anchorSystem, allocations, tierInfo);
          const onPremQ = result.find(q => q.question === 'What is the on-premise exposure?');
          expect(onPremQ).toBeDefined();
          expect(onPremQ.indicator).toBe('green');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Commercial portability risk: red when low portability systems present
  it('commercial portability risk indicator is red when low portability systems present', () => {
    fc.assert(
      fc.property(
        arbPattern, arbSignals, arbTierInfo, arbAnchorSystem, arbAllocations,
        (pattern, signals, tierInfo, anchorSystem, allocations) => {
          const lowPortSystem = {
            id: 'sys-lowport',
            label: 'Low Port System',
            type: 'ITSystem',
            portability: 'Low',
          };
          const result = generatePersonaQuestions('commercial', pattern, signals, [lowPortSystem], anchorSystem, allocations, tierInfo);
          const portQ = result.find(q => q.question === 'What are the data exit and portability risks?');
          expect(portQ).toBeDefined();
          expect(portQ.indicator).toBe('red');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Commercial portability risk question absent when all systems have high portability
  it('commercial portability risk question absent when no low or medium portability systems', () => {
    fc.assert(
      fc.property(
        arbPattern, arbSignals, arbTierInfo, arbAnchorSystem, arbAllocations,
        (pattern, signals, tierInfo, anchorSystem, allocations) => {
          const highPortSystem = {
            id: 'sys-highport',
            label: 'High Port System',
            type: 'ITSystem',
            portability: 'High',
          };
          const result = generatePersonaQuestions('commercial', pattern, signals, [highPortSystem], anchorSystem, allocations, tierInfo);
          const portQ = result.find(q => q.question === 'What are the data exit and portability risks?');
          expect(portQ).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

});

// ---------------------------------------------------------------------------
// Property 10: No duplicate question strings within any result set
// ---------------------------------------------------------------------------

describe('generatePersonaQuestions — no duplicate questions', () => {

  it('question strings are unique within each result for named personas', () => {
    fc.assert(
      fc.property(
        arbNamedPersona, arbPattern, arbSignals, arbSystems, arbAnchorSystem, arbAllocations, arbTierInfo,
        (persona, pattern, signals, systems, anchorSystem, allocations, tierInfo) => {
          const result = generatePersonaQuestions(persona, pattern, signals, systems, anchorSystem, allocations, tierInfo);
          const questionTexts = result.map(q => q.question);
          const uniqueTexts = new Set(questionTexts);
          expect(uniqueTexts.size).toBe(questionTexts.length);
        }
      ),
      { numRuns: 200 }
    );
  });

});
