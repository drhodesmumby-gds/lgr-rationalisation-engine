/**
 * Smart Inputs — shared input behaviour module for the unified architecture editor.
 * Pure rendering helpers + event wiring utilities.
 */

// --- Formatting utilities ---

/**
 * Formats a number with comma separators.
 * @param {number|string} value — raw number or numeric string
 * @param {{ prefix?: string }} opts — optional prefix (e.g. '£')
 * @returns {string} formatted display string
 */
export function formatThousands(value, opts = {}) {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (num == null || isNaN(num)) return '';
    const prefix = opts.prefix || '';
    return prefix + num.toLocaleString('en-GB');
}

/**
 * Strips £, commas, whitespace — returns raw number or NaN.
 * @param {string} displayStr
 * @returns {number}
 */
export function parseThousands(displayStr) {
    if (!displayStr || typeof displayStr !== 'string') return NaN;
    const cleaned = displayStr.replace(/[£,\s]/g, '');
    if (cleaned === '') return NaN;
    return Number(cleaned);
}

// --- Rendering helpers ---

/**
 * Renders a chip/tag input with existing chips and an autocomplete text input.
 * @param {object} options
 * @param {string[]} options.chips — current chip values
 * @param {string} options.placeholder — input placeholder text
 * @param {string} options.name — field name for data attributes
 * @param {string} [options.datalistId] — id for the datalist element
 * @param {string[]} [options.datalistOptions] — autocomplete suggestions
 * @returns {string} HTML string
 */
export function renderChipSelector(options) {
    const { chips = [], placeholder = '', name, datalistId, datalistOptions = [] } = options;

    const chipHtml = chips.map(chip => `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm bg-blue-100 text-blue-800 border border-blue-200"
              data-chip-name="${name}" data-chip-value="${escAttr(chip)}">
            <span>${escHtml(chip)}</span>
            <button type="button"
                    class="ml-0.5 text-blue-500 hover:text-blue-800 font-bold leading-none"
                    data-chip-action="remove"
                    data-chip-name="${name}"
                    data-chip-value="${escAttr(chip)}"
                    aria-label="Remove ${escAttr(chip)}">&times;</button>
        </span>
    `).join('');

    const datalistHtml = datalistId && datalistOptions.length > 0
        ? `<datalist id="${datalistId}">${datalistOptions.map(o => `<option value="${escAttr(o)}">`).join('')}</datalist>`
        : '';

    const listAttr = datalistId ? `list="${datalistId}"` : '';

    return `
        <div class="flex flex-wrap items-center gap-1.5 p-1.5 border border-gray-300 rounded bg-white min-h-[2.25rem]"
             data-chip-container="${name}">
            ${chipHtml}
            <input type="text"
                   class="flex-1 min-w-[8rem] px-1 py-0.5 text-sm border-0 outline-none bg-transparent"
                   placeholder="${escAttr(placeholder)}"
                   data-chip-action="input"
                   data-chip-name="${name}"
                   ${listAttr} />
            ${datalistHtml}
        </div>
    `;
}

/**
 * Renders toggleable capability pills from LGAM vocabulary.
 * @param {object} options
 * @param {string[]} options.active — currently active capability IDs
 * @param {Array<{id: string, label: string}>} options.vocabulary — full capability vocabulary
 * @param {boolean} options.allowCustom — whether to show "Add custom..." input
 * @returns {string} HTML string
 */
export function renderCapabilityPills(options) {
    const { active = [], vocabulary = [], allowCustom = false } = options;

    const pillsHtml = vocabulary.map(cap => {
        const isActive = active.includes(cap.id);
        const activeClasses = isActive
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200';
        return `
            <button type="button"
                    class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${activeClasses}"
                    data-cap-pill="${cap.id}"
                    aria-pressed="${isActive}"
                    title="${escAttr(cap.label)}">
                ${escHtml(cap.label)}
            </button>
        `;
    }).join('');

    const customHtml = allowCustom ? `
        <div class="flex items-center gap-1 mt-1">
            <input type="text"
                   class="px-2 py-0.5 text-xs border border-gray-300 rounded w-28"
                   placeholder="Custom..."
                   data-cap-custom-input />
            <button type="button"
                    class="px-2 py-0.5 text-xs bg-gray-200 hover:bg-gray-300 rounded border border-gray-300"
                    data-cap-custom-add>Add</button>
        </div>
    ` : '';

    return `
        <div class="flex flex-wrap gap-1.5" data-cap-pills>
            ${pillsHtml}
            ${customHtml}
        </div>
    `;
}

