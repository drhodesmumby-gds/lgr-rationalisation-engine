#!/bin/bash
sed -i '' 's/function groupSystemsByDomain(editorState) {/function groupSystemsByDomain(editorState) { console.log(">>> groupSystemsByDomain START");/' src/features/unified-editor/list-panel.js
sed -i '' 's/return sorted.map(/console.log(">>> groupSystemsByDomain END"); return sorted.map(/g' src/features/unified-editor/list-panel.js
sed -i '' 's/function renderUnifiedEditor(json, options = {}) {/function renderUnifiedEditor(json, options = {}) { console.log(">>> renderUnifiedEditor START");/' src/features/unified-editor/editor.js
sed -i '' 's/function renderListPanel(editorState, options = {}) {/function renderListPanel(editorState, options = {}) { console.log(">>> renderListPanel START");/' src/features/unified-editor/list-panel.js
