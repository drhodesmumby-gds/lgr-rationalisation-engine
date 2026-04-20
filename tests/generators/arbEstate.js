import fc from 'fast-check';

/**
 * Arbitrary generator for a complete estate scenario suitable for testing
 * computeEstateSummaryMetrics().
 *
 * Generates 2–4 councils, each with 1–3 functions and 1–3 systems,
 * a mergedArchitecture (nodes, edges, councils Set), an lgaFunctionMap,
 * an optional transition structure, and optionally runs buildSuccessorAllocation
 * to produce the successorAllocationMap.
 *
 * @param {Object} opts
 * @param {Function} opts.buildSuccessorAllocation - The engine's buildSuccessorAllocation function
 * @param {Function} opts.detectSharedServiceBoundary - The engine's detectSharedServiceBoundary function
 */
export function arbEstate({ buildSuccessorAllocation, detectSharedServiceBoundary } = {}) {
  return fc
    .record({
      councilCount: fc.integer({ min: 2, max: 4 }),
      hasTransition: fc.boolean(),
      vestingDate: fc.constantFrom('2027-04-01', '2028-04-01', '2029-04-01'),
    })
    .chain(({ councilCount, hasTransition, vestingDate }) => {
      const councilNames = Array.from({ length: councilCount }, (_, i) =>
        `Council-${String.fromCharCode(65 + i)}`
      );

      // Generate 1–3 function IDs per council (drawn from a shared pool for collisions)
      const functionPool = Array.from({ length: 10 }, (_, i) => String(i + 1));

      const arbCouncilData = fc.tuple(
        ...councilNames.map(cName =>
          fc.tuple(
            // 1–3 function IDs for this council
            fc.uniqueArray(fc.constantFrom(...functionPool), {
              minLength: 1,
              maxLength: 3,
              comparator: (a, b) => a === b,
            }),
            // 1–3 systems
            fc.integer({ min: 1, max: 3 })
          ).chain(([funcIds, sysCount]) =>
            fc.tuple(
              ...Array.from({ length: sysCount }, (_, sIdx) =>
                fc.record({
                  annualCost: fc.option(fc.integer({ min: 1000, max: 500000 }), { nil: undefined }),
                  endYear: fc.option(fc.integer({ min: 2025, max: 2035 }), { nil: undefined }),
                  endMonth: fc.option(fc.integer({ min: 1, max: 12 }), { nil: undefined }),
                  noticePeriod: fc.option(fc.integer({ min: 0, max: 24 }), { nil: undefined }),
                  dataPartitioning: fc.option(fc.constantFrom('Segmented', 'Monolithic'), { nil: undefined }),
                  sharedWith: fc.option(
                    fc.subarray(
                      councilNames.filter(n => n !== cName),
                      { minLength: 1, maxLength: Math.min(councilNames.length - 1, 2) }
                    ),
                    { nil: undefined }
                  ),
                }).map(fields => {
                  const sys = {
                    id: `${cName}-sys-${sIdx}`,
                    label: `${cName} System ${sIdx}`,
                    type: 'ITSystem',
                    _sourceCouncil: cName,
                  };
                  // Attach optional fields (strip undefined)
                  for (const [k, v] of Object.entries(fields)) {
                    if (v !== undefined) sys[k] = v;
                  }
                  return sys;
                })
              )
            ).map(systems => ({
              councilName: cName,
              funcIds,
              systems,
            }))
          )
        )
      );

      return arbCouncilData.chain(councilDataArr => {
        // Optionally generate a transition structure
        if (!hasTransition) {
          return fc.constant({ councilDataArr, transitionStructure: null });
        }

        // Generate 2–3 successors
        const successorCount = Math.min(councilCount, 3);
        const successorNames = Array.from({ length: successorCount }, (_, i) =>
          `Successor-${i + 1}`
        );

        // Assign councils as full or partial predecessors
        return fc.tuple(
          ...councilNames.map(() => fc.constantFrom('full', 'partial'))
        ).map(assignments => {
          const successors = successorNames.map(name => ({
            name,
            fullPredecessors: [],
            partialPredecessors: [],
          }));

          assignments.forEach((type, idx) => {
            const council = councilNames[idx];
            if (type === 'full') {
              successors[idx % successors.length].fullPredecessors.push(council);
            } else {
              // Partial: add to all successors
              successors.forEach(s => s.partialPredecessors.push(council));
            }
          });

          return {
            councilDataArr,
            transitionStructure: { vestingDate, successors },
          };
        });
      });
    })
    .map(({ councilDataArr, transitionStructure }) => {
      // Build mergedArchitecture
      const nodes = [];
      const edges = [];
      const councils = new Set();
      const lgaFunctionMap = new Map();

      councilDataArr.forEach(({ councilName, funcIds, systems }) => {
        councils.add(councilName);

        // Create function nodes
        funcIds.forEach(fId => {
          const fnNodeId = `${councilName}-fn-${fId}`;
          nodes.push({
            id: fnNodeId,
            label: `Function ${fId}`,
            type: 'Function',
            lgaFunctionId: fId,
            _sourceCouncil: councilName,
          });

          // Update lgaFunctionMap
          if (!lgaFunctionMap.has(fId)) {
            lgaFunctionMap.set(fId, {
              lgaId: fId,
              label: `Function ${fId}`,
              councils: new Set(),
              localNodeIds: new Set(),
            });
          }
          lgaFunctionMap.get(fId).councils.add(councilName);
          lgaFunctionMap.get(fId).localNodeIds.add(fnNodeId);
        });

        // Create system nodes and REALIZES edges
        systems.forEach((sys, sIdx) => {
          nodes.push(sys);
          // Each system realizes at least one function from this council
          const targetFuncId = funcIds[sIdx % funcIds.length];
          const targetFnNodeId = `${councilName}-fn-${targetFuncId}`;
          edges.push({
            source: sys.id,
            target: targetFnNodeId,
            relationship: 'REALIZES',
          });
        });
      });

      const mergedArchitecture = { nodes, edges, councils };

      // Build successorAllocationMap if transition structure exists
      let successorAllocationMap = null;
      if (transitionStructure && buildSuccessorAllocation) {
        const result = buildSuccessorAllocation(nodes, edges, transitionStructure);
        successorAllocationMap = result.allocation;
      }

      return {
        mergedArchitecture,
        lgaFunctionMap,
        transitionStructure,
        successorAllocationMap,
      };
    });
}
