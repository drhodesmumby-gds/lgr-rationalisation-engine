/**
 * validation-panel.js
 *
 * Full-page validation view for Stage 1.
 * Shows a two-column layout: JSON input on the left, validation results on the right.
 * Auto-detects architecture files vs transition configs.
 */

import { validateArchitecture, validateTransitionConfig } from './schema-validator.js';

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Returns the HTML string for the full-page validator view.
 */
export function renderValidationPanel() {
    return `
<div id="validatorView" class="max-w-6xl mx-auto p-8">
    <button id="btnBackFromValidator" class="text-[#1d70b8] underline font-bold text-sm mb-6 block">← Back to upload</button>
    <h2 class="text-2xl font-bold mb-2">Validate Architecture File</h2>
    <p class="text-sm text-gray-600 mb-6">Check a JSON file against the LGR schema before importing. Auto-detects whether it's an architecture file or transition config.</p>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <!-- Left: Input -->
        <div>
            <div class="flex gap-3 mb-4">
                <button id="btnValidatorUpload" class="gds-btn-secondary px-3 py-1.5 text-sm font-bold">Upload .json</button>
                <input type="file" id="validatorFileInput" accept=".json" class="sr-only">
                <span class="text-sm text-gray-500 self-center">or paste JSON below</span>
            </div>
            <textarea id="validatorTextarea" class="w-full h-80 border border-gray-300 p-3 font-mono text-xs resize-none focus:border-[#1d70b8] focus:outline-none" placeholder='Paste JSON here...\n\n{\n  "councilName": "...",\n  "nodes": [...],\n  "edges": [...]\n}'></textarea>
            <div class="flex gap-3 mt-4">
                <button id="btnRunValidation" class="gds-btn px-4 py-2 text-sm font-bold">Validate</button>
                <button id="btnClearValidator" class="gds-btn-secondary px-3 py-1.5 text-sm">Clear</button>
            </div>
        </div>

        <!-- Right: Results -->
        <div id="validatorResults" class="border-l border-gray-200 pl-8">
            <p class="text-sm text-gray-400 italic">Results will appear here after validation.</p>
        </div>
    </div>
</div>`;
}

/**
 * Attaches event handlers to the validation panel elements.
 * Must be called after renderValidationPanel() HTML is in the DOM.
 */
export function wireValidationPanel() {
    const uploadBtn = document.getElementById('btnValidatorUpload');
    const fileInput = document.getElementById('validatorFileInput');
    const textarea = document.getElementById('validatorTextarea');
    const runBtn = document.getElementById('btnRunValidation');
    const clearBtn = document.getElementById('btnClearValidator');
    const resultsDiv = document.getElementById('validatorResults');

    if (!uploadBtn) return; // Not in DOM yet

    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        textarea.value = text;
        fileInput.value = '';
    });

    clearBtn.addEventListener('click', () => {
        textarea.value = '';
        resultsDiv.innerHTML = '<p class="text-sm text-gray-400 italic">Results will appear here after validation.</p>';
    });

    runBtn.addEventListener('click', () => {
        const text = textarea.value.trim();
        if (!text) {
            resultsDiv.innerHTML = '<p class="text-sm text-[#d4351c] font-bold">Please paste or upload a JSON file first.</p>';
            return;
        }

        let json;
        try {
            json = JSON.parse(text);
        } catch (err) {
            resultsDiv.innerHTML = renderResults({
                valid: false,
                errors: [{ message: `Invalid JSON: ${err.message}` }],
                warnings: [],
                info: []
            });
            return;
        }

        // Auto-detect: transition config (has successors, no nodes) vs architecture
        let result;
        let fileType;
        if (json.successors && !json.nodes) {
            result = validateTransitionConfig(json);
            fileType = 'Transition Configuration';
        } else {
            result = validateArchitecture(json);
            fileType = 'Council Architecture';
        }

        resultsDiv.innerHTML = renderResults(result, fileType);
    });
}

function renderResults(result, fileType) {
    let html = '';

    // Summary header
    const statusIcon = result.valid ? '✓' : '✗';
    const statusColour = result.valid ? 'text-[#00703c]' : 'text-[#d4351c]';
    const statusText = result.valid ? 'Valid' : 'Invalid';

    html += `<div class="flex items-center gap-2 mb-4">`;
    html += `<span class="text-2xl ${statusColour} font-bold">${statusIcon}</span>`;
    html += `<span class="text-lg font-bold ${statusColour}">${statusText}</span>`;
    if (fileType) html += `<span class="text-sm text-gray-500 ml-2">(${fileType})</span>`;
    html += `</div>`;

    // Info items (always show)
    if (result.info && result.info.length > 0) {
        html += '<div class="mb-4 space-y-1">';
        for (const item of result.info) {
            html += `<p class="text-sm text-gray-700">✓ ${escHtml(item.message)}</p>`;
        }
        html += '</div>';
    }

    // Errors
    if (result.errors && result.errors.length > 0) {
        html += `<div class="mb-4 border-l-4 border-[#d4351c] pl-4">`;
        html += `<h4 class="font-bold text-sm text-[#d4351c] mb-2">${result.errors.length} Error${result.errors.length > 1 ? 's' : ''}</h4>`;
        html += '<ul class="space-y-1">';
        for (const err of result.errors) {
            html += `<li class="text-sm text-[#d4351c]">• ${escHtml(err.message)}</li>`;
        }
        html += '</ul></div>';
    }

    // Warnings
    if (result.warnings && result.warnings.length > 0) {
        html += `<div class="mb-4 border-l-4 border-[#f47738] pl-4">`;
        html += `<h4 class="font-bold text-sm text-[#f47738] mb-2">${result.warnings.length} Warning${result.warnings.length > 1 ? 's' : ''}</h4>`;
        html += '<ul class="space-y-1">';
        for (const warn of result.warnings) {
            html += `<li class="text-sm text-[#f47738]">• ${escHtml(warn.message)}</li>`;
        }
        html += '</ul></div>';
    }

    // Import button (only when valid)
    if (result.valid) {
        html += '<div class="mt-6 pt-4 border-t border-gray-200 flex gap-3">';
        html += '<button id="btnValidatorImport" class="gds-btn px-3 py-1.5 text-sm font-bold">Import to Engine</button>';
        html += '</div>';
    }

    return html;
}
