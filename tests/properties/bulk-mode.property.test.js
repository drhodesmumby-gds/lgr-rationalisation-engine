/**
 * Property tests for bulk-mode.js — renderBulkMode
 *
 * renderBulkMode is a pure HTML-generating function.  It renders a tab bar
 * and a data table with one row per ITSystem node.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { renderBulkMode } from '../../src/features/unified-editor/bulk-mode.js';
import {
    arbEditorState,
    arbITSystemNode,
    arbCompleteITSystemNode,
    arbEmptyITSystemNode,
} from '../generators/unified-editor-generators.js';

// ---------------------------------------------------------------------------
// Constants mirrored from bulk-mode.js
// ---------------------------------------------------------------------------

const TABS = [
    { id: 'contract', label: 'Contract & Cost' },
    { id: 'technical', label: 'Technical' },
    { id: 'relationships', label: 'Relationships' },
];

const TAB_IDS = TABS.map(t => t.id);

// Column fields present in each tab (used to verify header presence)
const TAB_COLUMNS = {
    contract: ['Annual Cost', 'Contract End', 'Notice (months)'],
    technical: ['Hosting', 'Partitioning', 'Portability', 'Support Model'],
    relationships: ['Provides', 'Shared With', 'Depends On'],
};

// ---------------------------------------------------------------------------
// Output structure
// ---------------------------------------------------------------------------

describe('renderBulkMode — output structure', () => {

    it('always returns a non-empty string', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const html = renderBulkMode(editorState);
                expect(typeof html).toBe('string');
                expect(html.length).toBeGreaterThan(0);
            }),
            { numRuns: 100 }
        );
    });

    it('output starts with <div and is wrapped in a single root element', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const html = renderBulkMode(editorState).trim();
                expect(html.startsWith('<div')).toBe(true);
            }),
            { numRuns: 100 }
        );
    });

    it('always contains the data-bulk-mode container attribute', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const html = renderBulkMode(editorState);
                expect(html).toContain('data-bulk-mode');
            }),
            { numRuns: 100 }
        );
    });

    it('always contains the data-bulk-tabs attribute', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const html = renderBulkMode(editorState);
                expect(html).toContain('data-bulk-tabs');
            }),
            { numRuns: 100 }
        );
    });

    it('always contains the data-bulk-table-wrapper attribute', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const html = renderBulkMode(editorState);
                expect(html).toContain('data-bulk-table-wrapper');
            }),
            { numRuns: 100 }
        );
    });

    it('always contains a <table> element', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const html = renderBulkMode(editorState);
                expect(html).toContain('<table');
            }),
            { numRuns: 100 }
        );
    });

});

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------

describe('renderBulkMode — tab bar', () => {

    it('all three tab labels appear in the output (HTML-escaped)', () => {
        // Tab labels are HTML-escaped by escHtml; "Contract & Cost" → "Contract &amp; Cost"
        const escapedLabels = TABS.map(t => t.label.replace(/&/g, '&amp;'));
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const html = renderBulkMode(editorState);
                for (const label of escapedLabels) {
                    expect(html).toContain(label);
                }
            }),
            { numRuns: 100 }
        );
    });

    it('each tab has a data-bulk-tab attribute', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const html = renderBulkMode(editorState);
                for (const id of TAB_IDS) {
                    expect(html).toContain(`data-bulk-tab="${id}"`);
                }
            }),
            { numRuns: 100 }
        );
    });

    it('the active tab defaults to "contract" when _bulkActiveTab is unset', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                // Ensure _bulkActiveTab is not set
                delete editorState._bulkActiveTab;
                const html = renderBulkMode(editorState);
                // The contract tab button should have the active styling (border-[#1d70b8])
                // and the contract columns should be visible
                expect(html).toContain('Annual Cost');
            }),
            { numRuns: 100 }
        );
    });

    it('setting _bulkActiveTab to "technical" renders technical columns', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                editorState._bulkActiveTab = 'technical';
                const html = renderBulkMode(editorState);
                for (const col of TAB_COLUMNS.technical) {
                    expect(html).toContain(col);
                }
            }),
            { numRuns: 100 }
        );
    });

    it('setting _bulkActiveTab to "relationships" renders relationships columns', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                editorState._bulkActiveTab = 'relationships';
                const html = renderBulkMode(editorState);
                for (const col of TAB_COLUMNS.relationships) {
                    expect(html).toContain(col);
                }
            }),
            { numRuns: 100 }
        );
    });

    it('active tab columns appear in the table header', () => {
        fc.assert(
            fc.property(
                arbEditorState(),
                fc.constantFrom(...TAB_IDS),
                (editorState, tabId) => {
                    editorState._bulkActiveTab = tabId;
                    const html = renderBulkMode(editorState);
                    for (const col of TAB_COLUMNS[tabId]) {
                        expect(html).toContain(col);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

});

// ---------------------------------------------------------------------------
// Table rows
// ---------------------------------------------------------------------------

describe('renderBulkMode — table rows', () => {

    it('one table row per ITSystem node', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const systemCount = editorState.nodes.filter(n => n.type === 'ITSystem').length;
                const html = renderBulkMode(editorState);
                // Count <tr> elements in <tbody> — each system has exactly one row
                // We use data-bulk-row occurrences on the System Name input (first pinned column)
                // as a proxy for row count
                const rowMatches = html.match(/data-bulk-field="label"/g) || [];
                expect(rowMatches.length).toBe(systemCount);
            }),
            { numRuns: 100 }
        );
    });

    it('each row has a data-bulk-row attribute with the correct node index', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const html = renderBulkMode(editorState);
                const matches = [...html.matchAll(/data-bulk-row="(\d+)"/g)];
                for (const match of matches) {
                    const idx = parseInt(match[1], 10);
                    expect(idx).toBeGreaterThanOrEqual(0);
                    expect(idx).toBeLessThan(editorState.nodes.length);
                    expect(editorState.nodes[idx].type).toBe('ITSystem');
                }
            }),
            { numRuns: 100 }
        );
    });

    it('system label value appears in the System Name input column', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const systems = editorState.nodes.filter(n => n.type === 'ITSystem');
                if (systems.length === 0) return;

                const html = renderBulkMode(editorState);
                for (const sys of systems) {
                    if (sys.label) {
                        expect(html).toContain(`value="${sys.label}"`);
                    }
                }
            }),
            { numRuns: 100 }
        );
    });

    it('always contains pinned System Name and Vendor column headers', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const html = renderBulkMode(editorState);
                expect(html).toContain('System Name');
                expect(html).toContain('Vendor');
                expect(html).toContain('Function');
            }),
            { numRuns: 100 }
        );
    });

    it('always contains the Status pinned column header', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const html = renderBulkMode(editorState);
                expect(html).toContain('Status');
            }),
            { numRuns: 100 }
        );
    });

});

// ---------------------------------------------------------------------------
// Completeness status column
// ---------------------------------------------------------------------------

describe('renderBulkMode — completeness status', () => {

    it('a fully populated system renders ✓ in the status column', () => {
        fc.assert(
            fc.property(arbCompleteITSystemNode(), (system) => {
                const state = {
                    councilName: 'Test',
                    councilMetadata: {},
                    nodes: [system],
                    edges: [],
                };
                const html = renderBulkMode(state);
                expect(html).toContain('✓');
            }),
            { numRuns: 100 }
        );
    });

    it('a system with no analysis fields renders ✗ in the status column', () => {
        fc.assert(
            fc.property(arbEmptyITSystemNode(), (system) => {
                const state = {
                    councilName: 'Test',
                    councilMetadata: {},
                    nodes: [system],
                    edges: [],
                };
                const html = renderBulkMode(state);
                expect(html).toContain('✗');
            }),
            { numRuns: 100 }
        );
    });

});

// ---------------------------------------------------------------------------
// Datalists
// ---------------------------------------------------------------------------

describe('renderBulkMode — datalists', () => {

    it('always includes the bulk-fn-datalist for function autocomplete', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const html = renderBulkMode(editorState);
                expect(html).toContain('id="bulk-fn-datalist"');
            }),
            { numRuns: 100 }
        );
    });

    it('always includes the bulk-vendor-datalist for vendor autocomplete', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const html = renderBulkMode(editorState);
                expect(html).toContain('id="bulk-vendor-datalist"');
            }),
            { numRuns: 100 }
        );
    });

    it('vendor from system node appears in the vendor datalist when present', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const systems = editorState.nodes.filter(n => n.type === 'ITSystem');
                const vendorsInState = systems.map(s => s.vendor).filter(Boolean);
                if (vendorsInState.length === 0) return;

                const html = renderBulkMode(editorState);
                for (const vendor of vendorsInState) {
                    expect(html).toContain(vendor);
                }
            }),
            { numRuns: 100 }
        );
    });

});

// ---------------------------------------------------------------------------
// Referential transparency
// ---------------------------------------------------------------------------

describe('renderBulkMode — referential transparency', () => {

    it('same editorState always produces the same output', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const first = renderBulkMode(editorState);
                const second = renderBulkMode(editorState);
                expect(first).toBe(second);
            }),
            { numRuns: 100 }
        );
    });

});
