/**
 * Dependency Matrix — estate-wide read-only heatmap showing
 * which systems consume capabilities from which providers.
 */

/**
 * Render the full dependency matrix view.
 * @param {object} editorState — { nodes, edges }
 * @returns {string} HTML string
 */
export function renderDepMatrix(editorState) {
  const { nodes, edges } = editorState;

  const capEdges = edges.filter(e => e.relationship === 'CONSUMES_CAPABILITY');

  if (capEdges.length === 0) {
    return `
      <div class="p-6">
        <div class="flex items-center gap-4 mb-4">
          <button data-dep-back class="text-blue-600 hover:underline text-sm font-medium">&larr; Back to editor</button>
          <h2 class="text-xl font-bold">Dependency Matrix</h2>
        </div>
        <p class="text-gray-500 mt-6">No capability dependencies defined. Add capabilities to systems in the editor to see the dependency matrix.</p>
      </div>`;
  }

  // Build provider list: systems with non-empty capabilityType
  const providers = nodes
    .map((n, idx) => ({ node: n, idx }))
    .filter(({ node }) => node.type === 'ITSystem' && Array.isArray(node.capabilityType) && node.capabilityType.length > 0);

  // Build consumer list: systems that are source in at least one CONSUMES_CAPABILITY edge
  const consumerIds = new Set(capEdges.map(e => e.source));
  const consumers = nodes
    .map((n, idx) => ({ node: n, idx }))
    .filter(({ node }) => consumerIds.has(node.id));

  // Build lookup: consumer id + provider id → capabilities array
  const cellLookup = new Map();
  for (const edge of capEdges) {
    const key = `${edge.source}::${edge.target}`;
    if (!cellLookup.has(key)) {
      cellLookup.set(key, []);
    }
    const caps = Array.isArray(edge.capabilities) ? edge.capabilities : [];
    cellLookup.set(key, cellLookup.get(key).concat(caps));
  }

  // Render header row
  const headerCells = providers.map(({ node }) => {
    const label = escLabel(node.label || node.id);
    return `<th class="text-xs font-medium text-gray-700 px-2 py-1 align-bottom" style="height:100px; min-width:60px;">
      <div style="transform:rotate(-45deg); transform-origin:left bottom; white-space:nowrap;">${label}</div>
    </th>`;
  }).join('');

  // Render body rows
  const bodyRows = consumers.map(({ node: consumer, idx: consumerIdx }, rowIndex) => {
    const rowBg = rowIndex % 2 === 0 ? '' : 'bg-gray-50';
    const cells = providers.map(({ node: provider }) => {
      const key = `${consumer.id}::${provider.id}`;
      const caps = cellLookup.get(key);
      if (!caps || caps.length === 0) {
        return `<td class="text-xs text-gray-300 text-center px-2 py-1 border border-gray-100">&mdash;</td>`;
      }
      const count = caps.length;
      const bgClass = count >= 3 ? 'bg-blue-300' : count === 2 ? 'bg-blue-200' : 'bg-blue-100';
      const capText = escLabel(caps.join(', '));
      return `<td class="${bgClass} text-xs px-2 py-1 border border-gray-100">
        <div>${capText}</div>
        <a href="#" data-dep-jump="${consumerIdx}" class="text-xs text-blue-600 hover:underline">Edit</a>
      </td>`;
    }).join('');

    const label = escLabel(consumer.label || consumer.id);
    return `<tr class="${rowBg}">
      <th class="text-xs font-medium text-gray-700 px-2 py-1 text-left sticky left-0 bg-white border border-gray-100 whitespace-nowrap">${label}</th>
      ${cells}
    </tr>`;
  }).join('');

  return `
    <div class="p-6">
      <div class="flex items-center gap-4 mb-1">
        <button data-dep-back class="text-blue-600 hover:underline text-sm font-medium">&larr; Back to editor</button>
        <h2 class="text-xl font-bold">Dependency Matrix</h2>
      </div>
      <p class="text-gray-500 text-sm mb-4">Shows which systems consume capabilities from which providers</p>
      <div class="overflow-auto border border-gray-200 rounded">
        <table class="border-collapse w-full">
          <thead>
            <tr>
              <th class="sticky left-0 bg-white px-2 py-1 border border-gray-100"></th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
          </tbody>
        </table>
      </div>
    </div>`;
}

/**
 * Wire events on the rendered dependency matrix.
 * @param {HTMLElement} container
 * @param {object} options — { onBack(), onJumpToSystem(nodeIdx) }
 */
export function wireDepMatrix(container, options) {
  const { onBack, onJumpToSystem } = options;

  const backBtn = container.querySelector('[data-dep-back]');
  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      onBack();
    });
  }

  container.querySelectorAll('[data-dep-jump]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const idx = parseInt(link.getAttribute('data-dep-jump'), 10);
      if (!isNaN(idx)) {
        onJumpToSystem(idx);
      }
    });
  });
}

/** Minimal HTML escaping for labels */
function escLabel(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
