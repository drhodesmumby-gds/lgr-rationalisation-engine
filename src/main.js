// ES Module imports — extracted from monolith
import { LGA_FUNCTIONS } from './constants/lga-functions.js';
import { DEFAULT_TIER_MAP } from './constants/tier-map.js';
import { SIGNAL_DEFS, PERSONA_DEFAULT_WEIGHTS } from './constants/signals.js';
import { DOMAIN_TERMS } from './constants/domain-terms.js';
import { DOCUMENTATION } from './constants/documentation.js';
import { getLgaFunction, getLgaBreadcrumb } from './taxonomy.js';
import { wrapWithTooltip, helpIcon, escHtml } from './ui-helpers.js';
import {
    buildSuccessorAllocation, classifyVestingZone,
    detectSharedServiceBoundary, detectCrossTierCollision,
    propagateFinancialDistress
} from './analysis/allocation.js';
import {
    computeSignals, computeSignalEmphasis,
    computeTcopAssessment, computeVendorDensityMetrics
} from './analysis/signals.js';
import {
    computeEstateSummaryMetrics, computeEffectiveTier,
    sortFunctionRows, classifyRationalisationPattern,
    getHeadlineMetrics
} from './analysis/metrics.js';
import { generatePersonaQuestions } from './analysis/questions.js';

import { state } from './state.js';
import { openImportWizard, closeImportWizard, handleImportNext, handleImportBack } from './features/import-wizard.js';
import { openArchEditor, wireEditArchBtn, generateId } from './features/arch-editor.js';
import {
    enterSimulation, exitSimulation, recomputeSimulation,
    renderSimulationWorkspace, renderBeforeAfterMetrics
} from './features/simulation-panel.js';
import { openDecisionPanel } from './features/decision-panel.js';
import { getDecisionKey } from './simulation/decisions.js';

state.signalWeights = { ...PERSONA_DEFAULT_WEIGHTS.executive };

// =======================================================================
// INLINE DOCUMENTATION — Sprint 7
// =======================================================================

function toggleHeaderCollapse() {
    state.headerCollapsed = !state.headerCollapsed;
    const header = document.querySelector('header');
    const chevron = document.getElementById('headerChevron');
    header.classList.toggle('header-collapsed', state.headerCollapsed);
    chevron.classList.toggle('flipped', state.headerCollapsed);
    document.getElementById('btnCollapseHeader').setAttribute('aria-label', state.headerCollapsed ? 'Expand header' : 'Collapse header');
    document.getElementById('btnCollapseHeader').setAttribute('title', state.headerCollapsed ? 'Expand header' : 'Collapse header');
}

function toggleBannerCollapse() {
    state.bannerCollapsed = !state.bannerCollapsed;
    const banner = document.getElementById('personaBanner');
    const chevron = document.getElementById('bannerChevron');
    banner.classList.toggle('banner-collapsed', state.bannerCollapsed);
    chevron.classList.toggle('flipped', state.bannerCollapsed);
    document.getElementById('btnCollapseBanner').setAttribute('aria-label', state.bannerCollapsed ? 'Expand banner' : 'Collapse banner');
    document.getElementById('btnCollapseBanner').setAttribute('title', state.bannerCollapsed ? 'Expand banner' : 'Collapse banner');
}

function openDocModal(key) {
    const doc = DOCUMENTATION[key];
    if (!doc) return;
    document.getElementById('docModalTitle').textContent = doc.title;
    document.getElementById('docModalContent').innerHTML = doc.html;
    document.getElementById('docModal').classList.remove('hidden');
}

// DOM Elements
const stageUpload = document.getElementById('stageUpload');
const stageBaseline = document.getElementById('stageBaseline');
const stageDashboard = document.getElementById('stageDashboard');
const stageTransitionConfig = document.getElementById('stageTransitionConfig');
const controlsArea = document.getElementById('controlsArea');
const personaSelect = document.getElementById('personaSelect');
const perspectiveSelect = document.getElementById('perspectiveSelect');
const timelineSection = document.getElementById('timelineSection');
const personaBanner = document.getElementById('personaBanner');
const personaTitle = document.getElementById('personaTitle');
const personaDesc = document.getElementById('personaDesc');
const personaIcon = document.getElementById('personaIcon');

// Glossary Elements
const btnOpenGlossary = document.getElementById('btnOpenGlossary');
const btnCloseGlossary = document.getElementById('btnCloseGlossary');
const glossaryModal = document.getElementById('glossaryModal');

btnOpenGlossary.addEventListener('click', () => glossaryModal.classList.remove('hidden'));
btnCloseGlossary.addEventListener('click', () => glossaryModal.classList.add('hidden'));
glossaryModal.addEventListener('click', (e) => { if (e.target === glossaryModal) glossaryModal.classList.add('hidden'); });

// --- Documentation Modal ---
const docModal = document.getElementById('docModal');
const btnCloseDoc = document.getElementById('btnCloseDoc');
btnCloseDoc.addEventListener('click', () => docModal.classList.add('hidden'));
docModal.addEventListener('click', (e) => { if (e.target === docModal) docModal.classList.add('hidden'); });

// --- Tier Mapping Modal ---
const tierMappingModal = document.getElementById('tierMappingModal');
const btnViewTierMapping = document.getElementById('btnViewTierMapping');
const btnCloseTierMapping = document.getElementById('btnCloseTierMapping');

function renderTierMappingModal() {
    const content = document.getElementById('tierMappingContent');
    // Group LGA_FUNCTIONS by their tier from DEFAULT_TIER_MAP
    const tierGroups = { 1: [], 2: [], 3: [] };

    LGA_FUNCTIONS.forEach(fn => {
        const tier = DEFAULT_TIER_MAP.get(fn.id) || 2;
        tierGroups[tier].push(fn);
    });

    // Sort each group alphabetically by label
    Object.values(tierGroups).forEach(group => group.sort((a, b) => a.label.localeCompare(b.label)));

    const tierMeta = {
        1: { label: 'Tier 1 — Day 1 Critical', desc: 'Statutory and safeguarding services that must be operational from vesting day.', tagClass: 'tag-red' },
        2: { label: 'Tier 2 — High Priority', desc: 'Services approaching contract renewal or requiring regulatory compliance attention.', tagClass: 'tag-orange' },
        3: { label: 'Tier 3 — Post-Day 1', desc: 'Services that can run behind the veneer strategy post-vesting.', tagClass: 'tag-blue' }
    };

    let html = '';
    [1, 2, 3].forEach(tier => {
        const meta = tierMeta[tier];
        const functions = tierGroups[tier];
        html += `<div>`;
        html += `<h3 class="font-bold text-lg mb-1"><span class="gds-tag ${meta.tagClass} mr-2">${meta.label}</span></h3>`;
        html += `<p class="text-sm text-gray-600 mb-3">${meta.desc}</p>`;
        html += `<table class="w-full text-sm mb-2"><thead><tr class="border-b-2 border-[#0b0c0c]"><th class="text-left pb-1 font-bold w-20">ESD ID</th><th class="text-left pb-1 font-bold">Function</th></tr></thead><tbody>`;
        functions.forEach(fn => {
            const isExplicit = DEFAULT_TIER_MAP.has(fn.id);
            const defaultNote = !isExplicit && tier === 2 ? ' <span class="text-gray-400 text-[10px]">(default)</span>' : '';
            html += `<tr class="border-b border-gray-100"><td class="py-1 font-mono text-gray-500">${fn.id}</td><td class="py-1">${fn.label}${defaultNote}</td></tr>`;
        });
        html += `</tbody></table>`;
        html += `<p class="text-xs text-gray-400">${functions.length} functions</p>`;
        html += `</div>`;
    });

    content.innerHTML = html;
}

btnViewTierMapping.addEventListener('click', () => {
    renderTierMappingModal();
    tierMappingModal.classList.remove('hidden');
});
btnCloseTierMapping.addEventListener('click', () => tierMappingModal.classList.add('hidden'));
tierMappingModal.addEventListener('click', (e) => { if (e.target === tierMappingModal) tierMappingModal.classList.add('hidden'); });

// --- Analysis Modal ---
const analysisModalEl = document.getElementById('analysisModal');
document.getElementById('btnCloseAnalysis').addEventListener('click', () => analysisModalEl.classList.add('hidden'));
analysisModalEl.addEventListener('click', (e) => { if (e.target === analysisModalEl) analysisModalEl.classList.add('hidden'); });

// --- Signal Options ---
function renderOptionsPanel() {
    const tbody = document.getElementById('signalWeightsTable');
    tbody.innerHTML = SIGNAL_DEFS.map(sig => `
        <tr class="border-b border-gray-100">
            <td class="py-2 pr-4">
                <span class="font-bold block">${sig.label}</span>
                <span class="text-xs text-gray-500">${sig.desc}</span>
            </td>
            ${[0,1,2,3].map(w => `
                <td class="text-center py-2">
                    <input type="radio" name="sig_${sig.id}" value="${w}" ${state.signalWeights[sig.id] === w ? 'checked' : ''} class="cursor-pointer">
                </td>
            `).join('')}
        </tr>
    `).join('');
}

document.getElementById('btnOpenOptions').addEventListener('click', () => {
    renderOptionsPanel();
    document.getElementById('optionsModal').classList.remove('hidden');
});
document.getElementById('btnCloseOptions').addEventListener('click', () => document.getElementById('optionsModal').classList.add('hidden'));

document.getElementById('btnApplyWeights').addEventListener('click', () => {
    SIGNAL_DEFS.forEach(sig => {
        const sel = document.querySelector(`input[name="sig_${sig.id}"]:checked`);
        if (sel) state.signalWeights[sig.id] = parseInt(sel.value);
    });
    document.getElementById('optionsModal').classList.add('hidden');
    renderDashboard();
});

document.getElementById('btnResetWeights').addEventListener('click', () => {
    state.signalWeights = { ...PERSONA_DEFAULT_WEIGHTS[state.activePersona] };
    renderOptionsPanel();
});

// --- STAGE 1: UPLOAD LOGIC ---
const fileInput = document.getElementById('fileInput');
document.getElementById('uploadArea').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('click', (e) => e.stopPropagation());

fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const listUl = document.getElementById('uploadedFilesUl');
    
    for (const file of files) {
        const text = await file.text();
        try {
            const json = JSON.parse(text);

            // Detect transition config files (have successors but no nodes)
            if (json.successors && Array.isArray(json.successors) && !json.nodes) {
                state.pendingTransitionConfig = json;
                const li = document.createElement('li');
                li.className = 'flex items-center gap-3';
                const span = document.createElement('span');
                span.textContent = `${file.name} (transition config — ${json.successors.length} successor${json.successors.length !== 1 ? 's' : ''})`;
                span.className = 'text-[#505a5f] italic';
                li.appendChild(span);
                listUl.appendChild(li);
                continue;
            }

            const uploadIdx = state.rawUploads.length;
            state.rawUploads.push({ filename: file.name, data: json });

            const li = document.createElement('li');
            li.className = 'flex items-center gap-3';
            const span = document.createElement('span');
            span.textContent = `${json.councilName || file.name} (${json.nodes?.length || 0} nodes)`;
            const editBtn = document.createElement('button');
            editBtn.className = 'btn-edit-arch gds-btn-secondary px-2 py-1 text-xs font-bold hover:bg-gray-100';
            editBtn.setAttribute('data-upload-idx', uploadIdx);
            editBtn.textContent = 'Edit Architecture';
            wireEditArchBtn(editBtn);
            li.appendChild(span);
            li.appendChild(editBtn);
            listUl.appendChild(li);
        } catch (err) {
            alert(`Failed to parse ${file.name}`);
        }
    }

    document.getElementById('fileList').classList.remove('hidden');
});

document.getElementById('btnProceedBaseline').addEventListener('click', () => {
    runBaselining();
    // Auto-apply transition config if one was uploaded alongside architecture files
    if (state.pendingTransitionConfig) {
        state.transitionStructure = {
            vestingDate: state.pendingTransitionConfig.vestingDate || '',
            successors: (state.pendingTransitionConfig.successors || []).map(s => ({
                name: s.name || '',
                fullPredecessors: s.fullPredecessors || [],
                partialPredecessors: s.partialPredecessors || []
            }))
        };
        state.pendingTransitionConfig = null;
    }
    stageUpload.classList.add('hidden');
    stageTransitionConfig.classList.remove('hidden');
    renderTransitionConfigPanel();
});

// --- STAGE 1.5: TRANSITION CONFIGURATION LOGIC ---
let successorCounter = 0;

function renderTransitionConfigPanel() {
    const list = document.getElementById('successorList');
    list.innerHTML = '';
    successorCounter = 0;

    // Pre-populate from existing state.transitionStructure if reconfiguring
    if (state.transitionStructure && state.transitionStructure.successors) {
        const vestingInput = document.getElementById('vestingDateInput');
        if (state.transitionStructure.vestingDate) {
            vestingInput.value = state.transitionStructure.vestingDate;
        }
        state.transitionStructure.successors.forEach(s => {
            addSuccessorRow(s.name, s.fullPredecessors || [], s.partialPredecessors || []);
        });
    } else {
        // Start with one empty successor row
        addSuccessorRow();
    }

    validateTransitionConfig();
}