/**
 * Renders a compact horizontal radio group.
 * @param {object} options
 * @param {string} options.name — radio group name attribute
 * @param {string} options.title — visible group label
 * @param {string[]} options.options — radio option values/labels
 * @param {string} options.selected — currently selected value
 * @param {string} [options.hint] — optional hint text below title
 * @returns {string} HTML string
 */
export function renderRadioGroup(options) {
    const { name, title, options: opts = [], selected, hint } = options;

    const hintHtml = hint
        ? `<span class="block text-xs text-gray-500 mt-0.5 mb-1">${escHtml(hint)}</span>`
        : '';

    const radiosHtml = opts.map(opt => {
        const checked = opt === selected ? 'checked' : '';
        const id = `radio-${name}-${opt.replace(/\s+/g, '-').toLowerCase()}`;
        return `
            <label class="inline-flex items-center gap-1 cursor-pointer text-sm" for="${id}">
                <input type="radio" id="${id}" name="${name}" value="${escAttr(opt)}" ${checked}
                       class="w-3.5 h-3.5 text-blue-600 border-gray-300" />
                <span>${escHtml(opt)}</span>
            </label>
        `;
    }).join('');

    return `
        <fieldset class="mb-2">
            <legend class="text-sm font-medium text-gray-700">${escHtml(title)}</legend>
            ${hintHtml}
            <div class="flex flex-wrap items-center gap-3 mt-1">
                ${radiosHtml}
            </div>
        </fieldset>
    `;
}

// --- Event wiring ---

/**
 * Attaches delegated event handlers to a container element for smart input behaviours.
 * Call once per container (e.g. on panel mount).
 *
 * Handles:
 * - Thousands formatting on blur/focus (inputs with data-format="thousands")
 * - Chip add/remove (elements with data-chip-action)
 * - Capability pill toggle (elements with data-cap-pill)
 * - Custom capability entry
 *
 * @param {HTMLElement} container
 * @param {object} [callbacks] — optional callbacks for state updates
 * @param {function} [callbacks.onChipChange] — (name, chips[]) called when chips change
 * @param {function} [callbacks.onCapabilityToggle] — (capId, isActive) called on pill toggle
 * @param {function} [callbacks.onRadioChange] — (name, value) called on radio selection
 */
