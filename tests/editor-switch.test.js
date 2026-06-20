// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { state } from '../src/state.js';
import { openUnifiedEditor, closeUnifiedEditor } from '../src/main.js';

describe('Editor Council Switching', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="notificationContainer"></div>
        `;
        state.rawUploads = [
            {
                filename: 'council1.json',
                data: {
                    nodes: [{ id: 'sys1', type: 'ITSystem', label: 'System 1' }],
                    edges: []
                }
            },
            {
                filename: 'council2.json',
                data: {
                    nodes: [{ id: 'sys2', type: 'ITSystem', label: 'System 2' }],
                    edges: []
                }
            }
        ];
    });

    afterEach(() => {
        closeUnifiedEditor();
        document.body.innerHTML = '';
        state.rawUploads = [];
        vi.clearAllTimers();
    });

    it('can switch councils repeatedly without infinite looping', () => {
        vi.useFakeTimers();

        // Open first council
        openUnifiedEditor(0);
        expect(document.getElementById('unifiedEditorOverlay')).not.toBeNull();

        // Simulate switching 100 times
        for (let i = 0; i < 100; i++) {
            const wrapper = document.querySelector('[data-unified-editor]');
            const select = wrapper.querySelector('select[data-ue-action="switch-council"]');
            
            // Switch to the other council
            const nextIdx = (i % 2 === 0) ? 1 : 0;
            select.value = nextIdx;
            
            // Dispatch change event
            const event = new Event('change', { bubbles: true });
            select.dispatchEvent(event);
            
            // Run the setTimeout for onSwitchCouncil
            vi.runAllTimers();
        }

        expect(document.getElementById('unifiedEditorOverlay')).not.toBeNull();
        const wrapper = document.querySelector('[data-unified-editor]');
        const select = wrapper.querySelector('select[data-ue-action="switch-council"]');
        expect(select.value).toBe('0'); // 100 switches -> ends on 0
        
        vi.useRealTimers();
    });
});