function addSuccessorRow(name, fullPreds, partialPreds) {
    successorCounter++;
    const idx = successorCounter;
    const councils = Array.from(state.mergedArchitecture.councils).sort();
    name = name || '';
    fullPreds = fullPreds || [];
    partialPreds = partialPreds || [];

    const div = document.createElement('div');
    div.id = `successor-row-${idx}`;
    div.className = 'border-2 border-[#b1b4b6] p-4 bg-[#f3f2f1]';
    div.setAttribute('data-successor-idx', idx);

    let fullCheckboxes = councils.map(c => {
        const checked = fullPreds.includes(c) ? 'checked' : '';
        return `<label class="flex items-center gap-2 text-sm"><input type="checkbox" class="full-pred-cb" value="${c}" data-idx="${idx}" ${checked}> ${c}</label>`;
    }).join('');

    let partialCheckboxes = councils.map(c => {
        const checked = partialPreds.includes(c) ? 'checked' : '';
        return `<label class="flex items-center gap-2 text-sm"><input type="checkbox" class="partial-pred-cb" value="${c}" data-idx="${idx}" ${checked}> ${c}</label>`;
    }).join('');

    div.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <h4 class="font-bold text-lg">Successor ${idx}</h4>
            <button class="btn-remove-successor text-[#d4351c] font-bold text-sm hover:underline" data-idx="${idx}">Remove</button>
        </div>
        <div class="mb-4">
            <label class="block font-bold mb-1 text-sm">Successor Authority Name</label>
            <input type="text" class="successor-name-input border-2 border-[#0b0c0c] p-2 text-base w-full" data-idx="${idx}" value="${name}" placeholder="e.g. North East Essex">
        </div>
        <div class="grid grid-cols-2 gap-4">
            <div>
                <label class="block font-bold mb-2 text-sm">Full Predecessors</label>
                <p class="text-xs text-gray-500 mb-2">Entire estate transfers to this successor.</p>
                <div class="space-y-1 max-h-40 overflow-y-auto bg-white p-2 border border-gray-300">${fullCheckboxes}</div>
            </div>
            <div>
                <label class="block font-bold mb-2 text-sm">Partial Predecessors</label>
                <p class="text-xs text-gray-500 mb-2">Estate must be split across multiple successors.</p>
                <div class="space-y-1 max-h-40 overflow-y-auto bg-white p-2 border border-gray-300">${partialCheckboxes}</div>
            </div>
        </div>
    `;

    document.getElementById('successorList').appendChild(div);

    // Attach event listeners for validation on change
    div.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', () => { enforceTransitionConstraints(); validateTransitionConfig(); });
        input.addEventListener('input', () => { enforceTransitionConstraints(); validateTransitionConfig(); });
    });

    // Run constraints after adding a new row (picks up state from other rows)
    enforceTransitionConstraints();

    div.querySelector('.btn-remove-successor').addEventListener('click', (e) => {
        const removeIdx = e.target.getAttribute('data-idx');
        const row = document.getElementById(`successor-row-${removeIdx}`);
        if (row) row.remove();
        enforceTransitionConstraints();
        validateTransitionConfig();
    });
}

function collectTransitionStructure() {
    const vestingDate = document.getElementById('vestingDateInput').value || null;
    const successorRows = document.getElementById('successorList').children;
    const successors = [];

    for (const row of successorRows) {
        const idx = row.getAttribute('data-successor-idx');
        const nameInput = row.querySelector(`.successor-name-input[data-idx="${idx}"]`);
        const name = nameInput ? nameInput.value.trim() : '';

        const fullPreds = [];
        row.querySelectorAll(`.full-pred-cb[data-idx="${idx}"]:checked`).forEach(cb => {
            fullPreds.push(cb.value);
        });

        const partialPreds = [];
        row.querySelectorAll(`.partial-pred-cb[data-idx="${idx}"]:checked`).forEach(cb => {
            partialPreds.push(cb.value);
        });

        if (name) {
            successors.push({ name, fullPredecessors: fullPreds, partialPredecessors: partialPreds });
        }
    }

    return { vestingDate, successors };
}

function validateTransitionConfig() {
    const structure = collectTransitionStructure();
    const allCouncils = Array.from(state.mergedArchitecture.councils);
    const assignedCouncils = new Set();

    structure.successors.forEach(s => {
        s.fullPredecessors.forEach(c => assignedCouncils.add(c));
        s.partialPredecessors.forEach(c => assignedCouncils.add(c));
    });

    const unassigned = allCouncils.filter(c => !assignedCouncils.has(c));
    const warningEl = document.getElementById('transitionValidationWarning');
    const msgEl = document.getElementById('transitionValidationMsg');

    if (unassigned.length > 0 && structure.successors.length > 0) {
        msgEl.textContent = `The following councils are not assigned to any successor: ${unassigned.join(', ')}. You can still proceed, but analysis may be incomplete.`;
        warningEl.classList.remove('hidden');
    } else {
        warningEl.classList.add('hidden');
    }

    // Update export button enabled state
    const exportBtn = document.getElementById('btnExportTransition');
    if (exportBtn) {
        exportBtn.disabled = structure.successors.length === 0;
    }

    return unassigned;
}

function enforceTransitionConstraints() {
    const successorList = document.getElementById('successorList');
    if (!successorList) return;

    // Build maps: which councils are full-assigned and partial-assigned, and to which successor
    const fullAssigned = new Map();   // council → successor name
    const partialAssigned = new Set(); // councils that are partial anywhere

    for (const row of successorList.children) {
        const idx = row.getAttribute('data-successor-idx');
        const nameInput = row.querySelector(`.successor-name-input[data-idx="${idx}"]`);
        const successorName = nameInput ? nameInput.value.trim() : `Successor ${idx}`;

        row.querySelectorAll(`.full-pred-cb[data-idx="${idx}"]:checked`).forEach(cb => {
            fullAssigned.set(cb.value, successorName);
        });
        row.querySelectorAll(`.partial-pred-cb[data-idx="${idx}"]:checked`).forEach(cb => {
            partialAssigned.add(cb.value);
        });
    }

    // Apply constraints to every checkbox
    for (const row of successorList.children) {
        const idx = row.getAttribute('data-successor-idx');

        row.querySelectorAll(`.full-pred-cb[data-idx="${idx}"]`).forEach(cb => {
            const council = cb.value;
            let shouldDisable = false;
            let reason = '';

            // Rule 1: council is full-assigned to a DIFFERENT successor
            if (fullAssigned.has(council) && !cb.checked) {
                shouldDisable = true;
                reason = `Entire estate already assigned to ${fullAssigned.get(council)}`;
            }
            // Rule 4: council is partial anywhere → can't be full anywhere
            if (partialAssigned.has(council)) {
                shouldDisable = true;
                reason = `Estate is being split as partial predecessor — cannot also assign fully`;
            }

            cb.disabled = shouldDisable;
            cb.parentElement.classList.toggle('opacity-50', shouldDisable);
            cb.parentElement.classList.toggle('cursor-not-allowed', shouldDisable);
            cb.parentElement.title = shouldDisable ? reason : '';
            if (shouldDisable && cb.checked && fullAssigned.get(council) !== (row.querySelector(`.successor-name-input[data-idx="${idx}"]`)?.value.trim() || '')) {
                cb.checked = false;
            }
        });

        row.querySelectorAll(`.partial-pred-cb[data-idx="${idx}"]`).forEach(cb => {
            const council = cb.value;
            let shouldDisable = false;
            let reason = '';

            // Rule 1+2: council is full-assigned anywhere → can't be partial anywhere
            if (fullAssigned.has(council)) {
                shouldDisable = true;
                reason = `Entire estate already assigned to ${fullAssigned.get(council)} — cannot split`;
            }

            cb.disabled = shouldDisable;
            cb.parentElement.classList.toggle('opacity-50', shouldDisable);
            cb.parentElement.classList.toggle('cursor-not-allowed', shouldDisable);
            cb.parentElement.title = shouldDisable ? reason : '';
            if (shouldDisable && cb.checked) {
                cb.checked = false;
            }
        });
    }
}

function deriveOperatingMode() {
    if (state.transitionStructure && state.transitionStructure.successors && state.transitionStructure.successors.length > 0) {
        state.operatingMode = 'transition';
    } else {
        state.operatingMode = 'discovery';
    }
}

function exportTransitionStructure() {
    const structure = collectTransitionStructure();
    structure.exportedAt = new Date().toISOString();
    structure.sourceCouncils = Array.from(state.mergedArchitecture.councils);
    const blob = new Blob([JSON.stringify(structure, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transition-config.json';
    a.click();
    URL.revokeObjectURL(url);
}

function importTransitionStructure(json) {
    if (!json.vestingDate || !Array.isArray(json.successors)) {
        alert('Invalid transition config: must contain vestingDate and successors array.');
        return;
    }

    // Check for council name mismatches
    const uploadedCouncils = new Set(state.mergedArchitecture.councils);
    const mismatched = [];
    json.successors.forEach(s => {
        (s.fullPredecessors || []).concat(s.partialPredecessors || []).forEach(c => {
            if (!uploadedCouncils.has(c) && !mismatched.includes(c)) {
                mismatched.push(c);
            }
        });
    });

    const warningEl = document.getElementById('transitionImportWarning');
    const warningMsgEl = document.getElementById('transitionImportWarningMsg');
    if (mismatched.length > 0) {
        warningMsgEl.textContent = `The following councils in the imported config do not match any uploaded architecture: ${mismatched.join(', ')}. Unmatched councils have been excluded.`;
        warningEl.classList.remove('hidden');

        // Filter out unmatched councils from predecessors
        json.successors = json.successors.map(s => ({
            ...s,
            fullPredecessors: (s.fullPredecessors || []).filter(c => uploadedCouncils.has(c)),
            partialPredecessors: (s.partialPredecessors || []).filter(c => uploadedCouncils.has(c))
        }));
    } else {
        warningEl.classList.add('hidden');
    }

    state.transitionStructure = { vestingDate: json.vestingDate, successors: json.successors };
    renderTransitionConfigPanel();
    enforceTransitionConstraints();
    validateTransitionConfig();
}

function detectFromArchitecture() {
    const authorityMap = new Map(); // authority name → Set of council names that reference it

    state.rawUploads.forEach(upload => {
        const councilName = upload.data.councilName;
        (upload.data.nodes || []).forEach(node => {
            if (node.type === 'ITSystem' && Array.isArray(node.targetAuthorities)) {
                node.targetAuthorities.forEach(authority => {
                    if (!authorityMap.has(authority)) {
                        authorityMap.set(authority, new Set());
                    }
                    if (councilName) {
                        authorityMap.get(authority).add(councilName);
                    }
                });
            }
        });
    });

    if (authorityMap.size === 0) {
        alert('No targetAuthorities found in uploaded architecture files.');
        return;
    }

    const successors = Array.from(authorityMap.entries()).map(([name, councils]) => ({
        name,
        fullPredecessors: [],
        partialPredecessors: Array.from(councils)
    }));

    state.transitionStructure = { vestingDate: state.transitionStructure ? state.transitionStructure.vestingDate : null, successors };
    renderTransitionConfigPanel();
    enforceTransitionConstraints();
    validateTransitionConfig();
}

function updateExportButtonState() {
    const structure = collectTransitionStructure();
    const exportBtn = document.getElementById('btnExportTransition');
    if (exportBtn) {
        exportBtn.disabled = structure.successors.length === 0;
    }
}

document.getElementById('btnAddSuccessor').addEventListener('click', () => {
    addSuccessorRow();
});

document.getElementById('btnExportTransition').addEventListener('click', () => {
    exportTransitionStructure();
});

document.getElementById('btnImportTransition').addEventListener('click', () => {
    document.getElementById('transitionConfigInput').click();
});

document.getElementById('transitionConfigInput').addEventListener('click', (e) => e.stopPropagation());

document.getElementById('transitionConfigInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
        const json = JSON.parse(text);
        importTransitionStructure(json);
    } catch (err) {
        alert('Failed to parse JSON file. Please ensure the file is valid JSON.');
    }
    // Reset input so same file can be re-imported if needed
    e.target.value = '';
});

document.getElementById('btnDetectFromArch').addEventListener('click', () => {
    detectFromArchitecture();
});

let isReconfiguring = false;

document.getElementById('btnProceedTransition').addEventListener('click', () => {
    const structure = collectTransitionStructure();
    state.transitionStructure = structure.successors.length > 0 ? structure : null;
    deriveOperatingMode();
    stageTransitionConfig.classList.add('hidden');
    if (isReconfiguring) {
        isReconfiguring = false;
        controlsArea.classList.remove('hidden');
        stageDashboard.classList.remove('hidden');
        updatePersonaBanner();
        renderDashboard();
    } else {
        stageBaseline.classList.remove('hidden');
    }
});

document.getElementById('btnSkipTransition').addEventListener('click', () => {
    state.transitionStructure = null;
    state.operatingMode = 'discovery';
    stageTransitionConfig.classList.add('hidden');
    if (isReconfiguring) {
        isReconfiguring = false;
        controlsArea.classList.remove('hidden');
        stageDashboard.classList.remove('hidden');
        updatePersonaBanner();
        renderDashboard();
    } else {
        stageBaseline.classList.remove('hidden');
    }
});

document.getElementById('btnReconfigureTransition').addEventListener('click', () => {
    isReconfiguring = true;
    state.simulationState = null;
    tierMappingModal.classList.add('hidden');
    stageDashboard.classList.add('hidden');
    controlsArea.classList.add('hidden');
    stageTransitionConfig.classList.remove('hidden');
    renderTransitionConfigPanel();
});

// --- STAGE 2: BASELINING LOGIC ---
export function runBaselining() {
    state.mergedArchitecture = { nodes: [], edges: [], councils: new Set() };
    state.lgaFunctionMap.clear();
    state.councilTierMap.clear();
    state.distressedCouncils.clear();
    const validationErrors = [];

    state.rawUploads.forEach(upload => {
        const councilName = upload.data.councilName || upload.filename;
        state.mergedArchitecture.councils.add(councilName);

        upload.data.nodes.forEach(node => {
            if (node.type === 'Function') {
                if (!node.lgaFunctionId) {
                    validationErrors.push(`${councilName}: "${node.label}" (${node.id}) missing lgaFunctionId`);
                    return;
                }
                if (!state.lgaFunctionMap.has(node.lgaFunctionId)) {
                    const lgaFn = getLgaFunction(node.lgaFunctionId);
                    state.lgaFunctionMap.set(node.lgaFunctionId, {
                        lgaId: node.lgaFunctionId,
                        label: lgaFn ? lgaFn.label : node.label,
                        breadcrumb: getLgaBreadcrumb(node.lgaFunctionId),
                        councils: new Set(),
                        localNodeIds: new Set()
                    });
                }
                const entry = state.lgaFunctionMap.get(node.lgaFunctionId);
                entry.councils.add(councilName);
                entry.localNodeIds.add(node.id);
                state.mergedArchitecture.nodes.push({ ...node, _sourceCouncil: councilName });
            } else {
                state.mergedArchitecture.nodes.push({ ...node, _sourceCouncil: councilName });
            }
        });

        upload.data.edges.forEach(edge => {
            state.mergedArchitecture.edges.push({ ...edge, _sourceCouncil: councilName });
        });

        // Read council tier metadata (Requirement 10.1)
        const tier = upload.data.councilMetadata?.tier;
        if (tier && ['county', 'district', 'unitary'].includes(tier.toLowerCase())) {
            state.councilTierMap.set(councilName, tier.toLowerCase());
        }

        // Read financial distress flag (Requirement 9.1)
        if (upload.data.councilMetadata?.financialDistress === true) {
            state.distressedCouncils.add(councilName);
        }
    });

    // Populate Perspectives Dropdown
    perspectiveSelect.innerHTML = '<option value="all">Unitary (All Councils)</option>';
    Array.from(state.mergedArchitecture.councils).sort().forEach(c => {
        perspectiveSelect.innerHTML += `<option value="${c}">${c} Perspective</option>`;
    });

    // Populate Stage 2 edit buttons
    const stage2EditButtons = document.getElementById('stage2EditButtons');
    if (stage2EditButtons) {
        stage2EditButtons.innerHTML = '';
        state.rawUploads.forEach((upload, idx) => {
            const btn = document.createElement('button');
            btn.className = 'gds-btn-secondary px-3 py-1.5 text-sm font-bold hover:bg-gray-100';
            btn.setAttribute('data-upload-idx', idx);
            btn.textContent = `Edit: ${upload.data.councilName || upload.filename}`;
            wireEditArchBtn(btn);
            stage2EditButtons.appendChild(btn);
        });
    }

    const collisions = [...state.lgaFunctionMap.values()].filter(f => f.councils.size > 1).length;
    document.getElementById('countMatched').textContent = collisions;
    document.getElementById('countUnmatched').textContent = state.lgaFunctionMap.size - collisions;

    const errArea = document.getElementById('validationErrors');
    if (validationErrors.length > 0) {
        errArea.innerHTML = `<p class="font-bold text-[#d4351c] mb-2">${validationErrors.length} function node(s) missing lgaFunctionId — excluded from analysis:</p><ul class="list-disc pl-4 text-sm space-y-1 text-[#d4351c]">${validationErrors.map(e => `<li>${e}</li>`).join('')}</ul>`;
        errArea.classList.remove('hidden');
    } else {
        errArea.classList.add('hidden');
    }
}

document.getElementById('btnGenerateMatrix').addEventListener('click', () => {
    stageBaseline.classList.add('hidden');
    controlsArea.classList.remove('hidden');
    stageDashboard.classList.remove('hidden');
    updatePersonaBanner();
    renderDashboard();
});

// --- STAGE 3: DASHBOARD LOGIC (PERSONAS & PERSPECTIVES) ---
personaSelect.addEventListener('change', (e) => {
    state.activePersona = e.target.value;
    state.signalWeights = { ...PERSONA_DEFAULT_WEIGHTS[state.activePersona] };
    updatePersonaBanner();
    const analysisModalEl = document.getElementById('analysisModal');
    if (analysisModalEl) analysisModalEl.classList.add('hidden');
    renderDashboard();
});

perspectiveSelect.addEventListener('change', (e) => {
    state.activePerspective = e.target.value;
    const analysisModalEl = document.getElementById('analysisModal');
    if (analysisModalEl) analysisModalEl.classList.add('hidden');
    if (state.simulationState && (state.simulationState.decisions?.size > 0 || state.simulationState.actions?.length > 0)) {
        recomputeSimulation();
    } else {
        renderDashboard();
    }
});

// --- Sort/filter toolbar event handlers ---
document.getElementById('sortModeSelect').addEventListener('change', function(e) {
    state.activeSortMode = e.target.value;
    renderDashboard();
});

document.getElementById('filterTierSelect').addEventListener('change', function(e) {
    state.activeFilters.tier = e.target.value;
    renderDashboard();
});

document.getElementById('filterCollisionSelect').addEventListener('change', function(e) {
    state.activeFilters.collision = e.target.value;
    renderDashboard();
});

function updatePersonaBanner() {
    if (state.activePersona === 'commercial') {
        personaTitle.textContent = "Commercial & Transition View";
        personaTitle.className = "font-bold text-lg text-[#00703c]";
        personaBanner.className = "bg-[#eef7e6] border-b-2 border-[#00703c] p-4 flex gap-4 items-start transition-colors shrink-0";
        personaIcon.className = "w-8 h-8 text-[#00703c] shrink-0";
        personaDesc.textContent = "Focusing on notice periods, vendor density mapping, and procurement consolidation.";
        timelineSection.classList.remove('hidden');
    } else if (state.activePersona === 'architect') {
        personaTitle.textContent = "Enterprise Architect View";
        personaTitle.className = "font-bold text-lg text-[#53284f]";
        personaBanner.className = "bg-[#fbf5fb] border-b-2 border-[#53284f] p-4 flex gap-4 items-start transition-colors shrink-0";
        personaIcon.className = "w-8 h-8 text-[#53284f] shrink-0";
        personaDesc.textContent = "Focusing on anchor systems (gravity), tech debt, data monoliths, and API portability.";
        timelineSection.classList.add('hidden');
    } else if (state.activePersona === 'executive') {
        personaTitle.textContent = "Executive Board View (Consolidated)";
        personaTitle.className = "font-bold text-lg text-[#0b0c0c]";
        personaBanner.className = "bg-[#f3f2f1] border-b-2 border-[#0b0c0c] p-4 flex gap-4 items-start transition-colors shrink-0";
        personaIcon.className = "w-8 h-8 text-[#0b0c0c] shrink-0";
        personaDesc.textContent = "Synthesizing Day 1 survival, contract lock-ins, and strategic transition horizons.";
        timelineSection.classList.remove('hidden');
    }
    // Re-apply collapsed state after className overwrite
    if (state.bannerCollapsed) personaBanner.classList.add('banner-collapsed');

    // Show/hide Simulate button based on operating mode
    let btnSim = document.getElementById('btnSimulate');
    if (state.operatingMode === 'transition') {
        if (!btnSim) {
            btnSim = document.createElement('button');
            btnSim.id = 'btnSimulate';
            btnSim.className = 'gds-btn-secondary px-3 py-1.5 text-sm font-bold hover:bg-gray-100 border-[#f47738] text-[#f47738]';
            btnSim.textContent = 'Simulate';
            btnSim.addEventListener('click', function() {
                if (state.simulationState) {
                    exitSimulation();
                } else {
                    enterSimulation();
                }
            });
            const btnExport = document.getElementById('btnExportHTML');
            if (btnExport && btnExport.parentNode) {
                btnExport.parentNode.insertBefore(btnSim, btnExport);
            }
        }
        btnSim.classList.remove('hidden');
        btnSim.textContent = state.simulationState ? 'Exit Simulation' : 'Simulate';
    } else {
        if (btnSim) btnSim.classList.add('hidden');
    }
}

// --- Estate Summary Panel rendering ---
// Renders the estate summary panel above the matrix in Stage 3.
// Calls computeEstateSummaryMetrics() and renders two sections:
//   1. Estate Overview (always shown)
//   2. Transition Risk (Transition Planning mode only)
function renderEstateSummary() {
    var panel = document.getElementById('estateSummaryPanel');
    if (!panel) return;

    var metrics = computeEstateSummaryMetrics(
        state.mergedArchitecture, state.lgaFunctionMap, state.transitionStructure, state.successorAllocationMap, state.activePerspective
    );

    // Save critical path data for rendering below the matrix in renderDashboard()
    if (state.simulationState && state.simulationState.lastImpact) {
        window._criticalPathSystems = state.simulationState.lastImpact.after.criticalPathSystems;
    } else {
        window._criticalPathSystems = metrics.criticalPathSystems;
    }

    var perspectiveLabel = (state.activePerspective && state.activePerspective !== 'all') ? ' — ' + state.activePerspective : '';
    var html = '<div class="bg-white border-t-4 border-[#1d70b8] shadow-sm p-6">';
    html += '<h2 class="text-2xl font-bold mb-4">Estate Summary' + perspectiveLabel + helpIcon('metrics') + '</h2>';

    // --- Estate Overview section (always shown) ---
    html += '<div class="mb-6">';
    html += '<h3 class="text-lg font-bold mb-3 text-[#0b0c0c] border-b border-[#b1b4b6] pb-2">Estate Overview</h3>';

    if (state.simulationState && state.simulationState.lastImpact) {
        // Before/after comparison view when simulation is active
        html += renderBeforeAfterMetrics(state.simulationState.lastImpact);
    } else {
        html += '<div class="grid grid-cols-2 md:grid-cols-4 gap-4">';

        // Predecessor count
        html += '<div class="border border-gray-300 p-4 bg-[#f3f2f1]">';
        html += '<p class="text-3xl font-bold text-[#0b0c0c]">' + metrics.predecessorCount + '</p>';
        html += '<p class="text-sm font-bold text-gray-700">Predecessor councils</p>';
        html += '</div>';

        // Total systems
        html += '<div class="border border-gray-300 p-4 bg-[#f3f2f1]">';
        html += '<p class="text-3xl font-bold text-[#0b0c0c]">' + metrics.systemCount + '</p>';
        html += '<p class="text-sm font-bold text-gray-700">Total systems</p>';
        html += '</div>';

        // Collision count
        html += '<div class="border border-gray-300 p-4 bg-[#f3f2f1]">';
        html += '<p class="text-3xl font-bold text-[#0b0c0c]">' + metrics.collisionCount + '</p>';
        html += '<p class="text-sm font-bold text-gray-700">' + wrapWithTooltip('Cross-council collisions', DOMAIN_TERMS['Collision']) + '</p>';
        html += '</div>';

        // Total annual spend (only if available)
        if (metrics.totalAnnualSpend !== null) {
            html += '<div class="border border-gray-300 p-4 bg-[#f3f2f1]">';
            html += '<p class="text-3xl font-bold text-[#0b0c0c]">£' + metrics.totalAnnualSpend.toLocaleString() + '</p>';
            html += '<p class="text-sm font-bold text-gray-700">Total annual IT spend</p>';
            html += '</div>';
        }

        html += '</div>'; // close grid
    }

    html += '</div>'; // close Estate Overview section

    // --- Vendor Landscape section (Commercial persona only) ---
    if (state.activePersona === 'commercial') {
        var vendorRows = computeVendorDensityMetrics(metrics.filteredSystems);
        if (vendorRows.length > 0) {
            html += '<div class="mt-6">';
            html += '<h3 class="text-lg font-bold mb-3 text-[#00703c] border-b border-[#b1b4b6] pb-2">Vendor Landscape</h3>';
            html += '<div class="overflow-x-auto">';
            html += '<table class="gds-table text-sm">';
            html += '<thead><tr><th>Vendor</th><th>Systems</th><th>Councils</th><th>Annual Spend</th><th>Consolidation Opportunity</th></tr></thead>';
            html += '<tbody>';
            vendorRows.forEach(function(v) {
                var spendStr = v.totalSpend > 0 ? ('£' + v.totalSpend.toLocaleString()) : '—';
                var consolidationTag;
                if (v.councilCount >= 2) {
                    consolidationTag = '<span class="gds-tag tag-green">Cross-council — single contract opportunity</span>';
                } else if (v.systemCount >= 2) {
                    consolidationTag = '<span class="gds-tag tag-blue">Multiple systems — consolidation opportunity</span>';
                } else {
                    consolidationTag = '<span class="text-gray-500 text-xs">Single system</span>';
                }
                html += '<tr>';
                html += '<td class="font-bold">' + escHtml(v.vendor) + '</td>';
                html += '<td>' + v.systemCount + '</td>';
                html += '<td>' + v.councilCount + (v.councils.length ? ' (' + v.councils.map(escHtml).join(', ') + ')' : '') + '</td>';
                html += '<td>' + spendStr + '</td>';
                html += '<td>' + consolidationTag + '</td>';
                html += '</tr>';
            });
            html += '</tbody></table>';
            html += '</div>';
            html += '</div>';
        }
    }

    // --- Transition Risk section (Transition Planning mode only) ---
    if (state.operatingMode === 'transition' && state.transitionStructure) {
        html += '<div>';
        html += '<h3 class="text-lg font-bold mb-3 text-[#d4351c] border-b border-[#b1b4b6] pb-2">Transition Risk</h3>';
        html += '<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">';

        // Successor count
        var successorCount = state.transitionStructure.successors ? state.transitionStructure.successors.length : 0;
        html += '<div class="border border-gray-300 p-4 bg-red-50 border-l-4 border-l-[#d4351c]">';
        html += '<p class="text-3xl font-bold text-[#d4351c]">' + successorCount + '</p>';
        html += '<p class="text-sm font-bold text-gray-700">Successor authorities</p>';
        html += '</div>';

        // Vesting date
        html += '<div class="border border-gray-300 p-4 bg-red-50 border-l-4 border-l-[#d4351c]">';
        html += '<p class="text-xl font-bold text-[#d4351c]">' + state.transitionStructure.vestingDate + '</p>';
        html += '<p class="text-sm font-bold text-gray-700">' + wrapWithTooltip('Vesting date', DOMAIN_TERMS['Vesting Date']) + '</p>';
        html += '</div>';

        // Pre-vesting notice triggers
        if (metrics.preVestingNoticeCount !== null) {
            html += '<div class="border border-gray-300 p-4 bg-red-50 border-l-4 border-l-[#d4351c]">';
            html += '<p class="text-3xl font-bold text-[#d4351c]">' + metrics.preVestingNoticeCount + '</p>';
            html += '<p class="text-sm font-bold text-gray-700">Pre-vesting notice triggers</p>';
            html += '</div>';
        }

        // Disaggregation count
        if (metrics.disaggregationCount !== null) {
            html += '<div class="border border-gray-300 p-4 bg-red-50 border-l-4 border-l-[#d4351c]">';
            html += '<p class="text-3xl font-bold text-[#d4351c]">' + metrics.disaggregationCount + '</p>';
            html += '<p class="text-sm font-bold text-gray-700">Systems requiring disaggregation</p>';
            html += '</div>';
        }

        // Monolithic + disaggregation count
        if (metrics.monolithicDisaggregationCount !== null) {
            html += '<div class="border border-gray-300 p-4 bg-red-50 border-l-4 border-l-[#d4351c]">';
            html += '<p class="text-3xl font-bold text-[#d4351c]">' + metrics.monolithicDisaggregationCount + '</p>';
            html += '<p class="text-sm font-bold text-gray-700">Monolithic + disaggregation</p>';
            html += '</div>';
        }

        // Cross-boundary shared services
        if (metrics.crossBoundarySharedServiceCount !== null) {
            html += '<div class="border border-gray-300 p-4 bg-red-50 border-l-4 border-l-[#d4351c]">';
            html += '<p class="text-3xl font-bold text-[#d4351c]">' + metrics.crossBoundarySharedServiceCount + '</p>';
            html += '<p class="text-sm font-bold text-gray-700">Cross-boundary shared services</p>';
            html += '</div>';
        }

        html += '</div>'; // close grid
        html += '</div>'; // close Transition Risk section
    }

    html += '</div>'; // close panel wrapper

    panel.innerHTML = html;
    panel.classList.remove('hidden');
}

export function renderDashboard() {
    // Reset analysis modal data for this render
    state.analysisModalData = [];

    // Render estate summary panel at the top
    renderEstateSummary();

    // Render simulation workspace (shown when simulation is active)
    renderSimulationWorkspace();

    // Update persona banner Simulate button state
    updatePersonaBanner();

    // Show toolbar and sync dropdown values with current state
    const toolbar = document.getElementById('matrixToolbar');
    if (toolbar) {
        toolbar.classList.remove('hidden');
        const sortEl = document.getElementById('sortModeSelect');
        const filterTierEl = document.getElementById('filterTierSelect');
        const filterCollisionEl = document.getElementById('filterCollisionSelect');
        if (sortEl) sortEl.value = state.activeSortMode;
        if (filterTierEl) filterTierEl.value = state.activeFilters.tier;
        if (filterCollisionEl) filterCollisionEl.value = state.activeFilters.collision;
    }

    const head = document.getElementById('matrixHead');
    const body = document.getElementById('matrixBody');
    head.innerHTML = ''; body.innerHTML = '';

    // Branch data source: use simulated data if simulation is active
    let activeNodes, activeEdges;
    if (state.simulationState && state.simulationState.lastImpact) {
        const simResult = state.simulationState.lastImpact.simulationResult;
        activeNodes = simResult.nodes;
        activeEdges = simResult.edges;
    } else {
        activeNodes = state.mergedArchitecture.nodes;
        activeEdges = state.mergedArchitecture.edges;
    }

    const councilsArray = Array.from(state.simulationState && state.simulationState.lastImpact ? new Set(activeNodes.filter(n => n._sourceCouncil).map(n => n._sourceCouncil)) : state.mergedArchitecture.councils).sort();
    const systems = activeNodes.filter(n => n.type === 'ITSystem');

    // --- Build successor allocation map if in transition mode ---
    let localSuccessorAllocation = null;
    if (state.operatingMode === 'transition' && state.transitionStructure) {
        const allocResult = buildSuccessorAllocation(activeNodes, activeEdges, state.transitionStructure);
        localSuccessorAllocation = allocResult.allocation;
        state.successorAllocationMap = localSuccessorAllocation;
    }

    // --- Populate Perspective dropdown based on operating mode ---
    const perspectiveEl = document.getElementById('perspectiveSelect');
    if (state.operatingMode === 'transition' && state.transitionStructure && state.transitionStructure.successors) {
        const successorNames = state.transitionStructure.successors.map(s => s.name).sort();
        perspectiveEl.innerHTML = '<option value="all">All Successors</option>';
        successorNames.forEach(name => {
            perspectiveEl.innerHTML += `<option value="${name}"${state.activePerspective === name ? ' selected' : ''}>${name} Perspective</option>`;
        });
    } else {
        perspectiveEl.innerHTML = '<option value="all">Unitary (All Councils)</option>';
        councilsArray.forEach(c => {
            perspectiveEl.innerHTML += `<option value="${c}"${state.activePerspective === c ? ' selected' : ''}>${c} Perspective</option>`;
        });
    }

    // --- Build function rows with effective tier computation ---
    const vestingDate = state.transitionStructure?.vestingDate || null;
    const functionRows = [];

    [...state.lgaFunctionMap.values()].forEach(lgaFunc => {
        const funcEdges = activeEdges.filter(
            e => lgaFunc.localNodeIds.has(e.target) && e.relationship === 'REALIZES'
        );
        const sysIds = funcEdges.map(e => e.source);
        const relevantSystems = systems.filter(s => sysIds.includes(s.id));

        if (relevantSystems.length === 0) return;

        // Compute effective tier for this function
        const functionNode = { lgaFunctionId: lgaFunc.lgaId };
        const tierResult = computeEffectiveTier(functionNode, DEFAULT_TIER_MAP, vestingDate, relevantSystems);

        // Compute earliestNotice for urgency sort (earliest notice trigger date as fractional year)
        let earliestNotice = null;
        relevantSystems.forEach(function(sys) {
            if (!sys.endYear) return;
            const endMonth = sys.endMonth || 12;
            const noticePeriod = sys.noticePeriod || 0;
            const triggerFractional = sys.endYear + (endMonth / 12) - (noticePeriod / 12);
            if (earliestNotice === null || triggerFractional < earliestNotice) {
                earliestNotice = triggerFractional;
            }
        });

        functionRows.push({
            lgaFunc: lgaFunc,
            relevantSystems: relevantSystems,
            tier: tierResult.tier,
            promoted: tierResult.promoted,
            originalTier: tierResult.originalTier,
            collisionCount: lgaFunc.councils.size > 1 ? lgaFunc.councils.size : 0,
            label: lgaFunc.label,
            earliestNotice: earliestNotice
        });
    });

    // --- Apply filters before sorting ---
    let filteredRows = functionRows;
    if (state.activeFilters.tier !== 'all') {
        filteredRows = filteredRows.filter(function(r) { return r.tier === parseInt(state.activeFilters.tier); });
    }
    if (state.activeFilters.collision === 'collision') {
        filteredRows = filteredRows.filter(function(r) { return r.collisionCount > 1; });
    } else if (state.activeFilters.collision === 'unique') {
        filteredRows = filteredRows.filter(function(r) { return r.collisionCount <= 1; });
    }

    // --- Sort rows using active sort mode ---
    const sortedRows = sortFunctionRows(filteredRows);

    // Update row count display in toolbar
    const rowCountEl = document.getElementById('matrixRowCount');
    if (rowCountEl) {
        rowCountEl.textContent = `Showing ${sortedRows.length} of ${functionRows.length} functions`;
    }

    // ===================================================================
    // TRANSITION PLANNING MODE — successor columns
    // ===================================================================
    if (state.operatingMode === 'transition' && localSuccessorAllocation) {
        const successorNames = state.transitionStructure.successors.map(s => s.name).sort();

        // --- Headers: one per successor + Analysis ---
        let hHTML = `<tr><th class="w-[200px] shadow-[0_2px_0_#b1b4b6]">Standard Function</th>`;
        successorNames.forEach(name => {
            const isSelected = state.activePerspective === 'all' || state.activePerspective === name;
            const thClass = isSelected ? 'w-[280px] th-highlight' : 'w-[280px] shadow-[0_2px_0_#b1b4b6] col-dimmed';
            hHTML += `<th class="${thClass}">${name}</th>`;
        });
        hHTML += `<th class="w-[400px] shadow-[0_2px_0_#b1b4b6]">Analysis & Strategic Considerations</th></tr>`;
        head.innerHTML = hHTML;

        // --- Render rows ---
        sortedRows.forEach(row => {
            const lgaFunc = row.lgaFunc;
            const relevantSystems = row.relevantSystems;

            // Identify Anchor System
            let anchorSystem = null;
            if (relevantSystems.length > 1) {
                const sortedByUsers = [...relevantSystems].sort((a,b) => (b.users||0) - (a.users||0));
                const top = sortedByUsers[0];
                const second = sortedByUsers[1];
                if ((top.users || 0) >= (second.users || 0) * 1.5 && (top.users || 0) > 0) {
                    anchorSystem = top;
                }
            }

            // Build tier badge
            const tierBadgeClass = row.tier === 1 ? 'tag-red' : row.tier === 2 ? 'tag-orange' : 'tag-blue';
            const tierLabel = 'Tier ' + row.originalTier;
            const tierTooltipKey = 'Tier ' + row.originalTier;
            const tierTooltipText = DOMAIN_TERMS[tierTooltipKey] || '';
            let tierBadgeHtml = `<span class="gds-tag ${tierBadgeClass} mr-1">${wrapWithTooltip(tierLabel, tierTooltipText)}</span>`;
            if (row.promoted) {
                tierBadgeHtml += `<span class="text-[10px] text-[#f47738] font-bold block mt-0.5">Tier 3 → promoted to Tier 2</span>`;
            }

            const breadcrumbHtml = lgaFunc.breadcrumb
                ? `<span class="text-xs font-normal text-[#1d70b8] block mb-0.5">${lgaFunc.breadcrumb}</span>`
                : '';

            // Cross-tier collision annotation
            let crossTierHtml = '';
            if (relevantSystems.length > 1) {
                const crossTierResult = detectCrossTierCollision(relevantSystems, state.councilTierMap);
                if (crossTierResult.crossTier) {
                    const tierNames = crossTierResult.tiers.sort().join(' and ');
                    crossTierHtml = `<span class="block mt-1 text-[11px] font-normal" style="color:#f47738;">⚠ ${wrapWithTooltip('Cross-tier', DOMAIN_TERMS['Cross-tier'])}: ${tierNames} functions may represent complementary delivery, not duplication</span>`;
                }
            }

            // Decision progress for function label column (shown when simulation is active)
            let decisionProgressHtml = '';
            if (state.simulationState) {
                const successorNames_dp = state.transitionStructure ? state.transitionStructure.successors.map(s => s.name) : [];
                const allocMap_dp = state.simulationState.baselineAllocation || state.successorAllocationMap;
                const decisions_dp = state.simulationState.decisions || new Map();
                let decidableCount = 0, decidedCount_dp = 0, allDecided = true;
                successorNames_dp.forEach(sn => {
                    const sm = allocMap_dp ? allocMap_dp.get(sn) : null;
                    const cellAllocs = sm ? (sm.get(lgaFunc.lgaId) || []) : [];
                    if (cellAllocs.length >= 2) {
                        decidableCount++;
                        const dec = decisions_dp.get(getDecisionKey(lgaFunc.lgaId, sn));
                        if (dec) { decidedCount_dp++; } else { allDecided = false; }
                    }
                });
                if (decidableCount > 0) {
                    if (allDecided && decidedCount_dp === decidableCount) {
                        decisionProgressHtml = `<span class="block mt-1 text-[10px] font-bold text-[#00703c]">&#10003; All decided (${decidedCount_dp}/${decidableCount})</span>`;
                    } else {
                        decisionProgressHtml = `<span class="block mt-1 text-[10px] text-gray-500">${decidedCount_dp} of ${decidableCount} decided</span>`;
                    }
                }
            }

            let rowHTML = `<td class="font-bold text-base bg-white border-r">${breadcrumbHtml}${tierBadgeHtml}<br>${lgaFunc.label}<br><span class="text-[10px] font-normal text-gray-400 font-mono">esd:${lgaFunc.lgaId}</span>${crossTierHtml}${decisionProgressHtml}</td>`;

            // --- Successor columns ---
            // Collect all allocations across successors for the analysis column
            let allCellAllocations = [];

            successorNames.forEach(successorName => {
                const isSelected = state.activePerspective === 'all' || state.activePerspective === successorName;
                const tdClass = isSelected ? 'border-r col-highlight bg-white' : 'bg-gray-50 border-r col-dimmed';

                // Get allocations for this successor × function cell
                const successorMap = localSuccessorAllocation.get(successorName);
                const cellAllocations = successorMap ? (successorMap.get(lgaFunc.lgaId) || []) : [];

                // Compare with baseline for visual diff
                let diffClass = '';
                let ghostCardsHtml = '';
                let baselineIds = new Set();
                if (state.simulationState && state.simulationState.baselineAllocation) {
                    const baselineSuccMap = state.simulationState.baselineAllocation.get(successorName);
                    const baselineCellAllocs = baselineSuccMap ? (baselineSuccMap.get(lgaFunc.lgaId) || []) : [];
                    baselineIds = new Set(baselineCellAllocs.map(a => a.system.id));
                    const currentIds = new Set(cellAllocations.map(a => a.system.id));

                    const hasNew = cellAllocations.some(a => !baselineIds.has(a.system.id));
                    const removedAllocs = baselineCellAllocs.filter(a => !currentIds.has(a.system.id));
                    const isUnserved = cellAllocations.length === 0 && baselineCellAllocs.length > 0;

                    if (isUnserved) {
                        diffClass = ' border-l-4 border-l-[#d4351c]';
                    } else if (hasNew) {
                        diffClass = ' border-l-4 border-l-[#1d70b8]';
                    } else if (removedAllocs.length > 0 && cellAllocations.length > 0) {
                        diffClass = ' border-l-4 border-l-[#00703c]';
                    }

                    if (removedAllocs.length > 0) {
                        ghostCardsHtml = removedAllocs.map(a => {
                            const s = a.system;
                            return `<div class="sim-ghost-card"><span class="line-through">${escHtml(s.label)}</span> <span class="text-xs text-gray-400">${escHtml(s._sourceCouncil || '')}</span></div>`;
                        }).join('');
                    }
                }

                if (cellAllocations.length === 0) {
                    const isUnserved = state.simulationState && state.simulationState.baselineAllocation && (() => {
                        const bsm = state.simulationState.baselineAllocation.get(successorName);
                        return bsm && (bsm.get(lgaFunc.lgaId) || []).length > 0;
                    })();
                    if (isUnserved) {
                        rowHTML += `<td class="${tdClass} p-3 border-l-4 border-l-[#d4351c]">
                            <span class="gds-tag tag-red">UNSERVED</span>
                            <span class="text-gray-400 italic text-sm block mt-1">Previously served — no system allocated after simulation</span>
                            ${ghostCardsHtml}
                        </td>`;
                    } else {
                        rowHTML += `<td class="${tdClass} p-3"><span class="text-gray-400 italic text-sm">No system allocated</span></td>`;
                    }
                } else {
                    // Classify rationalisation pattern for this cell
                    const pattern = classifyRationalisationPattern(cellAllocations);
                    const patternTagHtml = renderPatternTag(pattern);

                    // Build system cards with provenance
                    const cellSystems = cellAllocations.map(a => a.system);
                    let systemCardsHtml = buildSystemCard(cellSystems, state.activePersona, anchorSystem, cellAllocations);

                    // Add NEW badges for systems not in baseline
                    if (state.simulationState && state.simulationState.baselineAllocation) {
                        cellAllocations.forEach(a => {
                            if (!baselineIds.has(a.system.id)) {
                                systemCardsHtml = systemCardsHtml.replace(
                                    `>${escHtml(a.system.label)}<`,
                                    `><span class="sim-new-badge">NEW</span> ${escHtml(a.system.label)}<`
                                );
                            }
                        });
                    }

                    // Decision affordances (shown when simulation is active in transition mode)
                    let decisionAffordanceHtml = '';
                    if (state.simulationState) {
                        const decisions_cell = state.simulationState.decisions || new Map();
                        const decKey = getDecisionKey(lgaFunc.lgaId, successorName);
                        const existingDecision = decisions_cell.get(decKey);

                        // Register function+successor for lookup in onclick via a data registry
                        // Using data attributes on the button to avoid inline string injection
                        const funcId_safe = escHtml(lgaFunc.lgaId);
                        const succName_safe = escHtml(successorName);

                        if (existingDecision) {
                            // Show decision badge + Edit link
                            let badgeHtml = '';
                            if (existingDecision.systemChoice === 'choose') {
                                const retainedId = existingDecision.retainedSystemIds && existingDecision.retainedSystemIds.length > 0
                                    ? existingDecision.retainedSystemIds[0] : null;
                                const retainedNode = retainedId && state.simulationState.baselineNodes
                                    ? state.simulationState.baselineNodes.find(n => n.id === retainedId) : null;
                                const sysLabel = retainedNode ? retainedNode.label : 'system';
                                badgeHtml = `<span class="inline-block text-xs font-bold px-2 py-0.5 rounded bg-green-100 text-green-800">Chose: ${escHtml(sysLabel)}</span>`;
                            } else if (existingDecision.systemChoice === 'defer') {
                                badgeHtml = `<span class="inline-block text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">Deferred</span>`;
                            } else if (existingDecision.systemChoice === 'procure') {
                                const procLabel = existingDecision.procuredSystem ? existingDecision.procuredSystem.label : 'New System';
                                badgeHtml = `<span class="inline-block text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">Procure: ${escHtml(procLabel)}</span>`;
                            }
                            decisionAffordanceHtml = `<div class="mt-2 flex items-center gap-2 flex-wrap">
                                ${badgeHtml}
                                <button class="text-xs text-[#1d70b8] underline sim-decide-btn"
                                        data-func-id="${funcId_safe}" data-successor="${succName_safe}"
                                        type="button">Edit</button>
                            </div>`;
                        } else if (cellAllocations.length >= 2) {
                            // Undecided cell with competing systems: show Decide link
                            decisionAffordanceHtml = `<div class="mt-2">
                                <button class="text-xs font-bold text-[#1d70b8] underline sim-decide-btn"
                                        data-func-id="${funcId_safe}" data-successor="${succName_safe}"
                                        type="button">Decide</button>
                            </div>`;
                        }
                    }

                    // decisionAffordanceHtml goes BEFORE system cards so Decide/Edit is visible at the top
                    const decisionAffordanceTop = decisionAffordanceHtml
                        ? decisionAffordanceHtml.replace('mt-2', 'mb-2')
                        : '';
                    rowHTML += `<td class="${tdClass}${diffClass} p-3">${patternTagHtml}${decisionAffordanceTop}<div class="mt-2">${systemCardsHtml}</div>${ghostCardsHtml}</td>`;

                    // Collect for analysis
                    const taggedAllocations = cellAllocations.map(a => ({ ...a, _successorName: successorName }));
                    allCellAllocations = allCellAllocations.concat(taggedAllocations);
                }
            });

            // --- Analysis column: compute signals per-successor-cell with emphasis ---
            // In transition mode, pass allocations so buildPersonaAnalysis applies emphasis
            let analysisSystems = relevantSystems;
            let analysisAllocations = allCellAllocations;
            let analysisAnchor = anchorSystem;

            if (state.activePerspective !== 'all') {
                analysisAllocations = allCellAllocations.filter(a => a._successorName === state.activePerspective);
                const perspectiveSystemIds = new Set(analysisAllocations.map(a => a.system?.id));
                analysisSystems = relevantSystems.filter(s => perspectiveSystemIds.has(s.id));
                analysisAnchor = null;
                if (analysisSystems.length > 1) {
                    const sorted = [...analysisSystems].sort((a,b) => (b.users||0) - (a.users||0));
                    if ((sorted[0].users||0) >= (sorted[1].users||0) * 1.5 && (sorted[0].users||0) > 0) {
                        analysisAnchor = sorted[0];
                    }
                }
            }

            const analysis = buildPersonaAnalysis(analysisSystems, state.activePersona, state.activePerspective, analysisAnchor, analysisAllocations, lgaFunc.label, { tier: row.tier, originalTier: row.originalTier, promoted: row.promoted });
            rowHTML += `<td class="bg-white p-4">${analysis}</td>`;

            const tr = document.createElement('tr');
            tr.innerHTML = rowHTML;
            body.appendChild(tr);
        });

        // Wire up "Decide" / "Edit" button clicks via event delegation on the matrix body.
        // We use a module-level named handler so we can remove and re-add it on each render,
        // avoiding duplicate listeners as renderDashboard is called multiple times.
        if (body._simDecideHandler) {
            body.removeEventListener('click', body._simDecideHandler);
        }
        body._simDecideHandler = function(e) {
            const btn = e.target.closest('.sim-decide-btn');
            if (!btn) return;
            const funcId = btn.dataset.funcId;
            const successorName = btn.dataset.successor;
            if (funcId && successorName) {
                openDecisionPanel(funcId, successorName);
            }
        };
        body.addEventListener('click', body._simDecideHandler);

        if(state.activePersona !== 'architect') drawTimeline(systems, councilsArray);
        renderCriticalPathPanel();
        return;
    }

    // ===================================================================
    // ESTATE DISCOVERY MODE — predecessor columns (existing rendering)
    // ===================================================================

    // --- Headers ---
    let hHTML = `<tr><th class="w-[200px] shadow-[0_2px_0_#b1b4b6]">Standard Function</th>`;
    councilsArray.forEach(c => {
        const isSelected = state.activePerspective === 'all' || state.activePerspective === c;
        const thClass = isSelected ? 'w-[280px] th-highlight' : 'w-[280px] shadow-[0_2px_0_#b1b4b6] col-dimmed';
        const tierLabel = state.councilTierMap.get(c);
        const tierHtml = tierLabel ? `<br><span style="font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;opacity:0.85;">${tierLabel.toUpperCase()}</span>` : '';
        const distressHtml = state.distressedCouncils.has(c) ? `<br><span style="font-size:11px;color:#d4351c;font-weight:bold;cursor:help;" title="Predecessor in financial distress — verify system currency, support status, and licence compliance.">⚠ Financial distress</span>` : '';
        hHTML += `<th class="${thClass}">${c}${tierHtml}${distressHtml}</th>`;
    });
    hHTML += `<th class="w-[400px] shadow-[0_2px_0_#b1b4b6]">Analysis & Strategic Considerations</th></tr>`;
    head.innerHTML = hHTML;

    // --- Render rows ---
    sortedRows.forEach(row => {
        const lgaFunc = row.lgaFunc;
        const relevantSystems = row.relevantSystems;

        // Identify Anchor System (Proportionality Logic: >50% larger than next biggest)
        let anchorSystem = null;
        if (relevantSystems.length > 1) {
            const sortedByUsers = [...relevantSystems].sort((a,b) => (b.users||0) - (a.users||0));
            const top = sortedByUsers[0];
            const second = sortedByUsers[1];
            if ((top.users || 0) >= (second.users || 0) * 1.5 && (top.users || 0) > 0) {
                anchorSystem = top;
            }
        }

        // Build tier badge
        const tierBadgeClass = row.tier === 1 ? 'tag-red' : row.tier === 2 ? 'tag-orange' : 'tag-blue';
        const tierLabel = 'Tier ' + row.originalTier;
        const tierTooltipKey = 'Tier ' + row.originalTier;
        const tierTooltipText = DOMAIN_TERMS[tierTooltipKey] || '';
        let tierBadgeHtml = `<span class="gds-tag ${tierBadgeClass} mr-1">${wrapWithTooltip(tierLabel, tierTooltipText)}</span>`;
        if (row.promoted) {
            tierBadgeHtml += `<span class="text-[10px] text-[#f47738] font-bold block mt-0.5">Tier 3 → promoted to Tier 2</span>`;
        }

        const breadcrumbHtml = lgaFunc.breadcrumb
            ? `<span class="text-xs font-normal text-[#1d70b8] block mb-0.5">${lgaFunc.breadcrumb}</span>`
            : '';

        // Cross-tier collision annotation (Requirement 10.3)
        let crossTierHtml = '';
        if (relevantSystems.length > 1) {
            const crossTierResult = detectCrossTierCollision(relevantSystems, state.councilTierMap);
            if (crossTierResult.crossTier) {
                const tierNames = crossTierResult.tiers.sort().join(' and ');
                crossTierHtml = `<span class="block mt-1 text-[11px] font-normal" style="color:#f47738;">⚠ ${wrapWithTooltip('Cross-tier', DOMAIN_TERMS['Cross-tier'])}: ${tierNames} functions may represent complementary delivery, not duplication</span>`;
            }
        }

        let rowHTML = `<td class="font-bold text-base bg-white border-r">${breadcrumbHtml}${tierBadgeHtml}<br>${lgaFunc.label}<br><span class="text-[10px] font-normal text-gray-400 font-mono">esd:${lgaFunc.lgaId}</span>${crossTierHtml}</td>`;

        councilsArray.forEach(council => {
            const councilSystems = relevantSystems.filter(s => s._sourceCouncil === council);
            const isSelected = state.activePerspective === 'all' || state.activePerspective === council;
            const tdClass = isSelected ? 'border-r col-highlight bg-white' : 'bg-gray-50 border-r col-dimmed';

            rowHTML += `<td class="${tdClass} p-3">${buildSystemCard(councilSystems, state.activePersona, anchorSystem)}</td>`;
        });

        let analysisSystems = relevantSystems;
        let analysisAnchor = anchorSystem;

        if (state.activePerspective !== 'all') {
            analysisSystems = relevantSystems.filter(s => s._sourceCouncil === state.activePerspective);
            analysisAnchor = null;
            if (analysisSystems.length > 1) {
                const sorted = [...analysisSystems].sort((a,b) => (b.users||0) - (a.users||0));
                if ((sorted[0].users||0) >= (sorted[1].users||0) * 1.5 && (sorted[0].users||0) > 0) {
                    analysisAnchor = sorted[0];
                }
            }
        }

        const analysis = buildPersonaAnalysis(analysisSystems, state.activePersona, state.activePerspective, analysisAnchor, null, lgaFunc.label, { tier: row.tier, originalTier: row.originalTier, promoted: row.promoted });
        rowHTML += `<td class="bg-white p-4">${analysis}</td>`;

        const tr = document.createElement('tr');
        tr.innerHTML = rowHTML;
        body.appendChild(tr);
    });

    if(state.activePersona !== 'architect') drawTimeline(systems, councilsArray);
    renderCriticalPathPanel();

    // Flip tooltips below trigger when near top of scrollable matrix container
    const matrixContainer = document.querySelector('#dashboardMatrix')?.closest('.overflow-auto');
    if (matrixContainer && !matrixContainer._tooltipFlipWired) {
        matrixContainer._tooltipFlipWired = true;
        function checkTooltipFlip(tw) {
            if (!tw) return;
            const cRect = matrixContainer.getBoundingClientRect();
            const tRect = tw.getBoundingClientRect();
            if (tRect.top - cRect.top < 140) tw.classList.add('tooltip-below');
            else tw.classList.remove('tooltip-below');
        }
        // Use mouseover (bubbles) instead of mouseenter (doesn't bubble reliably in capture)
        matrixContainer.addEventListener('mouseover', function(e) {
            checkTooltipFlip(e.target.closest('.tooltip-wrapper'));
        });
        matrixContainer.addEventListener('mouseout', function(e) {
            const tw = e.target.closest('.tooltip-wrapper');
            if (tw) tw.classList.remove('tooltip-below');
        });
        // Re-check on scroll in case user scrolls while hovering
        matrixContainer.addEventListener('scroll', function() {
            const hovered = matrixContainer.querySelector('.tooltip-wrapper:hover');
            checkTooltipFlip(hovered);
        });
    }
}

