import fc from 'fast-check';
import { arbITSystem } from './arbITSystem.js';

/**
 * Arbitrary generator for a council with Function nodes, ITSystem nodes,
 * and REALIZES edges connecting them.
 *
 * @param {Object} opts
 * @param {string} opts.councilName - The council name to use
 * @param {string[]} [opts.successorNames] - Pool of successor names for targetAuthorities on systems
 */
export function arbCouncil({ councilName, successorNames = [] }) {
  // Generate 1–5 function nodes, each with a unique lgaFunctionId
  const arbFunctions = fc.integer({ min: 1, max: 5 }).chain(count => {
    return fc.uniqueArray(
      fc.integer({ min: 1, max: 176 }).map(String),
      { minLength: count, maxLength: count, comparator: (a, b) => a === b }
    ).map(ids =>
      ids.map(lgaId => ({
        id: `${councilName}-fn-${lgaId}`,
        label: `Function ${lgaId}`,
        type: 'Function',
        lgaFunctionId: lgaId,
        _sourceCouncil: councilName,
      }))
    );
  });

  return arbFunctions.chain(functions => {
    // Generate 1–4 IT systems per function (at least 1 per function)
    const systemCount = functions.length; // at least one system per function
    return fc.array(
      arbITSystem({ councilNames: [councilName], successorNames, prefix: councilName }),
      { minLength: systemCount, maxLength: systemCount + 3 }
    ).map(systems => {
      const nodes = [...functions, ...systems];

      // Create REALIZES edges: each system realizes at least one function.
      // Distribute systems round-robin across functions, ensuring every function
      // has at least one system.
      const edges = [];
      systems.forEach((sys, i) => {
        const fn = functions[i % functions.length];
        edges.push({
          source: sys.id,
          target: fn.id,
          relationship: 'REALIZES',
        });
      });

      return { councilName, nodes, edges };
    });
  });
}
