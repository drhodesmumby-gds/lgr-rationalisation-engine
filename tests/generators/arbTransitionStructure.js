import fc from 'fast-check';

/**
 * Arbitrary generator for a transition structure.
 *
 * Generates a vesting date and 2–4 successor authorities whose full and
 * partial predecessors are drawn from the provided council name set.
 *
 * @param {string[]} councilNames - The pool of council names to assign as predecessors
 */
export function arbTransitionStructure(councilNames) {
  if (!councilNames || councilNames.length === 0) {
    throw new Error('arbTransitionStructure requires at least one council name');
  }

  const arbVestingDate = fc.date({
    min: new Date('2026-01-01'),
    max: new Date('2030-12-31'),
  }).map(d => d.toISOString().slice(0, 10));

  // Generate 2–4 successor names
  const arbSuccessorNames = fc.uniqueArray(
    fc.stringMatching(/^[A-Z][a-z]{3,10} (UA|BC|DC)$/),
    { minLength: 2, maxLength: Math.min(4, councilNames.length + 2), comparator: (a, b) => a === b }
  );

  return fc.tuple(arbVestingDate, arbSuccessorNames).chain(([vestingDate, successorNames]) => {
    // For each successor, assign some councils as full and some as partial predecessors.
    // Constraint: a council can be a full predecessor of at most one successor,
    // but can be a partial predecessor of multiple successors.
    const arbSuccessors = fc.tuple(
      // Decide which councils are "full" (assigned to exactly one successor)
      fc.shuffledSubarray(councilNames, { minLength: 0, maxLength: councilNames.length }),
      // Decide which councils are "partial" (can appear in multiple successors)
      fc.subarray(councilNames, { minLength: 0, maxLength: councilNames.length })
    ).map(([fullPool, partialPool]) => {
      const successors = successorNames.map((name, idx) => ({
        name,
        fullPredecessors: [],
        partialPredecessors: [],
      }));

      // Distribute full predecessors: each goes to exactly one successor
      fullPool.forEach((council, i) => {
        // Don't assign a council as full if it's also in the partial pool
        if (!partialPool.includes(council)) {
          successors[i % successors.length].fullPredecessors.push(council);
        }
      });

      // Distribute partial predecessors: each goes to 1+ successors
      partialPool.forEach(council => {
        // Add to at least 1 successor, up to all successors
        const startIdx = council.length % successors.length;
        // Add to at least 2 successors when possible (to test disaggregation)
        const count = Math.min(successors.length, 2 + (council.length % (successors.length - 1 || 1)));
        for (let i = 0; i < count; i++) {
          const sIdx = (startIdx + i) % successors.length;
          if (!successors[sIdx].partialPredecessors.includes(council)) {
            successors[sIdx].partialPredecessors.push(council);
          }
        }
      });

      return successors;
    });

    return arbSuccessors.map(successors => ({
      vestingDate,
      successors,
    }));
  });
}