function renderCriticalPathPanel() {
    var cpPanel = document.getElementById('criticalPathPanel');
    if (!cpPanel) return;
    var cpSystems = window._criticalPathSystems;
    if (state.activePersona !== 'executive' || !cpSystems || cpSystems.length === 0) {
        cpPanel.innerHTML = '';
        return;
    }
    var cpTotal = cpSystems.length;
    var cpDisplay = cpSystems.slice(0, 10);
    var html = '<div class="bg-white border-t-4 border-[#d4351c] shadow-sm p-6">';
    html += '<h3 class="text-lg font-bold mb-3 text-white bg-[#d4351c] border-b border-[#b1b4b6] pb-2 px-3 pt-2">Critical Path — Pre-Vesting Contract Decisions</h3>';
    html += '<div class="overflow-x-auto">';
    html += '<table class="gds-table text-sm">';
    html += '<thead><tr><th>System</th><th>Vendor</th><th>Predecessor</th><th>Notice Trigger</th><th>Months Before Vesting</th><th>Contract End</th></tr></thead>';
    html += '<tbody>';
    var today = new Date();
    var currentMonth = today.getFullYear() * 12 + (today.getMonth() + 1);
    cpDisplay.forEach(function(cp) {
        var isOverdue = cp.triggerMonth < currentMonth;
        var isUrgent = !isOverdue && cp.monthsBeforeVesting <= 6;
        var rowClass = isOverdue ? 'text-red-700 font-bold' : isUrgent ? 'text-orange-700 font-bold' : '';
        var statusLabel = isOverdue ? '<span class="gds-tag tag-red ml-2">OVERDUE</span>' : isUrgent ? '<span class="gds-tag tag-orange ml-2">URGENT</span>' : '';
        var triggerStr = String(cp.triggerM).padStart(2, '0') + '/' + cp.triggerY;
        var endStr = String(cp.endMonth).padStart(2, '0') + '/' + cp.endYear;
        html += '<tr class="' + rowClass + '">';
        html += '<td>' + escHtml(cp.label) + '</td>';
        html += '<td>' + escHtml(cp.vendor) + '</td>';
        html += '<td>' + escHtml(cp.sourceCouncil) + '</td>';
        html += '<td>' + triggerStr + statusLabel + '</td>';
        html += '<td>' + cp.monthsBeforeVesting + ' months</td>';
        html += '<td>' + endStr + '</td>';
        html += '</tr>';
    });
    html += '</tbody></table>';
    if (cpTotal > 10) {
        html += '<p class="text-xs text-gray-500 mt-2">Showing 10 of ' + cpTotal + ' pre-vesting notice triggers</p>';
    }
    html += '</div>';
    html += '</div>';
    cpPanel.innerHTML = html;
}

