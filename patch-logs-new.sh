#!/bin/bash
sed -i '' 's/function openUnifiedEditor(uploadIdx) {/function openUnifiedEditor(uploadIdx) { console.log(">>> openUnifiedEditor START for idx", uploadIdx);/' src/main.js
sed -i '' 's/editorOverlay.innerHTML = renderUnifiedEditor/console.log(">>> About to renderUnifiedEditor"); editorOverlay.innerHTML = renderUnifiedEditor/' src/main.js
sed -i '' 's/wireUnifiedEditor(editorOverlay/console.log(">>> About to wireUnifiedEditor"); wireUnifiedEditor(editorOverlay/' src/main.js
sed -i '' 's/if (firstFocusable) firstFocusable.focus();/if (firstFocusable) { console.log(">>> About to focus first element"); firstFocusable.focus(); console.log(">>> Focus complete"); }/' src/main.js