export function wireSmartInputs(container, callbacks = {}) {
    if (!container) return;

    // --- Thousands formatting ---
    container.addEventListener('focus', (e) => {
        const input = e.target;
        if (input.matches && input.matches('[data-format="thousands"]')) {
            // On focus, show raw number for editing
            const raw = parseThousands(input.value);
            if (!isNaN(raw)) {
                input.value = String(raw);
            }
        }
    }, true); // useCapture for focus events

    container.addEventListener('blur', (e) => {
        const input = e.target;
        if (input.matches && input.matches('[data-format="thousands"]')) {
            const raw = parseThousands(input.value);
            if (!isNaN(raw)) {
                const prefix = input.dataset.prefix || '';
                input.value = formatThousands(raw, { prefix });
            }
        }
    }, true); // useCapture for blur events

    // --- Click delegation (chips, pills, custom cap) ---
    container.addEventListener('click', (e) => {
        const target = e.target;

        // Chip remove
        if (target.matches && target.matches('[data-chip-action="remove"]')) {
            e.preventDefault();
            const chipName = target.dataset.chipName;
            const chipValue = target.dataset.chipValue;
            const chipEl = container.querySelector(
                `[data-chip-name="${chipName}"][data-chip-value="${CSS.escape(chipValue)}"]:not(button)`
            );
            if (chipEl) chipEl.remove();

            if (callbacks.onChipChange) {
                const remaining = getChipValues(container, chipName);
                callbacks.onChipChange(chipName, remaining);
            }
        }

        // Capability pill toggle
        if (target.closest && target.closest('[data-cap-pill]')) {
            const pill = target.closest('[data-cap-pill]');
            const capId = pill.dataset.capPill;
            const wasActive = pill.getAttribute('aria-pressed') === 'true';
            const nowActive = !wasActive;

            pill.setAttribute('aria-pressed', String(nowActive));

            // Toggle visual classes
            if (nowActive) {
                pill.classList.remove('bg-gray-100', 'text-gray-600', 'border-gray-300', 'hover:bg-gray-200');
                pill.classList.add('bg-blue-600', 'text-white', 'border-blue-600');
            } else {
                pill.classList.remove('bg-blue-600', 'text-white', 'border-blue-600');
                pill.classList.add('bg-gray-100', 'text-gray-600', 'border-gray-300', 'hover:bg-gray-200');
            }

            if (callbacks.onCapabilityToggle) {
                callbacks.onCapabilityToggle(capId, nowActive);
            }
        }

        // Custom capability add
        if (target.matches && target.matches('[data-cap-custom-add]')) {
            const pillsContainer = target.closest('[data-cap-pills]');
            const input = pillsContainer && pillsContainer.querySelector('[data-cap-custom-input]');
            if (input && input.value.trim()) {
                const customId = input.value.trim().toLowerCase().replace(/\s+/g, '-');
                const customLabel = input.value.trim();

                // Add new pill before the custom input container
                const newPill = `
                    <button type="button"
                            class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-colors bg-blue-600 text-white border-blue-600"
                            data-cap-pill="${escAttr(customId)}"
                            aria-pressed="true"
                            title="${escAttr(customLabel)}">
                        ${escHtml(customLabel)}
                    </button>
                `;
                const customDiv = target.closest('div');
                if (customDiv) {
                    customDiv.insertAdjacentHTML('beforebegin', newPill);
                }
                input.value = '';

                if (callbacks.onCapabilityToggle) {
                    callbacks.onCapabilityToggle(customId, true);
                }
            }
        }
    });

    // --- Keydown delegation (chip input enter) ---
    container.addEventListener('keydown', (e) => {
        const target = e.target;

        // Chip input: add on Enter
        if (target.matches && target.matches('[data-chip-action="input"]') && e.key === 'Enter') {
            e.preventDefault();
            const value = target.value.trim();
            if (!value) return;

            const chipName = target.dataset.chipName;
            const containerEl = target.closest(`[data-chip-container="${chipName}"]`);
            if (!containerEl) return;

            // Check for duplicate
            const existing = getChipValues(containerEl, chipName);
            if (existing.includes(value)) {
                target.value = '';
                return;
            }

            // Insert new chip before the input
            const chipHtml = `
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm bg-blue-100 text-blue-800 border border-blue-200"
                      data-chip-name="${chipName}" data-chip-value="${escAttr(value)}">
                    <span>${escHtml(value)}</span>
                    <button type="button"
                            class="ml-0.5 text-blue-500 hover:text-blue-800 font-bold leading-none"
                            data-chip-action="remove"
                            data-chip-name="${chipName}"
                            data-chip-value="${escAttr(value)}"
                            aria-label="Remove ${escAttr(value)}">&times;</button>
                </span>
            `;
            target.insertAdjacentHTML('beforebegin', chipHtml);
            target.value = '';

            if (callbacks.onChipChange) {
                const updated = getChipValues(containerEl, chipName);
                callbacks.onChipChange(chipName, updated);
            }
        }
    });

    // --- Change delegation (radio groups) ---
    container.addEventListener('change', (e) => {
        const target = e.target;
        if (target.matches && target.matches('input[type="radio"]')) {
            if (callbacks.onRadioChange) {
                callbacks.onRadioChange(target.name, target.value);
            }
        }
    });
}

// --- Internal helpers ---

/**
 * Gets current chip values from a chip container.
 */
function getChipValues(containerEl, chipName) {
    const chips = containerEl.querySelectorAll(`[data-chip-name="${chipName}"][data-chip-value]:not(button)`);
    return Array.from(chips).map(el => el.dataset.chipValue);
}

/**
 * Escapes HTML entities for safe insertion.
 */
function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Escapes a string for use in HTML attributes.
 */
function escAttr(str) {
    return escHtml(str);
}