function buildSystemCard(sysList, persona, anchorSystem, allocations) {
    if (sysList.length === 0) return `<span class="text-gray-400 italic text-sm">No system mapped</span>`;
    let html = '';
    sysList.forEach((sys, idx) => {
        const isAnchor = anchorSystem && sys.id === anchorSystem.id;
        const borderClass = isAnchor ? 'border-[#ffdd00] border-2' : (persona === 'architect' && sys.dataPartitioning === 'Monolithic' ? 'border-[#53284f] border-l-4' : 'border-gray-300');
        
        html += `<div class="mb-3 bg-white p-3 border shadow-sm ${borderClass} relative">`;
        
        if (isAnchor) html += `<div class="absolute -top-2 -right-2 anchor-badge">${wrapWithTooltip('Anchor System', DOMAIN_TERMS['Anchor System'])}</div>`;
        
        html += `<strong class="block mb-1 text-[#0b0c0c] text-base">${sys.label}</strong>`;

        // Provenance label — show source predecessor in transition mode
        const alloc = allocations ? allocations[idx] : null;
        if (alloc && alloc.sourceCouncil) {
            html += `<span class="block text-[10px] text-gray-500 italic mb-1">from ${alloc.sourceCouncil}</span>`;
        }

        // Council tier badge (Requirement 10.1, 10.2)
        const councilTier = sys._sourceCouncil ? state.councilTierMap.get(sys._sourceCouncil) : null;
        if (councilTier) {
            const tierBadgeColor = councilTier === 'county' ? 'tag-purple' : councilTier === 'district' ? 'tag-blue' : 'tag-green';
            html += `<span class="gds-tag ${tierBadgeColor}" style="font-size:10px;padding:2px 6px;margin-bottom:4px;" title="Council tier: ${councilTier}">${councilTier.toUpperCase()}</span>`;
        }

        // Financial distress warning banner (Requirement 9.2)
        if (sys._sourceCouncil && state.distressedCouncils.has(sys._sourceCouncil)) {
            html += `<div class="mb-2 p-2 border-l-4 border-l-[#d4351c] bg-red-50"><p class="text-xs font-bold text-[#d4351c]">⚠ Predecessor in financial distress — verify system currency, support status, and licence compliance.</p></div>`;
        }

        // Shared service indicator (Requirement 6.2)
        if (sys.sharedWith && Array.isArray(sys.sharedWith) && sys.sharedWith.length > 0) {
            html += `<div class="mb-2 flex items-center gap-1">
                <span class="gds-tag tag-blue" style="font-size:10px;padding:2px 6px;">${wrapWithTooltip('Shared service', DOMAIN_TERMS['Shared Service'])}</span>
                <span class="text-[11px] text-gray-600">with ${sys.sharedWith.join(', ')}</span>
            </div>`;
        }

        html += `<div class="flex gap-2 text-[11px] text-gray-600 font-bold uppercase tracking-wide mb-3">
                    <span class="tooltip-label" title="Scale/Gravity">👥 ${sys.users ? sys.users.toLocaleString() : '??'} Users</span>
                    ${sys.vendor ? `<span class="tooltip-label" title="Software Vendor">🏢 ${sys.vendor}</span>` : ''}
                 </div>`;

        // Disaggregation flag for partial predecessors (Requirement 7)
        // Check allocation metadata if provided, otherwise fall back to sys property
        const showDisaggregationFlag = alloc ? alloc.needsAllocationReview : sys.needsAllocationReview;
        if (showDisaggregationFlag) {
            let flagHtml = `<div class="mb-3 p-2 border-l-4 border-l-[#f47738] bg-yellow-50">`;
            flagHtml += `<p class="text-xs font-bold text-[#0b0c0c]">⚠ Partial predecessor — this system may serve multiple successors. Allocation review required.</p>`;
            if (sys.dataPartitioning === 'Monolithic') {
                flagHtml += `<p class="text-xs font-bold text-[#d4351c] mt-1">⚠ Highest-risk combination: monolithic data requiring disaggregation</p>`;
            } else if (sys.dataPartitioning === 'Segmented') {
                flagHtml += `<p class="text-xs text-[#1d70b8] mt-1">Geographic data partitioning may be feasible</p>`;
            }
            flagHtml += `</div>`;
            html += flagHtml;
        }
        
        if (persona === 'commercial' || persona === 'executive') {
            const noticeMonths = sys.noticePeriod || 0;
            const expStr = `${String(sys.endMonth || 1).padStart(2,'0')}/${sys.endYear || 2025}`;
            let riskColor = 'text-gray-700';
            if (sys.endYear === 2025 || (sys.endYear === 2026 && noticeMonths > 6)) riskColor = 'text-red-700 font-bold';

            html += `
                <div class="text-xs mt-2 border-t pt-3 space-y-3">
                    <div class="flex justify-between gap-4 items-start w-full">
                        <span class="text-gray-500 uppercase shrink-0 tooltip-label" title="Annual operating cost">Cost</span> 
                        <strong class="text-right max-w-[60%] break-words">${sys.cost || 'N/A'}</strong>
                    </div>
                    <div class="flex justify-between gap-4 items-start w-full">
                        <span class="text-gray-500 uppercase shrink-0 tooltip-label" title="End date / Notice Period">Contract</span> 
                        <span class="${riskColor} text-right max-w-[60%] break-words">${expStr} <br><span class="text-[10px] text-gray-500 font-normal">(${noticeMonths}mo notice)</span></span>
                    </div>
                </div>`;
        } 
        if (persona === 'architect' || persona === 'executive') {
            const cloudLabel = sys.isCloud ? 'Cloud' : 'On-Prem';
            const cloudTooltip = sys.isCloud ? 'Externally hosted SaaS or Cloud architecture.' : 'Locally hosted on physical council servers.';
            const cloudTagColor = sys.isCloud ? 'tag-green' : 'tag-outline';
            const cloudTag = `<span class="gds-tag ${cloudTagColor}">${wrapWithTooltip(cloudLabel, cloudTooltip)}</span>`;
            const portColor = sys.portability?.includes('Low') ? 'text-red-700 font-medium' : 'text-green-700 font-medium';
            html += `
                <div class="mb-2 mt-2">${cloudTag}</div>
                <div class="text-xs space-y-3 mt-2 border-t pt-3">
                    <div class="flex justify-between gap-4 items-start w-full">
                        <span class="text-gray-500 uppercase shrink-0">${wrapWithTooltip('Portability', DOMAIN_TERMS['Portability'])}</span>
                        <span class="${portColor} text-right break-words max-w-[60%]">${sys.portability || 'Unknown'}</span>
                    </div>
                    <div class="flex justify-between gap-4 items-start w-full">
                        <span class="text-gray-500 uppercase shrink-0">${wrapWithTooltip('Data Layer', DOMAIN_TERMS['Data Layer'])}</span>
                        <span class="text-right break-words max-w-[60%]">${sys.dataPartitioning || 'Unknown'}</span>
                    </div>
                </div>`;
        }
        html += `</div>`;
    });
    return html;
}

