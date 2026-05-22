/**
 * Wizard — onboarding flow for "Build from Scratch" in the unified architecture editor.
 * Guides users through entering council info and optionally their first system.
 */

import { formatThousands, parseThousands, renderRadioGroup, wireSmartInputs } from './smart-inputs.js';

// --- Rendering ---

/**
 * Renders HTML for the current wizard step.
 * @param {1|2} step — current wizard step
 * @returns {string} HTML string
 */
export function renderWizard(step) {
    if (step === 1) return renderStep1();
    if (step === 2) return renderStep2();
    return '';
}

function renderStep1() {
    return `
        <div class="max-w-md mx-auto mt-8">
            <div class="bg-gray-50 border border-gray-200 rounded-lg shadow-sm p-8">
                <p class="text-xs text-gray-500 font-medium uppercase tracking-wide mb-4">Step 1 of 2</p>
                <h2 class="text-xl font-bold text-gray-900 mb-1">Council Information</h2>
                <p class="text-sm text-gray-600 mb-6">Tell us about the council whose architecture you are modelling.</p>

                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="wizard-council-name">
                            Council Name
                        </label>
                        <p class="text-xs text-gray-500 mb-1">The official name of the local authority</p>
                        <input type="text"
                               id="wizard-council-name"
                               class="w-full px-3 py-2 text-base border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                               placeholder="e.g. Essex County Council"
                               data-wizard-field="councilName" />
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="wizard-tier">
                            Tier
                        </label>
                        <p class="text-xs text-gray-500 mb-1">The authority type within the local government structure</p>
                        <select id="wizard-tier"
                                class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                data-wizard-field="tier">
                            <option value="county">County</option>
                            <option value="district">District</option>
                            <option value="borough">Borough</option>
                            <option value="unitary">Unitary</option>
                        </select>
                    </div>

                    <div class="flex items-center gap-2 pt-1">
                        <input type="checkbox"
                               id="wizard-distress"
                               class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                               data-wizard-field="financialDistress" />
                        <label class="text-sm text-gray-700" for="wizard-distress">
                            Under s114 notice or equivalent
                        </label>
                    </div>
                </div>

                <div class="mt-8">
                    <button type="button"
                            class="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            data-wizard-action="next">
                        Next
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderStep2() {
    const hostingRadio = renderRadioGroup({
        name: 'wizard-hosting',
        title: 'Hosting',
        options: ['Cloud', 'On-Premise'],
        selected: 'Cloud',
        hint: 'Where the system runs'
    });

    return `
        <div class="max-w-md mx-auto mt-8">
            <div class="bg-gray-50 border border-gray-200 rounded-lg shadow-sm p-8">
                <p class="text-xs text-gray-500 font-medium uppercase tracking-wide mb-4">Step 2 of 2</p>
                <h2 class="text-xl font-bold text-gray-900 mb-1">Add Your First System</h2>
                <p class="text-sm text-gray-600 mb-6">Optionally add an IT system to get started. You can always add more in the editor.</p>

                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="wizard-system-name">
                            System Name
                        </label>
                        <p class="text-xs text-gray-500 mb-1">What the system is called internally</p>
                        <input type="text"
                               id="wizard-system-name"
                               class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                               placeholder="e.g. Liquidlogic LAS"
                               data-wizard-field="systemName" />
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="wizard-vendor">
                            Vendor
                        </label>
                        <p class="text-xs text-gray-500 mb-1">Who supplies or maintains the software</p>
                        <input type="text"
                               id="wizard-vendor"
                               class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                               placeholder="e.g. System C"
                               data-wizard-field="vendor" />
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="wizard-cost">
                            Annual Cost
                        </label>
                        <p class="text-xs text-gray-500 mb-1">Approximate yearly licence/hosting cost</p>
                        <input type="text"
                               id="wizard-cost"
                               class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                               placeholder="e.g. 50,000"
                               data-format="thousands"
                               data-prefix="£"
                               data-wizard-field="annualCost" />
                    </div>

                    <div>
                        ${hostingRadio}
                    </div>
                </div>

                <div class="mt-8 space-y-3">
                    <button type="button"
                            class="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            data-wizard-action="add-system">
                        Add to editor
                    </button>
                    <button type="button"
                            class="w-full px-4 py-2 text-sm text-blue-600 hover:text-blue-800 underline bg-transparent border-0 cursor-pointer"
                            data-wizard-action="skip">
                        Skip — go to editor
                    </button>
                </div>
            </div>
        </div>
    `;
}

// --- Event wiring ---

/**
 * Attaches wizard event handlers to a container element.
 * @param {HTMLElement} container — DOM element containing the wizard HTML
 * @param {object} options
 * @param {function} options.onComplete — called with architecture data when wizard finishes
 * @param {function} [options.onSkip] — called when user skips (receives partial data)
 */
export function wireWizard(container, options = {}) {
    const { onComplete, onSkip } = options;

    let currentStep = 1;
    let step1Data = null;

    // Wire smart inputs for cost formatting
    wireSmartInputs(container);

    container.addEventListener('click', (e) => {
        const target = e.target;
        if (!target.matches || !target.matches('[data-wizard-action]')) return;

        const action = target.dataset.wizardAction;

        if (action === 'next' && currentStep === 1) {
            // Validate step 1
            const nameInput = container.querySelector('[data-wizard-field="councilName"]');
            const name = nameInput ? nameInput.value.trim() : '';

            if (!name) {
                // Highlight the field
                if (nameInput) {
                    nameInput.classList.add('border-red-500', 'ring-1', 'ring-red-500');
                    nameInput.focus();
                    nameInput.addEventListener('input', () => {
                        nameInput.classList.remove('border-red-500', 'ring-1', 'ring-red-500');
                    }, { once: true });
                }
                return;
            }

            // Collect step 1 data
            const tierSelect = container.querySelector('[data-wizard-field="tier"]');
            const distressCheckbox = container.querySelector('[data-wizard-field="financialDistress"]');

            step1Data = {
                councilName: name,
                councilMetadata: {
                    tier: tierSelect ? tierSelect.value : 'district',
                    financialDistress: distressCheckbox ? distressCheckbox.checked : false
                }
            };

            // Advance to step 2
            currentStep = 2;
            container.innerHTML = renderWizard(2);
            wireSmartInputs(container);
        }

        if (action === 'add-system' && currentStep === 2) {
            // Validate system name
            const sysNameInput = container.querySelector('[data-wizard-field="systemName"]');
            const sysName = sysNameInput ? sysNameInput.value.trim() : '';

            if (!sysName) {
                if (sysNameInput) {
                    sysNameInput.classList.add('border-red-500', 'ring-1', 'ring-red-500');
                    sysNameInput.focus();
                    sysNameInput.addEventListener('input', () => {
                        sysNameInput.classList.remove('border-red-500', 'ring-1', 'ring-red-500');
                    }, { once: true });
                }
                return;
            }

            // Collect system data
            const vendorInput = container.querySelector('[data-wizard-field="vendor"]');
            const costInput = container.querySelector('[data-wizard-field="annualCost"]');
            const hostingRadio = container.querySelector('input[name="wizard-hosting"]:checked');

            const vendor = vendorInput ? vendorInput.value.trim() : '';
            const costRaw = costInput ? parseThousands(costInput.value) : NaN;
            const isCloud = hostingRadio ? hostingRadio.value === 'Cloud' : true;

            const systemNode = {
                id: 'sys-1',
                label: sysName,
                type: 'ITSystem',
                vendor: vendor,
                annualCost: isNaN(costRaw) ? 0 : costRaw,
                isCloud: isCloud
            };

            const data = {
                councilName: step1Data.councilName,
                councilMetadata: step1Data.councilMetadata,
                nodes: [systemNode],
                edges: []
            };

            if (onComplete) onComplete(data);
        }

        if (action === 'skip' && currentStep === 2) {
            const data = {
                councilName: step1Data ? step1Data.councilName : '',
                councilMetadata: step1Data ? step1Data.councilMetadata : {},
                nodes: [],
                edges: []
            };

            if (onComplete) onComplete(data);
        }
    });
}
