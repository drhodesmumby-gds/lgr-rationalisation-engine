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
          <button data-dep-back class="text-[#1d70b8] hover:text-[#003078] underline font-bold text-sm">&larr; Back to editor</button>
          <h2 class="text-xl font-bold text-[#0b0c0c]">Dependency Matrix</h2>
        </div>
        <p class="text-[#505a5f] mt-6">No capability dependencies defined. Add capabilities to systems in the editor to see the dependency matrix.</p>
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
    return `<th class="bg-[#f3f2f1] text-[#0b0c0c] font-bold text-xs p-2 border-b-2 border-[#0b0c0c] text-left" style="min-width:100px; max-width:120px; word-wrap:break-word;">
      ${label}
    </th>`;
  }).join('');

  // Render body rows
  const bodyRows = consumers.map(({ node: consumer, idx: consumerIdx }, rowIndex) => {
    const rowBg = rowIndex % 2 === 0 ? '' : 'bg-[#f3f2f1]';
    const cells = providers.map(({ node: provider }) => {
      const key = `${consumer.id}::${provider.id}`;
      const caps = cellLookup.get(key);
      if (!caps || caps.length === 0) {
        return `<td class="text-[#b1b4b6] text-center text-xs p-2 border-b border-[#b1b4b6]">&mdash;</td>`;
      }
      const count = caps.length;
      const bgClass = count >= 3 ? 'bg-[#7fb3d9]' : count === 2 ? 'bg-[#a8cce8]' : 'bg-[#d4e5f7]';
      const capText = escLabel(caps.join(', '));
      return `<td class="${bgClass} text-[#0b0c0c] text-xs p-2 border-b border-[#b1b4b6]">
        <div>${capText}</div>
        <a href="#" data-dep-jump="${consumerIdx}" class="text-[#1d70b8] hover:text-[#003078] underline text-xs">Edit</a>
      </td>`;
    }).join('');

    const label = escLabel(consumer.label || consumer.id);
    return `<tr class="${rowBg}">
      <th class="bg-white font-bold text-sm text-[#0b0c0c] border-b border-[#b1b4b6] p-2 text-left sticky left-0 whitespace-nowrap">${label}</th>
      ${cells}
    </tr>`;
  }).join('');

  return `
    <div class="p-6">
      <div class="flex items-center gap-4 mb-1">
        <button data-dep-back class="text-[#1d70b8] hover:text-[#003078] underline font-bold text-sm">&larr; Back to editor</button>
        <h2 class="text-xl font-bold text-[#0b0c0c]">Dependency Matrix</h2>
      </div>
      <p class="text-[#505a5f] text-sm mb-4">Shows which systems consume capabilities from which providers</p>
      <div class="overflow-auto border border-[#b1b4b6]">
        <table class="border-collapse w-full">
          <thead>
            <tr>
              <th class="sticky left-0 bg-[#f3f2f1] p-2 border-b-2 border-[#0b0c0c]"></th>
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