// --- Rationalisation pattern tag rendering ---
// Returns HTML for a colour-coded pattern tag to display at the top
// of each function × successor cell in Transition Planning mode.
function renderPatternTag(pattern) {
    const patternConfig = {
        'inherit-as-is':                      { colour: 'tag-green',  label: 'Inherit as-is' },
        'choose-and-consolidate':             { colour: 'tag-blue',   label: 'Choose & consolidate' },
        'extract-and-partition':               { colour: 'tag-red',    label: 'Extract & partition' },
        'extract-partition-and-consolidate':   { colour: 'tag-purple', label: 'Extract, partition & consolidate' }
    };
    const config = patternConfig[pattern] || patternConfig['inherit-as-is'];
    return '<span class="gds-tag ' + config.colour + '">' + config.label + '</span>';
}

function renderPatternTagWithTooltip(pattern) {
    const patternConfig = {
        'inherit-as-is':                      { colour: 'tag-green',  label: 'Inherit as-is' },
        'choose-and-consolidate':             { colour: 'tag-blue',   label: 'Choose & consolidate' },
        'extract-and-partition':               { colour: 'tag-red',    label: 'Extract & partition' },
        'extract-partition-and-consolidate':   { colour: 'tag-purple', label: 'Extract, partition & consolidate' }
    };
    const config = patternConfig[pattern] || patternConfig['inherit-as-is'];
    const tooltip = wrapWithTooltip(config.label, DOMAIN_TERMS['Rationalisation Pattern']);
    return `<span class="gds-tag ${config.colour}">${tooltip}</span>${helpIcon('patterns')}`;
}

