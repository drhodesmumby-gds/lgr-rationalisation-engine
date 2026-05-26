/**
 * Property tests for props-panel.js — renderPropsPanel
 *
 * renderPropsPanel is a pure HTML-generating function that takes a system
 * object (or null) and an editorState, and returns an HTML string.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { renderPropsPanel } from '../../src/features/unified-editor/props-panel.js';
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

function emptyEditorState() {
    return { councilName: 'Test', councilMetadata: {}, nodes: [], edges: [] };
}

/**
 * Build an editorState containing the given system, with an optional REALIZES
 * edge to a Function node.
 */
function stateWithSystem(system, lgaFunctionId = null) {
    const nodes = [system];
    const edges = [];
    if (lgaFunctionId) {
        const lgaEntry = LGA_FUNCTIONS.find(f => f.id === lgaFunctionId);
        const fnNode = {
            id: `fn-${lgaFunctionId}`,
            type: 'Function',
            label: lgaEntry ? lgaEntry.label : `Function ${lgaFunctionId}`,
            lgaFunctionId,
        };
        nodes.push(fnNode);
        edges.push({ source: system.id, target: fnNode.id, relationship: 'REALIZES' });
    }
    return { councilName: 'Test', councilMetadata: {}, nodes, edges };
}

// ---------------------------------------------------------------------------
// Null system — empty state
// ---------------------------------------------------------------------------

describe('renderPropsPanel — null system', () => {

    it('returns a non-empty string when system is null', () => {
        const html = renderPropsPanel(null, emptyEditorState());
        expect(typeof html).toBe('string');
        expect(html.length).toBeGreaterThan(0);
    });

    it('contains the "Select a system" prompt when system is null', () => {
        const html = renderPropsPanel(null, emptyEditorState());
        expect(html).toContain('Select a system');
    });

    it('does NOT contain form fields when system is null', () => {
        const html = renderPropsPanel(null, emptyEditorState());
        expect(html).not.toContain('data-prop-field');
        expect(html).not.toContain('data-props-panel');
    });

    it('null system with any editorState always returns the empty state message', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const html = renderPropsPanel(null, editorState);
                expect(html).toContain('Select a system');
            }),
            { numRuns: 100 }
        );
    });

});

// ---------------------------------------------------------------------------
// Non-null system — form structure
// ---------------------------------------------------------------------------

describe('renderPropsPanel — form structure', () => {

    it('always returns a non-empty string for any system', () => {
        fc.assert(
            fc.property(arbITSystemNode(), (system) => {
                const html = renderPropsPanel(system, stateWithSystem(system));
                expect(typeof html).toBe('string');
                expect(html.length).toBeGreaterThan(0);
            }),
            { numRuns: 100 }
        );
    });

    it('output contains the data-props-panel container attribute', () => {
        fc.assert(
            fc.property(arbITSystemNode(), (system) => {
                const html = renderPropsPanel(system, stateWithSystem(system));
                expect(html).toContain('data-props-panel');
            }),
            { numRuns: 100 }
        );
    });

    it('output contains all three section headings', () => {
        fc.assert(
            fc.property(arbITSystemNode(), (system) => {
                const html = renderPropsPanel(system, stateWithSystem(system));
                expect(html).toContain('Identity');
                expect(html).toContain('Contract &amp; Cost');
                expect(html).toContain('Technical Profile');
            }),
            { numRuns: 100 }
        );
    });

    it('output contains the System Name input field', () => {
        fc.assert(
            fc.property(arbITSystemNode(), (system) => {
                const html = renderPropsPanel(system, stateWithSystem(system));
                expect(html).toContain('data-prop-field="label"');
            }),
            { numRuns: 100 }
        );
    });

    it('output contains the Vendor input field', () => {
        fc.assert(
            fc.property(arbITSystemNode(), (system) => {
                const html = renderPropsPanel(system, stateWithSystem(system));
                expect(html).toContain('data-prop-field="vendor"');
            }),
            { numRuns: 100 }
        );
    });

    it('output contains the Annual Cost input field', () => {
        fc.assert(
            fc.property(arbITSystemNode(), (system) => {
                const html = renderPropsPanel(system, stateWithSystem(system));
                expect(html).toContain('data-prop-field="annualCost"');
            }),
            { numRuns: 100 }
        );
    });

    it('output contains the isERP checkbox', () => {
        fc.assert(
            fc.property(arbITSystemNode(), (system) => {
                const html = renderPropsPanel(system, stateWithSystem(system));
                expect(html).toContain('data-prop-field="isERP"');
            }),
            { numRuns: 100 }
        );
    });

    it('output contains the contract end (endMonth and endYear) inputs', () => {
        fc.assert(
            fc.property(arbITSystemNode(), (system) => {
                const html = renderPropsPanel(system, stateWithSystem(system));
                expect(html).toContain('data-prop-field="endMonth"');
                expect(html).toContain('data-prop-field="endYear"');
            }),
            { numRuns: 100 }
        );
    });

    it('output contains the noticePeriod input', () => {
        fc.assert(
            fc.property(arbITSystemNode(), (system) => {
                const html = renderPropsPanel(system, stateWithSystem(system));
                expect(html).toContain('data-prop-field="noticePeriod"');
            }),
            { numRuns: 100 }
        );
    });

    it('output contains Hosting radio group', () => {
        fc.assert(
            fc.property(arbITSystemNode(), (system) => {
                const html = renderPropsPanel(system, stateWithSystem(system));
                expect(html).toContain('name="hosting"');
            }),
            { numRuns: 100 }
        );
    });

    it('output contains Data Partitioning radio group', () => {
        fc.assert(
            fc.property(arbITSystemNode(), (system) => {
                const html = renderPropsPanel(system, stateWithSystem(system));
                expect(html).toContain('name="dataPartitioning"');
            }),
            { numRuns: 100 }
        );
    });

    it('output contains Data Portability radio group', () => {
        fc.assert(
            fc.property(arbITSystemNode(), (system) => {
                const html = renderPropsPanel(system, stateWithSystem(system));
                expect(html).toContain('name="portability"');
            }),
            { numRuns: 100 }
        );
    });

    it('output contains Support Model select', () => {
        fc.assert(
            fc.property(arbITSystemNode(), (system) => {
                const html = renderPropsPanel(system, stateWithSystem(system));
                expect(html).toContain('data-prop-field="supportModel"');
            }),
            { numRuns: 100 }
        );
    });

    it('output contains the delete system button', () => {
        fc.assert(
            fc.property(arbITSystemNode(), (system) => {
                const html = renderPropsPanel(system, stateWithSystem(system));
                expect(html).toContain('data-prop-action="delete"');
            }),
            { numRuns: 100 }
        );
    });

});

