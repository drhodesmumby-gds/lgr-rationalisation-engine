import fc from 'fast-check';

/**
 * Arbitrary generator for ITSystem nodes.
 *
 * Generates a random ITSystem with a unique id, a required _sourceCouncil,
 * and optional fields matching the extended schema.
 *
 * @param {Object} opts
 * @param {string[]} opts.councilNames - Pool of council names to draw _sourceCouncil from
 * @param {string[]} [opts.successorNames] - Pool of successor names for targetAuthorities
 * @param {string}  [opts.prefix] - ID prefix for uniqueness across generators
 */
export function arbITSystem({ councilNames, successorNames = [], prefix = 'sys' } = { councilNames: ['Council A'] }) {
  return fc.record({
    id: fc.uuid().map(u => `${prefix}-${u}`),
    label: fc.stringMatching(/^[A-Za-z ]{3,30}$/),
    type: fc.constant('ITSystem'),
    _sourceCouncil: fc.constantFrom(...councilNames),

    // Optional fields
    vendor: fc.option(fc.stringMatching(/^[A-Za-z ]{2,20}$/), { nil: undefined }),
    users: fc.option(fc.integer({ min: 1, max: 50000 }), { nil: undefined }),
    annualCost: fc.option(fc.integer({ min: 1000, max: 5000000 }), { nil: undefined }),
    endYear: fc.option(fc.integer({ min: 2024, max: 2035 }), { nil: undefined }),
    endMonth: fc.option(fc.integer({ min: 1, max: 12 }), { nil: undefined }),
    noticePeriod: fc.option(fc.integer({ min: 0, max: 24 }), { nil: undefined }),
    portability: fc.option(fc.constantFrom('High', 'Medium', 'Low'), { nil: undefined }),
    dataPartitioning: fc.option(fc.constantFrom('Segmented', 'Monolithic'), { nil: undefined }),
    isCloud: fc.option(fc.boolean(), { nil: undefined }),
    isERP: fc.option(fc.boolean(), { nil: undefined }),
    owner: fc.option(fc.constantFrom(...councilNames), { nil: undefined }),
    sharedWith: fc.option(
      fc.subarray(councilNames, { minLength: 0, maxLength: Math.min(councilNames.length, 3) }),
      { nil: undefined }
    ),
    targetAuthorities: successorNames.length > 0
      ? fc.option(
          fc.subarray(successorNames, { minLength: 1, maxLength: Math.min(successorNames.length, 3) }),
          { nil: undefined }
        )
      : fc.constant(undefined),
  }).map(rec => {
    // Strip undefined values so they behave like absent fields
    const cleaned = {};
    for (const [k, v] of Object.entries(rec)) {
      if (v !== undefined) cleaned[k] = v;
    }
    return cleaned;
  });
}