function renderSignalRow(sig) {
    const w = sig.weight;
    if (w === 1) {
        return `<p class="text-[11px] text-gray-400 leading-tight"><span class="font-bold">${sig.label}:</span> ${sig.value}</p>`;
    }
    const badge = w >= 3
        ? `<span class="gds-tag ${sig.tag} text-[9px] mb-1">${sig.label}</span>`
        : `<span class="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-0.5">${sig.label}</span>`;
    const textClass = w >= 3 ? 'text-sm' : 'text-sm text-gray-600';
    const border = (w >= 3 && sig.strong) ? `border-l-2 pl-2 ${sig.border}` : '';
    return `<div class="${border}">${badge}<p class="${textClass}">${sig.value}</p></div>`;
}

// Maps a signal tag class to a signal-dot CSS class
function tagToSignalDotClass(tag) {
    const map = {
        'tag-red':    'signal-dot-red',
        'tag-orange': 'signal-dot-amber',
        'tag-blue':   'signal-dot-blue',
        'tag-purple': 'signal-dot-purple',
        'tag-black':  'signal-dot-black',
        'tag-green':  'signal-dot-green',
    };
    return map[tag] || 'signal-dot-blue';
}

// Renders a horizontal row of signal indicator pills
function renderSignalStrip(signals) {
    if (!signals || signals.length === 0) return '';
    const pills = signals.map(sig => {
        const dotClass = tagToSignalDotClass(sig.tag);
        // Abbreviated label: first word or first 8 chars
        const abbrev = sig.label.split(' ')[0].substring(0, 10);
        return `<span class="signal-dot ${dotClass}" title="${sig.label}: ${sig.value}">${abbrev}</span>`;
    }).join('');
    return `<div class="flex flex-wrap gap-1.5 mt-1">${pills}</div>`;
}

// Builds compact analysis cell: pattern tag + signal strip + headline + "View full analysis" link
function renderCompactAnalysis(signals, pattern, systems, anchorSystem, persona, allocations, functionLabel, tierInfo) {
    const index = state.analysisModalData.length;
    state.analysisModalData.push({ signals, pattern, systems, anchorSystem, persona, allocations, functionLabel, tierInfo });

    const patternTagHtml = pattern ? renderPatternTagWithTooltip(pattern) : '';
    const signalStrip = renderSignalStrip(signals);
    const signalHelpIcon = helpIcon('signals');
    const headline = getHeadlineMetrics(signals, pattern);
    const headlineHtml = headline
        ? `<p class="text-xs text-gray-700 mt-1 leading-snug"><span class="font-bold">${headline.label}:</span> ${headline.value.substring(0, 120)}${headline.value.length > 120 ? '…' : ''}</p>`
        : '';
    const viewLink = `<a href="#" class="text-xs font-bold text-[#1d70b8] underline mt-2 block hover:text-[#003078]" onclick="event.preventDefault();openAnalysisModal(${index})">View full analysis →</a>`;

    return `<div>${patternTagHtml}${signalStrip ? `<div class="flex items-center gap-1">${signalStrip}${signalHelpIcon}</div>` : ''}${headlineHtml}${viewLink}</div>`;
}

function buildPersonaAnalysis(systems, persona, perspective, anchorSystem, allocations, functionLabel, tierInfo) {
    // In Transition Planning mode, apply signal emphasis based on rationalisation pattern
    // This is display-time only — does not modify the user's state.signalWeights
    let weightsOverride = null;
    let pattern = null;
    if (state.operatingMode === 'transition' && allocations && allocations.length > 0) {
        pattern = classifyRationalisationPattern(allocations);
        const emphasized = computeSignalEmphasis(pattern, state.signalWeights);
        weightsOverride = emphasized;
    }
    const signals = computeSignals(systems, weightsOverride);

    if (systems.length <= 1) {
        // Single-system cell: compact signal strip but no "View full analysis" link
        const sigStrip = signals.length > 0 ? renderSignalStrip(signals) : '';
        return `<span class="gds-tag tag-green text-[9px]">No collision</span>${sigStrip}`;
    }
    if (signals.length === 0) return `<p class="text-sm text-gray-400 italic">All signals disabled — use Signal Options to enable.</p>`;
    return renderCompactAnalysis(signals, pattern, systems, anchorSystem, persona, allocations, functionLabel || '', tierInfo);
}

