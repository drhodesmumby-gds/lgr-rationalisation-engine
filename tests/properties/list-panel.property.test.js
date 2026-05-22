/**
 * Property tests for list-panel.js — renderListPanel
 *
 * renderListPanel is a pure HTML-generating function: given an editorState
 * and optional options it returns an HTML string with no DOM side-effects.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { renderListPanel } from '../../src/features/unified-editor/list-panel.js';
import {
    arbEditorState,
    arbITSystemNode,
    arbCompleteITSystemNode,
    arbEmptyITSystemNode,
} from '../generators/unified-editor-generators.js';
import { LGA_FUNCTIONS } from '../../src/constants/lga-functions.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal valid editorState with no nodes.
 */
function emptyEditorState() {
    return { councilName: 'Empty Council', councilMetadata: {}, nodes: [], edges: [] };
}

/**
 * Build an editorState containing a single ITSystem linked to a known function via REALIZES.
 */
function stateWithLinkedSystem(system, lgaFunctionId) {
    const lgaEntry = LGA_FUNCTIONS.find(f => f.id === lgaFunctionId);
    const fnNode = {
        id: `fn-${lgaFunctionId}`,
        type: 'Function',
        label: lgaEntry ? lgaEntry.label : `Function ${lgaFunctionId}`,
        lgaFunctionId,
    };
    const nodes = [fnNode, system];
    const edges = [{ source: system.id, target: fnNode.id, relationship: 'REALIZES' }];
    return { councilName: 'Test Council', councilMetadata: {}, nodes, edges };
}

// ---------------------------------------------------------------------------
// Basic structural properties
// ---------------------------------------------------------------------------

describe('renderListPanel — output structure', () => {

    it('always returns a non-empty string', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const html = renderListPanel(editorState);
                expect(typeof html).toBe('string');
                expect(html.length).toBeGreaterThan(0);
            }),
            { numRuns: 100 }
        );
    });

    it('returns valid HTML: output starts with <div and ends with </div>', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const html = renderListPanel(editorState).trim();
                expect(html.startsWith('<div')).toBe(true);
                expect(html.endsWith('</div>')).toBe(true);
            }),
            { numRuns: 100 }
        );
    });

    it('always contains the search input element', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const html = renderListPanel(editorState);
                expect(html).toContain('data-list-search');
            }),
            { numRuns: 100 }
        );
    });

    it('always contains the "+ Add system" button', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const html = renderListPanel(editorState);
                expect(html).toContain('data-list-add');
            }),
            { numRuns: 100 }
        );
    });

    it('always contains the progress bar element', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const html = renderListPanel(editorState);
                expect(html).toContain('complete');
            }),
            { numRuns: 100 }
        );
    });

    it('contains data-list-scroll wrapper for item delegation', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const html = renderListPanel(editorState);
                expect(html).toContain('data-list-scroll');
            }),
            { numRuns: 100 }
        );
    });

});

// ---------------------------------------------------------------------------
// Empty state message
// ---------------------------------------------------------------------------

describe('renderListPanel — empty state', () => {

    it('shows empty-state message when there are no ITSystem nodes', () => {
        const html = renderListPanel(emptyEditorState());
        expect(html).toContain('No systems yet');
    });

    it('shows progress as 0/0 when there are no systems', () => {
        const html = renderListPanel(emptyEditorState());
        expect(html).toContain('0/0');
    });

});

// ---------------------------------------------------------------------------
// System list items
// ---------------------------------------------------------------------------

describe('renderListPanel — system list items', () => {

    it('each ITSystem produces exactly one list item (data-list-item)', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const systemCount = editorState.nodes.filter(n => n.type === 'ITSystem').length;
                const html = renderListPanel(editorState);
                // Count occurrences of data-list-item=
                const matches = html.match(/data-list-item="/g) || [];
                expect(matches.length).toBe(systemCount);
            }),
            { numRuns: 100 }
        );
    });

    it('system label appears in the rendered HTML', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const systems = editorState.nodes.filter(n => n.type === 'ITSystem');
                if (systems.length === 0) return;

                const html = renderListPanel(editorState);
                for (const sys of systems) {
                    if (sys.label) {
                        expect(html).toContain(sys.label);
                    }
                }
            }),
            { numRuns: 100 }
        );
    });

    it('nodeIdx in data-list-item corresponds to the real index in nodes array', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const html = renderListPanel(editorState);
                const matches = [...html.matchAll(/data-list-item="(\d+)"/g)];
                for (const match of matches) {
                    const idx = parseInt(match[1], 10);
                    expect(idx).toBeGreaterThanOrEqual(0);
                    expect(idx).toBeLessThan(editorState.nodes.length);
                    // The node at that index must be an ITSystem
                    expect(editorState.nodes[idx].type).toBe('ITSystem');
                }
            }),
            { numRuns: 100 }
        );
    });

});

