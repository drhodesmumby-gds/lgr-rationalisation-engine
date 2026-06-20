import fs from 'fs';
import { renderUnifiedEditor, wireUnifiedEditor } from './src/features/unified-editor/editor.js';

// mock DOM
import { JSDOM } from 'jsdom';
const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="unifiedEditorOverlay"></div></body></html>`);
global.document = dom.window.document;
global.window = dom.window;
global.HTMLElement = dom.window.HTMLElement;

const dummyState = {
    nodes: [
        { id: 'sys-1', type: 'ITSystem', label: 'System A' },
        { id: 'fn-1', type: 'Function', label: 'Function A', lgaFunctionId: '1' }
    ],
    edges: [
        { id: 'edge-1', source: 'sys-1', target: 'fn-1', relationship: 'REALIZES' }
    ]
};

const state = {
    rawUploads: [
        { filename: 'council1.json', data: JSON.parse(JSON.stringify(dummyState)) },
        { filename: 'council2.json', data: JSON.parse(JSON.stringify(dummyState)) }
    ]
};

let _currentEditorSession = null;

function openUnifiedEditor(uploadIdx) {
    let editorOverlay = document.getElementById('unifiedEditorOverlay');
    const upload = state.rawUploads[uploadIdx];
    
    editorOverlay.innerHTML = renderUnifiedEditor(upload.data, {
        source: 'edit',
        title: 'Title',
        allUploads: state.rawUploads,
        currentUploadIdx: uploadIdx
    });

    if (_currentEditorSession) {
        _currentEditorSession.destroy();
    }

    _currentEditorSession = wireUnifiedEditor(editorOverlay, upload.data, {
        onSave(data) {
            state.rawUploads[uploadIdx] = { filename: upload.filename, data };
        },
        onSwitchCouncil(newIdx) {
            openUnifiedEditor(newIdx);
        }
    });
}

console.log("Starting test...");
openUnifiedEditor(0);
console.log("Switching to 1...");
openUnifiedEditor(1);
console.log("Switching to 0...");
openUnifiedEditor(0);

for(let i=0; i<100; i++) {
    openUnifiedEditor(i % 2);
}
console.log("Done 100 switches.");