// =======================================================================
// ANALYSIS MODAL — Phase 3 (AC-3): Pattern explanation, TCoP, metrics
// =======================================================================

function renderPatternExplanation(pattern) {
    const explanations = {
        'inherit-as-is': {
            heading: 'Inherit As-Is',
            body: 'A single system serves this function within the successor. No rationalisation decision is required at vesting. The system will continue operating under the new authority. Priority actions: confirm contract ownership transfers correctly to the successor, verify data migration is not required, and check whether the system licence allows continued use under the new entity.',
            actions: ['Confirm contract assignment/novation', 'Verify licence covers new authority name', 'Confirm no data partitioning needed']
        },
        'choose-and-consolidate': {
            heading: 'Choose and Consolidate',
            body: 'Multiple systems from different predecessor councils serve the same function within this successor. A selection decision is required: one system will be retained and others decommissioned. This requires careful analysis of user volume, contract timelines, vendor relationships, and data migration complexity.',
            actions: ['Select consolidation candidate based on user volume, cost, and portability', 'Plan data migration from decommissioned systems', 'Review notice periods to sequence decommission', 'Assess vendor consolidation opportunity']
        },
        'extract-and-partition': {
            heading: 'Extract and Partition',
            body: 'A system serves this function across multiple successors and must be split. The data and/or service must be partitioned so each successor can operate independently. This is architecturally complex — particularly where data is monolithic or the system is an ERP. ETL planning and parallel running periods are typically required.',
            actions: ['Assess data partitioning feasibility (segmented vs monolithic)', 'Plan ETL extraction and parallel running', 'Clarify contract splitting/novation with vendor', 'Identify interim shared service governance if needed']
        },
        'extract-partition-and-consolidate': {
            heading: 'Extract, Partition and Consolidate',
            body: 'The most complex pattern: systems must be both split across successors and consolidated within each successor. Multiple predecessor systems serve multiple successors. Each successor needs a single rationalised system, but the data must first be extracted and partitioned from shared or crossing systems. Requires sequenced delivery: partition first, then consolidate.',
            actions: ['Map which system data belongs to which successor', 'Plan extraction and partition before consolidation', 'Sequence decommissions to avoid data loss', 'Consider interim hosting and governance arrangements']
        }
    };
    const cfg = explanations[pattern] || explanations['inherit-as-is'];
    const actionsHtml = cfg.actions.map(a => `<li class="text-sm text-gray-700">${a}</li>`).join('');
    return `
        <div class="bg-[#f3f2f1] border-l-4 border-[#1d70b8] p-4 mb-4">
            <p class="text-sm text-gray-800 leading-relaxed mb-3">${cfg.body}</p>
            <p class="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Key Actions</p>
            <ul class="list-disc pl-5 space-y-0.5">${actionsHtml}</ul>
        </div>`;
}

function renderTcopSection(systems) {
    if (!systems || systems.length === 0) return '';
    let html = '<div class="space-y-3">';
    systems.forEach(sys => {
        const assessment = computeTcopAssessment(sys);
        const alignmentsHtml = assessment.alignments.map(a =>
            `<li class="flex items-start gap-2 text-sm text-[#00703c]"><span class="shrink-0 font-bold">&#10003;</span><span>${a.description}</span></li>`
        ).join('');
        const concernsHtml = assessment.concerns.map(c =>
            `<li class="flex items-start gap-2 text-sm text-[#d4351c]"><span class="shrink-0 font-bold">&#9888;</span><span>${c.description}</span></li>`
        ).join('');
        const noItems = assessment.alignments.length === 0 && assessment.concerns.length === 0;
        html += `
            <div class="border border-gray-200 p-3 bg-white">
                <p class="font-bold text-sm mb-2">${sys.label || 'System'}</p>
                <ul class="space-y-1">
                    ${alignmentsHtml}
                    ${concernsHtml}
                    ${noItems ? '<li class="text-sm text-gray-400 italic">No TCoP signals detected for this system.</li>' : ''}
                </ul>
            </div>`;
    });
    html += '</div>';
    return html;
}

function renderKeyMetrics(systems, signals) {
    const totalUsers = systems.reduce((sum, s) => sum + (s.users || 0), 0);
    const totalCost = systems.reduce((sum, s) => sum + (s.annualCost || 0), 0);
    const onPremCount = systems.filter(s => !s.isCloud).length;
    const monoCount = systems.filter(s => s.dataPartitioning === 'Monolithic' || s.isERP).length;

    const fmt = n => n >= 1000000 ? `£${(n/1000000).toFixed(1)}m` : n >= 1000 ? `£${(n/1000).toFixed(0)}k` : `£${n}`;

    return `
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div class="bg-[#f3f2f1] p-3 text-center">
                <p class="text-xl font-bold">${totalUsers > 0 ? totalUsers.toLocaleString() : '—'}</p>
                <p class="text-xs text-gray-500 uppercase tracking-wide">Total Users</p>
            </div>
            <div class="bg-[#f3f2f1] p-3 text-center">
                <p class="text-xl font-bold">${totalCost > 0 ? fmt(totalCost) : '—'}</p>
                <p class="text-xs text-gray-500 uppercase tracking-wide">Annual Cost</p>
            </div>
            <div class="bg-[#f3f2f1] p-3 text-center">
                <p class="text-xl font-bold">${onPremCount}</p>
                <p class="text-xs text-gray-500 uppercase tracking-wide">On-Premise</p>
            </div>
            <div class="bg-[#f3f2f1] p-3 text-center">
                <p class="text-xl font-bold">${monoCount}</p>
                <p class="text-xs text-gray-500 uppercase tracking-wide">Monolithic</p>
            </div>
        </div>`;
}

// =======================================================================
// ANALYSIS MODAL — Phase 4 (AC-4): Persona Q&A engine
// =======================================================================

function openAnalysisModal(index) {
    const data = state.analysisModalData[index];
    if (!data) return;

    const { signals, pattern, systems, anchorSystem, persona, allocations, functionLabel, tierInfo } = data;
    const patternTagHtml = pattern ? renderPatternTag(pattern) : '';

    // Persona display label
    const personaLabels = {
        executive: 'Executive / Transition Board',
        commercial: 'Commercial / Transition Director',
        architect: 'Enterprise Architect (CTO)'
    };
    const personaLabel = personaLabels[persona] || persona;

    // Generate Q&A for the current persona
    const questions = generatePersonaQuestions(persona, pattern, signals, systems, anchorSystem, allocations, tierInfo);

    const qaHtml = questions.length > 0
        ? questions.map(q => `
            <div class="qa-card">
                <div class="flex items-start gap-3">
                    <span class="qa-indicator qa-indicator-${q.indicator || 'neutral'}" title="${q.indicatorLabel || ''}"></span>
                    <div class="flex-1">
                        <p class="font-bold text-sm mb-1">${q.question}</p>
                        <p class="text-sm text-gray-700 leading-relaxed">${q.answer}</p>
                        ${q.indicatorLabel ? `<span class="text-xs font-bold uppercase tracking-wide mt-1 block" style="color: ${q.indicator === 'red' ? '#d4351c' : q.indicator === 'amber' ? '#f47738' : q.indicator === 'green' ? '#00703c' : '#1d70b8'}">${q.indicatorLabel}</span>` : ''}
                    </div>
                </div>
            </div>`).join('')
        : '<p class="text-sm text-gray-400 italic">No Q&A generated for this view.</p>';

    const content = document.getElementById('analysisModalContent');
    content.innerHTML = `
        <div class="mb-6">
            <p class="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Analysis for</p>
            <h2 class="text-2xl font-bold mb-1">${functionLabel || 'Function'}</h2>
            <div class="flex items-center gap-3 flex-wrap">
                ${patternTagHtml}
                <span class="text-sm text-gray-600">Persona: <strong>${personaLabel}</strong></span>
                <span class="text-sm text-gray-600">${systems.length} system(s) in scope</span>
            </div>
        </div>

        <div class="mb-6">
            <h3 class="font-bold text-base mb-2 border-b pb-1">Pattern Context</h3>
            ${pattern ? renderPatternExplanation(pattern) : '<p class="text-sm text-gray-400 italic">No transition pattern — Estate Discovery mode.</p>'}
        </div>

        <div class="mb-6">
            <h3 class="font-bold text-base mb-3 border-b pb-1">Key Metrics</h3>
            ${renderKeyMetrics(systems, signals)}
        </div>

        <div class="mb-6">
            <h3 class="font-bold text-base mb-3 border-b pb-1">${personaLabel} — Key Questions</h3>
            ${qaHtml}
        </div>

        <div class="mb-2">
            <h3 class="font-bold text-base mb-3 border-b pb-1">Technology Code of Practice Assessment</h3>
            ${renderTcopSection(systems)}
        </div>
    `;

    document.getElementById('analysisModal').classList.remove('hidden');
}

function drawTimeline(systems, councilsArray) {
    const track = document.getElementById('timelineTrack');

    // Determine date range: vesting-centred or fixed 2024–2030
    let startYear, totalSpan, yearMarkers;
    if (state.transitionStructure?.vestingDate) {
        const vDate = new Date(state.transitionStructure.vestingDate);
        const vestingYear = vDate.getFullYear();
        startYear = vestingYear - 2;
        totalSpan = 6; // vestingDate - 2 years to vestingDate + 4 years
        yearMarkers = [];
        for (let y = startYear; y <= startYear + totalSpan; y++) {
            yearMarkers.push(y);
        }
    } else {
        startYear = 2024;
        totalSpan = 6;
        yearMarkers = [2024, 2025, 2026, 2027, 2028, 2029, 2030];
    }

    const markersHtml = yearMarkers.map((y, i) =>
        `<div class="year-marker${i === yearMarkers.length - 1 ? ' border-r-2' : ''}"><span>${y}</span></div>`
    ).join('');

    track.innerHTML = `<div class="timeline-year-markers">${markersHtml}</div>`;

    // Draw vesting date vertical line if configured
    if (state.transitionStructure?.vestingDate) {
        const vDate = new Date(state.transitionStructure.vestingDate);
        const vestingDecimal = (vDate.getFullYear() - startYear) + (vDate.getMonth() / 12) + (vDate.getDate() / 365);
        const vestingPercent = Math.max(0, Math.min((vestingDecimal / totalSpan) * 100, 100));
        track.innerHTML += `
            <div style="position: absolute; left: ${vestingPercent}%; top: 0; bottom: 0; width: 2px; border-left: 2px dashed #d4351c; z-index: 5;" title="Vesting Date: ${state.transitionStructure.vestingDate}"></div>
            <div style="position: absolute; left: ${vestingPercent}%; top: -18px; transform: translateX(-50%); font-size: 10px; font-weight: bold; color: #d4351c; white-space: nowrap; z-index: 6;">Vesting Day</div>
        `;
    }

    const colors = ['#1d70b8', '#00703c', '#d53880', '#f47738'];
    let row = 0;

    systems.filter(s => s.endYear).sort((a,b) => a.endYear - b.endYear).forEach(sys => {
        const expiryDecimal = (sys.endYear - startYear) + ((sys.endMonth||1) / 12);
        const widthPercent = Math.max(0, Math.min((expiryDecimal / totalSpan) * 100, 100));
        
        // Calculate Notice Zone
        const noticeMonths = sys.noticePeriod || 0;
        const noticeDecimalWidth = (noticeMonths / 12) / totalSpan * 100;
        const noticeStartPercent = Math.max(0, widthPercent - noticeDecimalWidth);

        let opacity = 1;
        let color = colors[councilsArray.indexOf(sys._sourceCouncil) % colors.length];

        if (state.activePerspective !== 'all') {
            let belongsToPerspective = false;
            if (state.operatingMode === 'transition' && state.successorAllocationMap && state.successorAllocationMap.has(state.activePerspective)) {
                // In transition mode, check if this system is allocated to the selected successor
                const fnMap = state.successorAllocationMap.get(state.activePerspective);
                for (const [, allocations] of fnMap) {
                    if (allocations.some(a => a.system && a.system.id === sys.id)) {
                        belongsToPerspective = true;
                        break;
                    }
                }
            } else {
                // In discovery mode, match by council name
                belongsToPerspective = (sys._sourceCouncil === state.activePerspective);
            }
            if (!belongsToPerspective) {
                opacity = 0.3;
                color = '#b1b4b6';
            }
        }

        const top = row * 40;

        // Main Bar
        track.innerHTML += `
            <div class="sys-label" style="top: ${top+6}px; opacity: ${opacity}"><span class="text-[#505a5f] font-normal text-[10px] uppercase block mb-[2px]">${sys._sourceCouncil}</span>${sys.label}</div>
            <div class="timeline-bar tooltip-label" title="Contract expires ${String(sys.endMonth||1).padStart(2,'0')}/${sys.endYear}" style="top: ${top}px; width: ${widthPercent}%; background-color: ${color}; opacity: ${opacity}">Exp: ${String(sys.endMonth||1).padStart(2,'0')}/${sys.endYear}</div>
        `;
        
        // Notice Period Striped Overlay
        if (noticeMonths > 0) {
            track.innerHTML += `
                <div class="timeline-notice-zone tooltip-label" style="top: ${top}px; left: ${noticeStartPercent}%; width: ${noticeDecimalWidth}%; opacity: ${opacity}" title="${noticeMonths} Month Notice Period Action Zone. Action required before this date."></div>
            `;
        }

        row++;
    });
    track.style.height = `${(row * 40) + 40}px`;
}