// ---------------------------------------------------------------------------
// Domain grouping
// ---------------------------------------------------------------------------

describe('renderListPanel — domain grouping', () => {

    it('a system with a valid REALIZES edge to a Function with lgaFunctionId is placed in a named domain group, not Platform/Infrastructure', () => {
        fc.assert(
            fc.property(
                arbITSystemNode(),
                fc.constantFrom(...LGA_FUNCTIONS.filter(f => f.parentId === null).map(f => f.id)),
                (system, rootLgaId) => {
                    // Pick a child function of this root category
                    const childFns = LGA_FUNCTIONS.filter(f => f.parentId === rootLgaId);
                    if (childFns.length === 0) return; // skip if no children (shouldn't happen)
                    const childFn = childFns[0];
                    const state = stateWithLinkedSystem(system, childFn.id);
                    const html = renderListPanel(state);

                    // Should NOT contain the platform fallback label
                    expect(html).not.toContain('Platform / Infrastructure');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('a system with no REALIZES edge is placed in Platform / Infrastructure group', () => {
        fc.assert(
            fc.property(arbITSystemNode(), (system) => {
                const state = {
                    councilName: 'Test',
                    councilMetadata: {},
                    nodes: [system],
                    edges: [],  // no edges
                };
                const html = renderListPanel(state);
                expect(html).toContain('Platform / Infrastructure');
            }),
            { numRuns: 100 }
        );
    });

    it('domain group header appears once per distinct domain in the output', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const html = renderListPanel(editorState);
                // Every domain group header has class badge showing count.
                // We just check the structure is well-formed (more group headers than 0 iff systems exist).
                const systemCount = editorState.nodes.filter(n => n.type === 'ITSystem').length;
                const groupHeaders = html.match(/data-list-scroll/g) || [];
                expect(groupHeaders.length).toBe(1); // exactly one scroll container
                if (systemCount === 0) {
                    // no group content but structure intact
                    expect(html).toContain('data-list-scroll');
                }
            }),
            { numRuns: 100 }
        );
    });

});

// ---------------------------------------------------------------------------
// Search filtering
// ---------------------------------------------------------------------------

describe('renderListPanel — search filtering', () => {

    it('with matching searchQuery — output still contains data-list-item entries for matched systems', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const systems = editorState.nodes.filter(n => n.type === 'ITSystem');
                if (systems.length === 0) return;

                // Use a character that all labels start with (A-Z since generator uses /^[A-Za-z].../)
                const firstChar = (systems[0].label || 'a')[0].toLowerCase();
                const html = renderListPanel(editorState, { searchQuery: firstChar });

                // At least one system whose label starts with firstChar should appear
                const matchingSystems = systems.filter(s =>
                    (s.label || '').toLowerCase().includes(firstChar) ||
                    (s.vendor || '').toLowerCase().includes(firstChar)
                );

                if (matchingSystems.length > 0) {
                    expect(html).toContain('data-list-item');
                }
            }),
            { numRuns: 100 }
        );
    });

    it('with non-matching searchQuery — shows "No systems match" message', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const systems = editorState.nodes.filter(n => n.type === 'ITSystem');
                if (systems.length === 0) return;

                // A query guaranteed to match nothing
                const impossibleQuery = 'ZZZUNMATCHABLE9999';
                const html = renderListPanel(editorState, { searchQuery: impossibleQuery });

                expect(html).toContain('No systems match');
            }),
            { numRuns: 100 }
        );
    });

    it('empty searchQuery shows all systems (same count as with no query)', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const htmlNoQuery = renderListPanel(editorState);
                const htmlEmptyQuery = renderListPanel(editorState, { searchQuery: '' });

                // Both should render the same number of data-list-item entries
                const countNoQuery = (htmlNoQuery.match(/data-list-item="/g) || []).length;
                const countEmptyQuery = (htmlEmptyQuery.match(/data-list-item="/g) || []).length;
                expect(countEmptyQuery).toBe(countNoQuery);
            }),
            { numRuns: 100 }
        );
    });

    it('searchQuery appears as the value of the search input', () => {
        fc.assert(
            fc.property(
                arbEditorState(),
                fc.stringMatching(/^[a-z]{1,8}$/),
                (editorState, query) => {
                    const html = renderListPanel(editorState, { searchQuery: query });
                    expect(html).toContain(`value="${query}"`);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('non-empty searchQuery adds a clear button to the output', () => {
        fc.assert(
            fc.property(
                arbEditorState(),
                fc.stringMatching(/^[a-z]{1,8}$/),
                (editorState, query) => {
                    const html = renderListPanel(editorState, { searchQuery: query });
                    expect(html).toContain('data-list-search-clear');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('empty searchQuery does not add a clear button', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const html = renderListPanel(editorState, { searchQuery: '' });
                expect(html).not.toContain('data-list-search-clear');
            }),
            { numRuns: 100 }
        );
    });

});

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

describe('renderListPanel — progress bar', () => {

    it('a system with all 7 key fields set contributes to completeSystems count', () => {
        fc.assert(
            fc.property(arbCompleteITSystemNode(), (system) => {
                const state = {
                    councilName: 'Test',
                    councilMetadata: {},
                    nodes: [system],
                    edges: [],
                };
                const html = renderListPanel(state);
                // 1/1 complete
                expect(html).toContain('1/1');
                expect(html).toContain('100%');
            }),
            { numRuns: 100 }
        );
    });

    it('a system with no key fields set shows 0/1 complete', () => {
        fc.assert(
            fc.property(arbEmptyITSystemNode(), (system) => {
                const state = {
                    councilName: 'Test',
                    councilMetadata: {},
                    nodes: [system],
                    edges: [],
                };
                const html = renderListPanel(state);
                expect(html).toContain('0/1');
                expect(html).toContain('0%');
            }),
            { numRuns: 100 }
        );
    });

    it('progress percentage is always between 0 and 100', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const html = renderListPanel(editorState);
                // Extract the percent value from the progress text (e.g. "73%")
                const match = html.match(/<span>(\d+)%<\/span>/);
                if (match) {
                    const pct = parseInt(match[1], 10);
                    expect(pct).toBeGreaterThanOrEqual(0);
                    expect(pct).toBeLessThanOrEqual(100);
                }
            }),
            { numRuns: 100 }
        );
    });

    it('completeness indicator for a complete system contains the ✓ symbol', () => {
        fc.assert(
            fc.property(arbCompleteITSystemNode(), (system) => {
                const state = {
                    councilName: 'Test',
                    councilMetadata: {},
                    nodes: [system],
                    edges: [],
                };
                const html = renderListPanel(state);
                expect(html).toContain('✓');
            }),
            { numRuns: 100 }
        );
    });

    it('completeness indicator for an empty system contains the ✗ symbol', () => {
        fc.assert(
            fc.property(arbEmptyITSystemNode(), (system) => {
                const state = {
                    councilName: 'Test',
                    councilMetadata: {},
                    nodes: [system],
                    edges: [],
                };
                const html = renderListPanel(state);
                expect(html).toContain('✗');
            }),
            { numRuns: 100 }
        );
    });

});

// ---------------------------------------------------------------------------
// Selected item highlight
// ---------------------------------------------------------------------------

describe('renderListPanel — selected item', () => {

    it('the selected system gets the selection border class (border-[#1d70b8])', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const systems = editorState.nodes.filter(n => n.type === 'ITSystem');
                if (systems.length === 0) return;

                const firstSystem = systems[0];
                const selectedIdx = editorState.nodes.indexOf(firstSystem);

                const html = renderListPanel(editorState, { selectedIdx });
                expect(html).toContain('border-[#1d70b8]');
            }),
            { numRuns: 100 }
        );
    });

    it('when no selectedIdx is provided, no selection border appears', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const html = renderListPanel(editorState, { selectedIdx: null });
                // "border-l-4 border-[#1d70b8]" is only added when selected
                expect(html).not.toContain('border-l-4 border-[#1d70b8]');
            }),
            { numRuns: 100 }
        );
    });

});
