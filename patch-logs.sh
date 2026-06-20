#!/bin/bash
sed -i '' 's/function openUnifiedEditor(uploadIdx) {/function openUnifiedEditor(uploadIdx) { console.log(">>> openUnifiedEditor START for idx", uploadIdx);/' src/main.js
sed -i '' 's/editorOverlay.innerHTML = renderUnifiedEditor/console.log(">>> About to renderUnifiedEditor"); editorOverlay.innerHTML = renderUnifiedEditor/' src/main.js
sed -i '' 's/_currentEditorSession = wireUnifiedEditor/console.log(">>> About to wireUnifiedEditor"); _currentEditorSession = wireUnifiedEditor/' src/main.js
sed -i '' 's/if (firstFocusable) firstFocusable.focus();/if (firstFocusable) { console.log(">>> About to focus first element"); firstFocusable.focus(); console.log(">>> Focus complete"); }/' src/main.js
sed -i '' 's/export function wireUnifiedEditor(container, json, options = {}) {/export function wireUnifiedEditor(container, json, options = {}) { console.log(">>> wireUnifiedEditor START");/' src/features/unified-editor/editor.js
sed -i '' 's/function rerenderList() {/function rerenderList() { console.log(">>> rerenderList START");/' src/features/unified-editor/editor.js
sed -i '' 's/function rerenderProps() {/function rerenderProps() { console.log(">>> rerenderProps START");/' src/features/unified-editor/editor.js
sed -i '' 's/function rerenderRel() {/function rerenderRel() { console.log(">>> rerenderRel START");/' src/features/unified-editor/editor.js