// --- Demo Data Loader ---
document.getElementById('btnLoadDemo').addEventListener('click', () => {
    const demoDataA = {
        councilName: "Northshire County",
        councilMetadata: { tier: "county" },
        nodes: [
            { id: "LGA_F2", label: "Adult Social Care", type: "Function", lgaFunctionId: "148" },
            { id: "LGA_F3", label: "Highways", type: "Function", lgaFunctionId: "109" },
            { id: "sys_ncc_asc", label: "Liquidlogic ASC", type: "ITSystem", endYear: 2028, endMonth: 3, noticePeriod: 12, cost: "£950k/yr", annualCost: 950000, portability: "Medium", dataPartitioning: "Segmented", isCloud: true, isERP: false, users: 3500, vendor: "System C" },
            { id: "sys_ncc_hw", label: "Confirm Environment", type: "ITSystem", endYear: 2026, endMonth: 10, noticePeriod: 6, cost: "£250k/yr", annualCost: 250000, portability: "High", dataPartitioning: "Segmented", isCloud: true, isERP: false, users: 200, vendor: "Brightly" }
        ],
        edges: [
            { source: "sys_ncc_asc", target: "LGA_F2", relationship: "REALIZES" },
            { source: "sys_ncc_hw", target: "LGA_F3", relationship: "REALIZES" }
        ]
    };
    const demoDataB = {
        councilName: "Westampton District",
        councilMetadata: { tier: "district" },
        nodes: [
            { id: "LGA_F1", label: "Waste Collection", type: "Function", lgaFunctionId: "142" },
            { id: "LGA_F4", label: "Planning", type: "Function", lgaFunctionId: "101" },
            { id: "sys_dav_wc", label: "Bartec Collective SaaS", type: "ITSystem", endYear: 2025, endMonth: 11, noticePeriod: 3, cost: "£180k/yr", annualCost: 180000, portability: "High", dataPartitioning: "Segmented", isCloud: true, isERP: false, users: 120, vendor: "Bartec" },
            { id: "sys_dav_pl", label: "Idox Uniform", type: "ITSystem", endYear: 2026, endMonth: 2, noticePeriod: 6, cost: "£90k/yr", annualCost: 90000, portability: "Medium", dataPartitioning: "Segmented", isCloud: true, isERP: false, users: 45, vendor: "Idox" }
        ],
        edges: [
            { source: "sys_dav_wc", target: "LGA_F1", relationship: "REALIZES" },
            { source: "sys_dav_pl", target: "LGA_F4", relationship: "REALIZES" }
        ]
    };
    const demoDataC = {
        councilName: "Easton District",
        councilMetadata: { tier: "district", financialDistress: true },
        nodes: [
            { id: "LGA_F1", label: "Refuse Operations", type: "Function", lgaFunctionId: "142" },
            { id: "LGA_F4", label: "Planning", type: "Function", lgaFunctionId: "101" },
            { id: "sys_sn_wc", label: "Local SQL Routing App", type: "ITSystem", endYear: 2025, endMonth: 11, noticePeriod: 1, cost: "£30k/yr", annualCost: 30000, sharedWith: ["Westampton District"], portability: "Medium", dataPartitioning: "Monolithic", isCloud: false, isERP: false, users: 30, vendor: "In-House" },
            { id: "sys_sn_pl", label: "Agile Planning", type: "ITSystem", endYear: 2026, endMonth: 12, noticePeriod: 3, cost: "£85k/yr", annualCost: 85000, portability: "High", dataPartitioning: "Segmented", isCloud: true, isERP: false, users: 35, vendor: "AgileApps" }
        ],
        edges: [
            { source: "sys_sn_wc", target: "LGA_F1", relationship: "REALIZES" },
            { source: "sys_sn_pl", target: "LGA_F4", relationship: "REALIZES" }
        ]
    };

    state.rawUploads = [
        { filename: 'northshire.json', data: demoDataA },
        { filename: 'westampton.json', data: demoDataB },
        { filename: 'easton.json', data: demoDataC }
    ];

    document.getElementById('fileList').classList.remove('hidden');
    const listUl = document.getElementById('uploadedFilesUl');
    listUl.innerHTML = '';
    [
        { name: 'Northshire County', idx: 0 },
        { name: 'Westampton District', idx: 1 },
        { name: 'Easton District', idx: 2 }
    ].forEach(c => {
        const li = document.createElement('li');
        li.className = 'flex items-center gap-3';
        const span = document.createElement('span');
        span.textContent = `${c.name} (4 nodes)`;
        const editBtn = document.createElement('button');
        editBtn.className = 'btn-edit-arch gds-btn-secondary px-2 py-1 text-xs font-bold hover:bg-gray-100';
        editBtn.setAttribute('data-upload-idx', c.idx);
        editBtn.textContent = 'Edit Architecture';
        wireEditArchBtn(editBtn);
        li.appendChild(span);
        li.appendChild(editBtn);
        listUl.appendChild(li);
    });
});

// --- Export to HTML ---
document.getElementById('btnExportHTML').addEventListener('click', exportToHTML);

function exportToHTML() {
    // --- Collect inline styles from the main document ---
    var styleContent = '';
    var styleEls = document.querySelectorAll('style');
    for (var i = 0; i < styleEls.length; i++) {
        styleContent += styleEls[i].textContent + '\n';
    }

    // --- Build metadata header ---
    var personaLabels = {
        executive: 'Executive / Transition Board',
        commercial: 'Commercial / Transition Director',
        architect: 'Enterprise Architect (CTO)'
    };
    var weightLabels = ['Off', 'Low', 'Medium', 'High'];
    var now = new Date();
    var timestamp = now.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');

    var metaHtml = '<div style="border-bottom:3px solid #0b0c0c;padding-bottom:16px;margin-bottom:24px;">';
    metaHtml += '<h1 style="font-size:24px;font-weight:bold;margin:0 0 4px 0;">LGR Transition Workspace — Export</h1>';
    metaHtml += '<p style="font-size:13px;color:#505a5f;margin:0 0 12px 0;">Generated ' + timestamp + '</p>';

    metaHtml += '<table style="border-collapse:collapse;font-size:13px;margin-bottom:12px;">';
    metaHtml += '<tr><td style="padding:2px 12px 2px 0;font-weight:bold;">Active Persona</td><td>' + (personaLabels[state.activePersona] || state.activePersona) + '</td></tr>';
    metaHtml += '<tr><td style="padding:2px 12px 2px 0;font-weight:bold;">Operating Mode</td><td>' + (state.operatingMode === 'transition' ? 'Transition Planning' : 'Estate Discovery') + '</td></tr>';

    if (state.transitionStructure) {
        metaHtml += '<tr><td style="padding:2px 12px 2px 0;font-weight:bold;">Vesting Date</td><td>' + (state.transitionStructure.vestingDate || 'Not set') + '</td></tr>';
        if (state.transitionStructure.successors && state.transitionStructure.successors.length > 0) {
            var successorNames = state.transitionStructure.successors.map(function(s) { return s.name; }).join(', ');
            metaHtml += '<tr><td style="padding:2px 12px 2px 0;font-weight:bold;">Successors</td><td>' + successorNames + '</td></tr>';
        }
    }
    metaHtml += '</table>';

    // Signal weights table
    metaHtml += '<div style="margin-top:8px;">';
    metaHtml += '<p style="font-weight:bold;font-size:13px;margin:0 0 4px 0;">Signal Weights</p>';
    metaHtml += '<table style="border-collapse:collapse;font-size:12px;">';
    metaHtml += '<tr style="border-bottom:2px solid #0b0c0c;">';
    metaHtml += '<th style="text-align:left;padding:4px 12px 4px 0;">Signal</th>';
    metaHtml += '<th style="text-align:left;padding:4px 8px;">Weight</th></tr>';
    for (var s = 0; s < SIGNAL_DEFS.length; s++) {
        var sig = SIGNAL_DEFS[s];
        var w = state.signalWeights[sig.id];
        if (w === undefined) w = 0;
        metaHtml += '<tr style="border-bottom:1px solid #b1b4b6;">';
        metaHtml += '<td style="padding:3px 12px 3px 0;">' + sig.label + '</td>';
        metaHtml += '<td style="padding:3px 8px;">' + (weightLabels[w] || w) + '</td></tr>';
    }
    metaHtml += '</table>';
    metaHtml += '</div>';

    metaHtml += '</div>';

    // --- Clone estate summary panel ---
    var summaryHtml = '';
    var summaryPanel = document.getElementById('estateSummaryPanel');
    if (summaryPanel && !summaryPanel.classList.contains('hidden')) {
        summaryHtml = summaryPanel.innerHTML;
    }

    // --- Clone the matrix ---
    var matrixHtml = '';
    var matrixEl = document.getElementById('dashboardMatrix');
    if (matrixEl) {
        matrixHtml = matrixEl.outerHTML;
    }

    // --- Clone the timeline (if visible) ---
    var timelineHtml = '';
    var timelineSec = document.getElementById('timelineSection');
    if (timelineSec && !timelineSec.classList.contains('hidden')) {
        timelineHtml = timelineSec.innerHTML;
    }

    // --- Assemble the standalone HTML document ---
    var exportDoc = '<!DOCTYPE html>\n<html lang="en">\n<head>\n';
    exportDoc += '<meta charset="UTF-8">\n';
    exportDoc += '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
    exportDoc += '<title>LGR Transition Workspace — Export</title>\n';
    exportDoc += '<style>\n';
    // Inline all styles — no CDN dependency
    exportDoc += '  :root { --govuk-black: #0b0c0c; --govuk-blue: #1d70b8; --govuk-light-grey: #f3f2f1; --govuk-red: #d4351c; --govuk-green: #00703c; --govuk-purple: #53284f; --govuk-orange: #f47738; }\n';
    exportDoc += '  body { font-family: "Arial", sans-serif; color: #0b0c0c; background-color: #fff; margin: 0; padding: 24px; }\n';
    exportDoc += styleContent;
    // Tailwind utility overrides for offline use
    exportDoc += '  .text-2xl { font-size: 1.5rem; } .text-3xl { font-size: 1.875rem; } .text-xl { font-size: 1.25rem; } .text-lg { font-size: 1.125rem; } .text-sm { font-size: 0.875rem; } .text-xs { font-size: 0.75rem; }\n';
    exportDoc += '  .font-bold { font-weight: bold; } .font-normal { font-weight: normal; }\n';
    exportDoc += '  .mb-1 { margin-bottom: 0.25rem; } .mb-2 { margin-bottom: 0.5rem; } .mb-3 { margin-bottom: 0.75rem; } .mb-4 { margin-bottom: 1rem; } .mb-6 { margin-bottom: 1.5rem; } .mb-8 { margin-bottom: 2rem; }\n';
    exportDoc += '  .mt-1 { margin-top: 0.25rem; } .mt-2 { margin-top: 0.5rem; }\n';
    exportDoc += '  .p-4 { padding: 1rem; } .p-6 { padding: 1.5rem; } .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; } .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }\n';
    exportDoc += '  .gap-4 { gap: 1rem; } .gap-2 { gap: 0.5rem; }\n';
    exportDoc += '  .grid { display: grid; } .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); } .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }\n';
    exportDoc += '  .border { border: 1px solid #b1b4b6; } .border-t-4 { border-top: 4px solid; } .border-l-4 { border-left: 4px solid; }\n';
    exportDoc += '  .border-gray-300 { border-color: #d1d5db; }\n';
    exportDoc += '  .bg-white { background-color: #fff; } .bg-red-50 { background-color: #fef2f2; } .bg-green-50 { background-color: #f0fdf4; } .bg-blue-50 { background-color: #eff6ff; }\n';
    exportDoc += '  .text-gray-700 { color: #374151; } .text-gray-600 { color: #4b5563; } .text-gray-800 { color: #1f2937; }\n';
    exportDoc += '  .shadow-sm { box-shadow: 0 1px 2px rgba(0,0,0,0.05); }\n';
    exportDoc += '  .space-y-12 > * + * { margin-top: 3rem; }\n';
    exportDoc += '  .space-y-2 > * + * { margin-top: 0.5rem; }\n';
    exportDoc += '  .overflow-x-auto { overflow-x: auto; }\n';
    exportDoc += '  .hidden { display: none; }\n';
    exportDoc += '  .inline-block { display: inline-block; }\n';
    exportDoc += '  .block { display: block; }\n';
    exportDoc += '  @media print { body { padding: 12px; } .gds-table th { position: static; } }\n';
    exportDoc += '</style>\n';
    exportDoc += '</head>\n<body>\n';

    // Metadata header
    exportDoc += metaHtml;

    // Estate summary
    if (summaryHtml) {
        exportDoc += '<div style="margin-bottom:24px;">' + summaryHtml + '</div>\n';
    }

    // Matrix
    if (matrixHtml) {
        exportDoc += '<div style="margin-bottom:24px;overflow-x:auto;border:1px solid #d1d5db;">' + matrixHtml + '</div>\n';
    }

    // Timeline
    if (timelineHtml) {
        exportDoc += '<div style="padding:24px;border-top:4px solid #0b0c0c;margin-bottom:24px;">' + timelineHtml + '</div>\n';
    }

    exportDoc += '</body>\n</html>';

    // --- Open in a new window ---
    var exportWindow = window.open('', '_blank');
    if (exportWindow) {
        exportWindow.document.write(exportDoc);
        exportWindow.document.close();
    }
}

document.getElementById('btnReset').addEventListener('click', () => {
    state.rawUploads = [];
    state.simulationState = null;
    state.activePerspective = 'all';
    state.lgaFunctionMap.clear();
    state.signalWeights = { ...PERSONA_DEFAULT_WEIGHTS.executive };
    state.transitionStructure = null;
    state.operatingMode = 'discovery';
    isReconfiguring = false;
    document.getElementById('fileList').classList.add('hidden');
    document.getElementById('uploadedFilesUl').innerHTML = '';
    document.getElementById('validationErrors').classList.add('hidden');
    stageDashboard.classList.add('hidden');
    stageTransitionConfig.classList.add('hidden');
    controlsArea.classList.add('hidden');
    stageUpload.classList.remove('hidden');
});

// =========================================================
// IMPORT WIZARD
// =========================================================

// ---- Manual entry: Step 2a ----
// --- Editor event delegation ---
window.toggleHeaderCollapse = toggleHeaderCollapse;
window.toggleBannerCollapse = toggleBannerCollapse;
window.openDocModal = openDocModal;
window.openAnalysisModal = openAnalysisModal;
// Decision Panel: exposed here as well (decision-panel.js also sets window._simOpenDecision
// but this keeps openDecisionPanel available from main scope for Phase 3 matrix wiring)
window.openDecisionPanel = openDecisionPanel;