// ---------------------------------------------------------------------------
// Field value reflection
// ---------------------------------------------------------------------------

describe('renderPropsPanel — field value reflection', () => {

    it('system label appears as the value of the System Name input', () => {
        fc.assert(
            fc.property(arbITSystemNode(), (system) => {
                if (!system.label) return;
                const html = renderPropsPanel(system, stateWithSystem(system));
                expect(html).toContain(`value="${system.label}"`);
            }),
            { numRuns: 100 }
        );
    });

    it('system vendor appears as the value of the Vendor input', () => {
        fc.assert(
            fc.property(arbITSystemNode(), (system) => {
                if (!system.vendor) return;
                const html = renderPropsPanel(system, stateWithSystem(system));
                expect(html).toContain(`value="${system.vendor}"`);
            }),
            { numRuns: 100 }
        );
    });

    it('isERP checkbox is checked when system.isERP is true', () => {
        fc.assert(
            fc.property(
                arbITSystemNode().map(s => ({ ...s, isERP: true })),
                (system) => {
                    const html = renderPropsPanel(system, stateWithSystem(system));
                    // The checkbox with data-prop-field="isERP" should have the checked attribute
                    expect(html).toMatch(/data-prop-field="isERP"[^>]*checked|checked[^>]*data-prop-field="isERP"/);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('isERP checkbox is NOT checked when system.isERP is false', () => {
        fc.assert(
            fc.property(
                arbITSystemNode().map(s => ({ ...s, isERP: false })),
                (system) => {
                    const html = renderPropsPanel(system, stateWithSystem(system));
                    // The isERP checkbox line should not contain "checked"
                    const checkboxLine = html.match(/data-prop-field="isERP"[^/]*/);
                    if (checkboxLine) {
                        expect(checkboxLine[0]).not.toContain('checked');
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Hosting Cloud radio is selected when isCloud is true', () => {
        fc.assert(
            fc.property(
                arbITSystemNode().map(s => ({ ...s, hosting: 'cloud' })),
                (system) => {
                    const html = renderPropsPanel(system, stateWithSystem(system));
                    // Radio with value="Cloud" should be checked
                    expect(html).toContain('value="Cloud" checked');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Hosting On-Premise radio is selected when isCloud is false', () => {
        fc.assert(
            fc.property(
                arbITSystemNode().map(s => ({ ...s, hosting: 'on-premise' })),
                (system) => {
                    const html = renderPropsPanel(system, stateWithSystem(system));
                    expect(html).toContain('value="On-Premise" checked');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('portability radio reflects current system.portability value', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('High', 'Medium', 'Low'),
                arbITSystemNode(),
                (portability, system) => {
                    const sys = { ...system, portability };
                    const html = renderPropsPanel(sys, stateWithSystem(sys));
                    expect(html).toContain(`value="${portability}" checked`);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('dataPartitioning radio reflects current system.dataPartitioning value', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('Segmented', 'Monolithic'),
                arbITSystemNode(),
                (partitioning, system) => {
                    const sys = { ...system, dataPartitioning: partitioning };
                    const html = renderPropsPanel(sys, stateWithSystem(sys));
                    expect(html).toContain(`value="${partitioning}" checked`);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('supportModel option is selected in the dropdown', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('vendor-supported', 'community-supported', 'unsupported'),
                arbITSystemNode(),
                (supportModel, system) => {
                    const sys = { ...system, supportModel };
                    const html = renderPropsPanel(sys, stateWithSystem(sys));
                    expect(html).toContain(`value="${supportModel}" selected`);
                }
            ),
            { numRuns: 100 }
        );
    });

});

// ---------------------------------------------------------------------------
// Completeness banner
// ---------------------------------------------------------------------------

describe('renderPropsPanel — completeness banner', () => {

    it('a fully populated system shows the "All fields complete" green banner', () => {
        fc.assert(
            fc.property(arbCompleteITSystemNode(), (system) => {
                const state = stateWithSystem(system, LGA_FUNCTIONS[0].id);
                const html = renderPropsPanel(system, state);
                expect(html).toContain('All fields complete');
            }),
            { numRuns: 100 }
        );
    });

    it('a system with missing fields shows the amber "fields needed" warning', () => {
        fc.assert(
            fc.property(arbEmptyITSystemNode(), (system) => {
                const state = stateWithSystem(system, LGA_FUNCTIONS[0].id);
                const html = renderPropsPanel(system, state);
                // Should show amber warning about missing fields
                expect(html).toContain('needed for analysis');
            }),
            { numRuns: 100 }
        );
    });

    it('a system with no label triggers a red structural error banner', () => {
        fc.assert(
            fc.property(arbITSystemNode(), (system) => {
                const sys = { ...system, label: '' };
                const html = renderPropsPanel(sys, stateWithSystem(sys));
                expect(html).toContain('System has no name');
            }),
            { numRuns: 100 }
        );
    });

    it('a system with no REALIZES edge triggers the "No function assigned" error', () => {
        fc.assert(
            fc.property(arbITSystemNode(), (system) => {
                // stateWithSystem without lgaFunctionId = no REALIZES edge
                const state = stateWithSystem(system);
                const html = renderPropsPanel(system, state);
                expect(html).toContain("No function assigned");
            }),
            { numRuns: 100 }
        );
    });

    it('a fully populated system with a function assigned has no error banner', () => {
        fc.assert(
            fc.property(arbCompleteITSystemNode(), (system) => {
                const state = stateWithSystem(system, LGA_FUNCTIONS[0].id);
                const html = renderPropsPanel(system, state);
                // No red errors
                expect(html).not.toContain('error');
            }),
            { numRuns: 100 }
        );
    });

});

// ---------------------------------------------------------------------------
// Function chips
// ---------------------------------------------------------------------------

describe('renderPropsPanel — function chips', () => {

    it('a system with a REALIZES edge shows the function as a chip in the Functions field', () => {
        fc.assert(
            fc.property(
                arbITSystemNode(),
                fc.constantFrom(...LGA_FUNCTIONS.slice(0, 20).map(f => f.id)),
                (system, lgaFunctionId) => {
                    const state = stateWithSystem(system, lgaFunctionId);
                    const html = renderPropsPanel(system, state);
                    const lgaEntry = LGA_FUNCTIONS.find(f => f.id === lgaFunctionId);
                    if (lgaEntry) {
                        expect(html).toContain(lgaEntry.label);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('the function chip has a remove button', () => {
        fc.assert(
            fc.property(
                arbITSystemNode(),
                fc.constantFrom(...LGA_FUNCTIONS.slice(0, 10).map(f => f.id)),
                (system, lgaFunctionId) => {
                    const state = stateWithSystem(system, lgaFunctionId);
                    const html = renderPropsPanel(system, state);
                    // chip remove buttons have data-chip-action="remove"
                    expect(html).toContain('data-chip-action="remove"');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('the function chip input has an autocomplete datalist', () => {
        fc.assert(
            fc.property(arbITSystemNode(), (system) => {
                const state = stateWithSystem(system);
                const html = renderPropsPanel(system, state);
                expect(html).toContain('props-fn-datalist');
            }),
            { numRuns: 100 }
        );
    });

});

// ---------------------------------------------------------------------------
// Referential transparency
// ---------------------------------------------------------------------------

describe('renderPropsPanel — referential transparency', () => {

    it('same system + editorState always produces the same output', () => {
        fc.assert(
            fc.property(arbITSystemNode(), (system) => {
                const state = stateWithSystem(system);
                const first = renderPropsPanel(system, state);
                const second = renderPropsPanel(system, state);
                expect(first).toBe(second);
            }),
            { numRuns: 100 }
        );
    });

    it('null system always produces the same empty-state output regardless of editorState', () => {
        fc.assert(
            fc.property(arbEditorState(), (editorState) => {
                const result = renderPropsPanel(null, editorState);
                expect(result).toContain('Select a system');
            }),
            { numRuns: 100 }
        );
    });

});
