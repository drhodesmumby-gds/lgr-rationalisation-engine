#!/bin/bash
sed -i '' 's/if (!isNaN(newIdx) && options.onSwitchCouncil) {/console.log(">>> Dropdown change detected!", newIdx); if (!isNaN(newIdx) && options.onSwitchCouncil) {/' src/features/unified-editor/editor.js
sed -i '' 's/if (onSave) onSave(editorState);/console.log(">>> About to call onSave"); if (onSave) onSave(editorState); console.log(">>> onSave completed");/' src/features/unified-editor/editor.js
sed -i '' 's/setTimeout(() => options.onSwitchCouncil(newIdx), 0);/console.log(">>> Setting setTimeout for onSwitchCouncil"); setTimeout(() => { console.log(">>> setTimeout callback executing"); options.onSwitchCouncil(newIdx); }, 0);/' src/features/unified-editor/editor.js
