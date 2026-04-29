// ===================================================================
// PERSONA-TAILORED REPORT EXPORT
// ===================================================================
//
// Generates self-contained HTML reports tailored by persona (executive,
// commercial, architect) for governance boards and procurement meetings.
//
// All HTML is built from data — no DOM cloning. Reports are opened in
// a new window as self-contained documents with inline styles only
// (no Tailwind, no CDN dependencies).

import { state } from '../state.js';
import { getDecisionKey } from '../simulation/decisions.js';
import { computeObligationSeverity, generateMigrationScopeBullets } from '../simulation/obligations.js';

// ===================================================================
// HELPER FUNCTIONS (pure, module-scoped for testability)
// ===================================================================

/**
 * Formats a cost value as a human-readable string.
 * @param {number|null|undefined} amount
 * @returns {string}
 */
export function formatCost(amount) {
    if (amount === null || amount === undefined) return '—';
    if (amount >= 1000000) return `£${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `£${Math.round(amount / 1000)}k`;
    return `£${amount}`;
}

/**
 * Escapes HTML special characters.
 * @param {string|null|undefined} str
 * @returns {string}
 */
export function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Returns the display label for a tier number.
 * @param {number} tier
 * @returns {string}
 */
export function tierLabel(tier) {
    if (tier === 1) return 'Tier 1 — Day 1 Critical';
    if (tier === 2) return 'Tier 2 — High Priority';
    return 'Tier 3 — Post-Day 1';
}

/**
 * Returns the colour for a tier badge.
 * @param {number} tier
 * @returns {string}
 */
export function tierColour(tier) {
    if (tier === 1) return '#d4351c';
    if (tier === 2) return '#f47738';
    return '#b1b4b6';
}

/**
 * Returns the display label for a system choice.
 * @param {string} choice
 * @returns {string}
 */
export function decisionLabel(choice) {
    if (choice === 'choose') return 'Choose existing';
    if (choice === 'procure') return 'Procure new';
    return 'Defer';
}

/**
 * Returns the display label for a persona.
 * @param {string} persona
 * @returns {string}
 */
export function personaLabel(persona) {
    if (persona === 'executive') return 'Executive / Transition Board';
    if (persona === 'commercial') return 'Commercial / Transition Director';
    return 'Enterprise Architect (CTO)';
}

/**
 * Returns the brand colour for a persona.
 * @param {string} persona
 * @returns {string}
 */
export function personaColour(persona) {
    if (persona === 'executive') return '#0b0c0c';
    if (persona === 'commercial') return '#00703c';
    return '#4c2c92';
}

/**
 * Formats a contract end date from year/month integers.
 * @param {number|null} endYear
 * @param {number|null} endMonth
 * @returns {string}
 */
function formatContractEnd(endYear, endMonth) {
    if (!endYear) return '—';
    const month = String(endMonth || 12).padStart(2, '0');
    return `${endYear}-${month}`;
}

/**
 * Formats a delta number with sign prefix and optional unit.
 * @param {number|null} delta
 * @param {string} [unit]
 * @returns {string}
 */
function formatDelta(delta, unit) {
    if (delta === null || delta === undefined) return '—';
    const prefix = delta > 0 ? '+' : '';
    if (unit) return `${prefix}${unit}${Math.abs(delta)}`;
    return `${prefix}${delta}`;
}

/**
 * Formats a spend delta with sign and currency.
 * @param {number|null} delta
 * @returns {string}
 */
function formatSpendDelta(delta) {
    if (delta === null || delta === undefined) return '—';
    const sign = delta < 0 ? '-' : '+';
    return `${sign}${formatCost(Math.abs(delta))}`;
}

/**
 * Returns systems from baselineAllocation for a given decision.
 * @param {Object} decision - FunctionDecision
 * @returns {Array} - SystemAllocation[]
 */
function getDecisionSystems(decision) {
    const alloc = state.simulationState && state.simulationState.baselineAllocation;
    if (!alloc) return [];
    const funcMap = alloc.get(decision.successorName);
    if (!funcMap) return [];
    const allocations = funcMap.get(decision.functionId);
    return allocations || [];
}

/**
 * Counts obligations by severity for a given set of obligations.
 * @param {Array} oblList - SimulationObligation[]
 * @param {Object} weights - signal weights
 * @returns {{ high: number, medium: number, low: number }}
 */
function countBySeverity(oblList, weights) {
    const counts = { high: 0, medium: 0, low: 0 };
    for (const obl of oblList) {
        const sev = computeObligationSeverity(obl, weights);
        counts[sev]++;
    }
    return counts;
}

/**
 * Formats obligation severity counts as a short string.
 * @param {{ high: number, medium: number, low: number }} counts
 * @returns {string}
 */
function formatSeverityCounts(counts) {
    const parts = [];
    if (counts.high > 0) parts.push(`${counts.high} high`);
    if (counts.medium > 0) parts.push(`${counts.medium} medium`);
    if (counts.low > 0) parts.push(`${counts.low} low`);
    return parts.length > 0 ? parts.join(', ') : 'none';
}

/**
 * Computes the notice trigger date for a system contract.
 * @param {{ endYear?: number, endMonth?: number, noticePeriod?: number }} sys
 * @returns {{ triggerDate: string, triggerTotalMonths: number, isOverdue: boolean } | null}
 */
export function computeNoticeTrigger(sys) {
    if (!sys.endYear || typeof sys.noticePeriod !== 'number' || sys.noticePeriod <= 0) return null;
    const endTotalMonths = sys.endYear * 12 + (sys.endMonth || 12);
    const triggerTotalMonths = endTotalMonths - sys.noticePeriod;
    const triggerYear = Math.floor((triggerTotalMonths - 1) / 12);
    const triggerMonth = ((triggerTotalMonths - 1) % 12) + 1;
    const triggerDate = `${triggerYear}-${String(triggerMonth).padStart(2, '0')}`;
    const now = new Date();
    const nowMonth = now.getFullYear() * 12 + (now.getMonth() + 1);
    return { triggerDate, triggerTotalMonths, isOverdue: triggerTotalMonths < nowMonth };
}

/**
 * Formats a trigger total-months value relative to a vesting date.
 * @param {number} triggerTotalMonths
 * @param {string|null|undefined} vestingDateStr
 * @returns {string|null}
 */
export function formatVestingRelative(triggerTotalMonths, vestingDateStr) {
    if (!vestingDateStr) return null;
    const vDate = new Date(vestingDateStr);
    const vestingMonth = vDate.getFullYear() * 12 + (vDate.getMonth() + 1);
    const diff = vestingMonth - triggerTotalMonths;
    if (diff > 0) return `${diff} month${diff !== 1 ? 's' : ''} before vesting`;
    if (diff < 0) return `${Math.abs(diff)} month${Math.abs(diff) !== 1 ? 's' : ''} after vesting`;
    return 'vesting month';
}

/**
 * Generates bullet-point narrative comparing before/after technical posture.
 * @param {{ monolithic: number, lowPortability: number, erp: number, onPrem: number, total: number }} before
 * @param {{ monolithic: number, lowPortability: number, erp: number, onPrem: number, total: number }} after
 * @returns {string[]}
 */
export function generatePostureNarrative(before, after) {
    const bullets = [];

    if (before.erp !== after.erp) {
        const verb = after.erp < before.erp ? 'reduces' : 'increases';
        bullets.push(`ERP footprint ${verb} from ${before.erp} to ${after.erp}`);
    }

    if (before.monolithic !== after.monolithic) {
        const verb = after.monolithic < before.monolithic ? 'drop' : 'increase';
        bullets.push(`Monolithic data stores ${verb} from ${before.monolithic} to ${after.monolithic}`);
    }

    if (before.onPrem !== after.onPrem) {
        const verb = after.onPrem < before.onPrem ? 'reduce' : 'increase';
        bullets.push(`On-premise systems ${verb} from ${before.onPrem} to ${after.onPrem}`);
    }

    if (before.lowPortability !== after.lowPortability) {
        const verb = after.lowPortability < before.lowPortability ? 'reduce' : 'increase';
        bullets.push(`Low portability systems ${verb} from ${before.lowPortability} to ${after.lowPortability}`);
    }

    if (before.total !== after.total) {
        const verb = after.total < before.total ? 'reduce' : 'increase';
        bullets.push(`Total unique systems ${verb} from ${before.total} to ${after.total}`);
    }

    if (before.total > 0 || after.total > 0) {
        const beforeCloud = before.total > 0 ? Math.round(((before.total - before.onPrem) / before.total) * 100) : 0;
        const afterCloud = after.total > 0 ? Math.round(((after.total - after.onPrem) / after.total) * 100) : 0;
        if (beforeCloud !== afterCloud) {
            bullets.push(`Cloud hosting proportion moves from ${beforeCloud}% to ${afterCloud}%`);
        }
    }

    return bullets;
}

// ===================================================================
// HTML DOCUMENT SCAFFOLDING
// ===================================================================

/**
 * Builds the opening of the HTML document including styles.
 * @param {string} persona
 * @returns {string}
 */
function buildReportDocStart(persona) {
    const colour = personaColour(persona);
    const label = personaLabel(persona);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LGR Transition Report — ${escHtml(label)}</title>
<style>
  /* Base */
  body {
    font-family: Arial, sans-serif;
    color: #0b0c0c;
    background-color: #fff;
    margin: 0;
    padding: 24px;
    line-height: 1.5;
  }
  h1 { font-size: 24px; font-weight: bold; margin: 0 0 4px 0; }
  h2 { font-size: 18px; font-weight: bold; margin: 24px 0 8px 0; border-bottom: 2px solid #0b0c0c; padding-bottom: 4px; }
  h3 { font-size: 15px; font-weight: bold; margin: 16px 0 6px 0; }
  p { margin: 0 0 8px 0; }

  /* Tables */
  table { border-collapse: collapse; width: 100%; font-size: 14px; margin-bottom: 16px; }
  th { text-align: left; padding: 6px 10px; background: #f3f2f1; border: 1px solid #b1b4b6; font-weight: bold; }
  td { padding: 5px 10px; border: 1px solid #b1b4b6; vertical-align: top; }
  tr:nth-child(even) td { background: #f8f8f7; }

  /* Header banner */
  .report-header {
    border-bottom: 4px solid ${escHtml(colour)};
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  .report-title-bar {
    background: ${escHtml(colour)};
    color: ${colour === '#0b0c0c' ? '#ffffff' : '#ffffff'};
    padding: 12px 16px;
    margin-bottom: 12px;
  }
  .report-title-bar h1 { color: #ffffff; }

  /* Badges */
  .tier-badge {
    display: inline-block;
    padding: 2px 6px;
    font-size: 11px;
    font-weight: bold;
    color: #fff;
    border-radius: 2px;
  }
  .sev-high { color: #d4351c; font-weight: bold; }
  .sev-medium { color: #b54c00; font-weight: bold; }
  .sev-low { color: #505a5f; }

  /* Decision blocks */
  .decision-block {
    border-left: 4px solid #1d70b8;
    padding: 8px 12px;
    margin-bottom: 12px;
    background: #f8f8f7;
  }
  .decision-block.deferred { border-left-color: #f47738; }
  .decision-block.procured { border-left-color: #00703c; }

  /* Metadata grid */
  .meta-grid { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 12px; }
  .meta-item { font-size: 13px; }
  .meta-label { font-weight: bold; display: block; }

  /* Cost summary */
  .cost-summary-table { width: auto; font-size: 14px; }
  .cost-summary-table td:first-child { font-weight: bold; min-width: 200px; }
  .cost-summary-table td:last-child { font-weight: bold; color: #00703c; }

  /* Bullet lists */
  ul.scope-bullets { margin: 4px 0 4px 18px; padding: 0; font-size: 13px; color: #505a5f; }
  ul.scope-bullets li { margin-bottom: 2px; }

  /* Print */
  @media print {
    body { padding: 12px; font-size: 11pt; }
    table { page-break-inside: avoid; }
    h2 { page-break-after: avoid; }
    .report-title-bar { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
`;
}

/**
 * Builds the closing tags of the HTML document.
 * @returns {string}
 */
function buildReportDocEnd() {
    return '\n</body>\n</html>';
}

// ===================================================================
// REPORT HEADER (all personas)
// ===================================================================

/**
 * Builds the report header section.
 * @param {string} persona
 * @param {Map} decisions
 * @returns {string}
 */
function buildReportHeader(persona, decisions) {
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
    const label = personaLabel(persona);
    const colour = personaColour(persona);

    const vestingDate = state.transitionStructure ? state.transitionStructure.vestingDate || 'Not set' : 'Not set';
    const successors = state.transitionStructure && state.transitionStructure.successors
        ? state.transitionStructure.successors.map(s => s.name).join(', ')
        : 'Not configured';

    // Compute pending count
    let totalCells = 0;
    if (state.simulationState && state.simulationState.baselineAllocation) {
        state.simulationState.baselineAllocation.forEach(funcMap => {
            totalCells += funcMap.size;
        });
    }
    const pending = totalCells - decisions.size;

    let html = `<div class="report-header">`;
    html += `<div class="report-title-bar" style="background:${escHtml(colour)};">`;
    html += `<h1>LGR Transition Report — ${escHtml(label)}</h1>`;
    html += `</div>`;

    html += `<div class="meta-grid">`;
    html += `<div class="meta-item"><span class="meta-label">Generated</span>${escHtml(timestamp)}</div>`;
    html += `<div class="meta-item"><span class="meta-label">Vesting date</span>${escHtml(vestingDate)}</div>`;
    html += `<div class="meta-item"><span class="meta-label">Successors</span>${escHtml(successors)}</div>`;
    html += `</div>`;

    html += `<div class="meta-grid">`;
    html += `<div class="meta-item"><span class="meta-label">Decisions made</span>${decisions.size}</div>`;
    html += `<div class="meta-item"><span class="meta-label">Pending</span>${pending >= 0 ? pending : 0}</div>`;
    html += `<div class="meta-item"><span class="meta-label">Total function-successor cells</span>${totalCells}</div>`;
    html += `</div>`;

    html += `</div>`;
    return html;
}

// ===================================================================
// EXECUTIVE REPORT
// ===================================================================

/**
 * Builds the estate impact summary table.
 * @param {Object|null} impact
 * @param {Array} [obligations]  Optional obligations array to add capability-gap count row
 * @returns {string}
 */
function buildEstateSummaryTable(impact, obligations) {
    if (!impact) {
        return '<p style="color:#505a5f;">No impact data available — run simulation first.</p>';
    }

    const { before, after, delta } = impact;

    const row = (label, beforeVal, afterVal, deltaVal) =>
        `<tr><td>${escHtml(label)}</td><td>${escHtml(String(beforeVal))}</td><td>${escHtml(String(afterVal))}</td><td>${escHtml(String(deltaVal))}</td></tr>`;

    let html = `<table>`;
    html += `<thead><tr><th scope="col">Metric</th><th scope="col">Before</th><th scope="col">After</th><th scope="col">Change</th></tr></thead>`;
    html += `<tbody>`;

    html += row(
        'IT Systems',
        before.systemCount !== null ? before.systemCount : '—',
        after.systemCount !== null ? after.systemCount : '—',
        delta.systemCount !== null ? formatDelta(delta.systemCount) : '—'
    );

    html += row(
        'Annual Spend',
        formatCost(before.totalAnnualSpend),
        formatCost(after.totalAnnualSpend),
        delta.totalAnnualSpend !== null ? formatSpendDelta(delta.totalAnnualSpend) : '—'
    );

    html += row(
        'Pre-vesting triggers',
        before.preVestingNoticeCount !== null ? before.preVestingNoticeCount : '—',
        after.preVestingNoticeCount !== null ? after.preVestingNoticeCount : '—',
        delta.preVestingNoticeCount !== null ? formatDelta(delta.preVestingNoticeCount) : '—'
    );

    if (before.disaggregationCount !== null || after.disaggregationCount !== null) {
        html += row(
            'Disaggregation candidates',
            before.disaggregationCount !== null ? before.disaggregationCount : '—',
            after.disaggregationCount !== null ? after.disaggregationCount : '—',
            delta.disaggregationCount !== null ? formatDelta(delta.disaggregationCount) : '—'
        );
    }

    // Capability gaps row
    if (obligations && Array.isArray(obligations) && obligations.length > 0) {
        const capGapCount = obligations.filter(obl => obl.type === 'capability-gap').length;
        if (capGapCount > 0) {
            html += `<tr><td>Capability gaps</td><td>0</td><td>${capGapCount}</td><td style="color:#d4351c;font-weight:bold;">+${capGapCount}</td></tr>`;
        }
    }

    html += `</tbody></table>`;
    return html;
}

/**
 * Groups decisions by tier and builds the decisions-by-tier section.
 * @param {Map} decisions
 * @param {Array} obligations
 * @param {Object} weights
 * @returns {string}
 */
function buildDecisionsByTier(decisions, obligations, weights) {
    if (decisions.size === 0) {
        return '<p style="color:#505a5f;">No decisions recorded yet.</p>';
    }

    // Group by tier
    const tiers = { 1: [], 2: [], 3: [] };
    decisions.forEach(decision => {
        const tier = state.tierMap.get(decision.functionId) || 3;
        tiers[tier].push(decision);
    });

    let html = '';

    for (const tier of [1, 2, 3]) {
        const decList = tiers[tier];
        if (decList.length === 0) continue;

        const colour = tierColour(tier);
        html += `<h3><span class="tier-badge" style="background:${escHtml(colour)};">${escHtml(tierLabel(tier))}</span> (${decList.length} decision${decList.length !== 1 ? 's' : ''})</h3>`;

        html += `<table>`;
        html += `<thead><tr><th scope="col">Function</th><th scope="col">Successor</th><th scope="col">Decision</th><th scope="col">System</th><th scope="col">Obligations</th></tr></thead>`;
        html += `<tbody>`;

        for (const decision of decList) {
            const funcEntry = state.lgaFunctionMap.get(decision.functionId);
            const funcLabel = funcEntry ? funcEntry.label : decision.functionId;

            let systemLabel = '—';
            if (decision.systemChoice === 'choose' && decision.retainedSystemIds.length > 0) {
                const allocations = getDecisionSystems(decision);
                const retained = allocations.find(a => a.system && decision.retainedSystemIds.includes(a.system.id));
                if (retained) systemLabel = retained.system.label || retained.system.id;
            } else if (decision.systemChoice === 'procure' && decision.procuredSystem) {
                systemLabel = decision.procuredSystem.label + ' (new procurement)';
            } else if (decision.systemChoice === 'defer') {
                systemLabel = 'Deferred';
            }

            const funcObligations = obligations.filter(obl => obl.functionId === decision.functionId);
            const sevCounts = countBySeverity(funcObligations, weights);

            html += `<tr>`;
            html += `<td>${escHtml(funcLabel)}</td>`;
            html += `<td>${escHtml(decision.successorName)}</td>`;
            html += `<td>${escHtml(decisionLabel(decision.systemChoice))}</td>`;
            html += `<td>${escHtml(systemLabel)}</td>`;
            html += `<td>${escHtml(formatSeverityCounts(sevCounts))}</td>`;
            html += `</tr>`;
        }

        html += `</tbody></table>`;
    }

    return html;
}

/**
 * Builds the critical obligations section (unresolved + high severity).
 * @param {Array} obligations
 * @param {Object} weights
 * @returns {string}
 */
function buildCriticalObligations(obligations, weights) {
    const critical = obligations.filter(obl =>
        !obl.resolved && computeObligationSeverity(obl, weights) === 'high'
    );

    if (critical.length === 0) {
        return '<p style="color:#505a5f;">No critical unresolved obligations.</p>';
    }

    let html = `<table>`;
    html += `<thead><tr><th scope="col">Function</th><th scope="col">System</th><th scope="col">Type</th><th scope="col">Successors Affected</th><th scope="col">Notes</th></tr></thead>`;
    html += `<tbody>`;

    for (const obl of critical) {
        const bullets = generateMigrationScopeBullets(obl);
        const notesHtml = bullets.length > 0
            ? bullets.map(b => escHtml(b)).join('; ')
            : '—';

        html += `<tr>`;
        html += `<td>${escHtml(obl.functionLabel || obl.functionId || '—')}</td>`;
        html += `<td>${escHtml(obl.fromSystem ? obl.fromSystem.label : '—')}</td>`;
        html += `<td>${escHtml(obl.type)}</td>`;
        html += `<td>${escHtml((obl.affectedSuccessors || []).join(', '))}</td>`;
        html += `<td style="font-size:12px;">${notesHtml}</td>`;
        html += `</tr>`;
    }

    html += `</tbody></table>`;
    return html;
}

/**
 * Builds the governance arrangements section.
 * @param {Array} obligations
 * @param {boolean} includeBullets - whether to include governanceBullets
 * @returns {string}
 */
function buildGovernanceArrangements(obligations, includeBullets) {
    const govObls = obligations.filter(obl => obl.type === 'shared-service-governance');

    if (govObls.length === 0) {
        return '<p style="color:#505a5f;">No shared service governance arrangements recorded.</p>';
    }

    let html = `<table>`;
    const headers = includeBullets
        ? `<tr><th scope="col">Function</th><th scope="col">Shared Service</th><th scope="col">Host Authority</th><th scope="col">Participating Successors</th><th scope="col">Governance Points</th></tr>`
        : `<tr><th scope="col">Function</th><th scope="col">Shared Service</th><th scope="col">Host Authority</th><th scope="col">Participating Successors</th></tr>`;
    html += `<thead>${headers}</thead>`;
    html += `<tbody>`;

    for (const obl of govObls) {
        const sharedSuccessors = (obl.sharedSuccessors || []).join(', ') || '—';
        const primarySuccessor = obl.primarySuccessor || '—';
        const systemLabel = obl.fromSystem ? obl.fromSystem.label : '—';
        const funcLabel = obl.functionLabel || obl.functionId || '—';

        html += `<tr>`;
        html += `<td>${escHtml(funcLabel)}</td>`;
        html += `<td>${escHtml(systemLabel)}</td>`;
        html += `<td>${escHtml(primarySuccessor)}</td>`;
        html += `<td>${escHtml(sharedSuccessors)}</td>`;

        if (includeBullets) {
            const bullets = obl.governanceBullets || generateMigrationScopeBullets(obl);
            const bulletsHtml = bullets.length > 0
                ? `<ul class="scope-bullets">${bullets.map(b => `<li>${escHtml(b)}</li>`).join('')}</ul>`
                : '—';
            html += `<td>${bulletsHtml}</td>`;
        }

        html += `</tr>`;
    }

    html += `</tbody></table>`;
    return html;
}

/**
 * Builds the complete executive report.
 * @param {Map} decisions
 * @param {Object|null} impact
 * @param {Array} obligations
 * @returns {string}
 */
function buildExecutiveReport(decisions, impact, obligations) {
    const weights = state.signalWeights || {};
    let html = '';

    // Section 1: Estate Impact Summary
    html += `<h2>1. Estate Impact Summary</h2>`;
    html += buildEstateSummaryTable(impact, obligations);

    // Section 2: Decisions by Tier
    html += `<h2>2. Decisions by Tier</h2>`;
    html += buildDecisionsByTier(decisions, obligations, weights);

    // Section 3: Critical Obligations
    html += `<h2>3. Critical Obligations</h2>`;
    html += buildCriticalObligations(obligations, weights);

    // Section 4: Governance Arrangements
    html += `<h2>4. Governance Arrangements</h2>`;
    html += buildGovernanceArrangements(obligations, false);

    return html;
}

// ===================================================================
// COMMERCIAL REPORT
// ===================================================================

/**
 * Builds the cost summary section.
 * @param {Object|null} impact
 * @returns {string}
 */
function buildCostSummary(impact) {
    if (!impact) {
        return '<p style="color:#505a5f;">No cost data available — run simulation first.</p>';
    }

    const { before, after, delta } = impact;
    const currentSpend = formatCost(before.totalAnnualSpend);
    const projectedSpend = formatCost(after.totalAnnualSpend);
    const savings = delta.totalAnnualSpend !== null ? formatSpendDelta(delta.totalAnnualSpend) : '—';

    let html = `<table class="cost-summary-table">`;
    html += `<tbody>`;
    html += `<tr><td>Total current spend (annual)</td><td>${escHtml(currentSpend)}</td></tr>`;
    html += `<tr><td>Projected spend (annual)</td><td>${escHtml(projectedSpend)}</td></tr>`;
    const changeColour = delta.totalAnnualSpend === null || delta.totalAnnualSpend === 0 ? '#0b0c0c' : delta.totalAnnualSpend < 0 ? '#00703c' : '#d4351c';
    html += `<tr><td>Estimated change</td><td style="color:${changeColour};">${escHtml(savings)}</td></tr>`;
    html += `</tbody></table>`;
    return html;
}

/**
 * Builds the decisions with contract detail section.
 * @param {Map} decisions
 * @returns {string}
 */
function buildDecisionsWithContractDetail(decisions) {
    if (decisions.size === 0) {
        return '<p style="color:#505a5f;">No decisions recorded yet.</p>';
    }

    let html = '';

    decisions.forEach(decision => {
        const funcEntry = state.lgaFunctionMap.get(decision.functionId);
        const funcLabel = funcEntry ? funcEntry.label : decision.functionId;
        const allocations = getDecisionSystems(decision);

        const tier = state.tierMap.get(decision.functionId) || 3;
        const colour = tierColour(tier);

        const blockClass = decision.systemChoice === 'defer' ? 'decision-block deferred'
            : decision.systemChoice === 'procure' ? 'decision-block procured'
            : 'decision-block';

        html += `<div class="${escHtml(blockClass)}">`;
        html += `<p style="margin:0 0 4px 0;font-weight:bold;">${escHtml(funcLabel)} — ${escHtml(decision.successorName)} <span class="tier-badge" style="background:${escHtml(colour)};">${escHtml(tierLabel(tier))}</span></p>`;

        // Primary decision detail
        if (decision.systemChoice === 'choose' && decision.retainedSystemIds.length > 0) {
            const retainedAllocs = allocations.filter(a => a.system && decision.retainedSystemIds.includes(a.system.id));
            for (const ra of retainedAllocs) {
                const sys = ra.system;
                html += `<p style="margin:2px 0;"><strong>Decision:</strong> Choose — ${escHtml(sys.label || sys.id)}</p>`;
                html += `<p style="margin:2px 0;font-size:12px;color:#505a5f;">`;
                if (sys.vendor) html += `Vendor: ${escHtml(sys.vendor)}&nbsp;&nbsp;|&nbsp;&nbsp;`;
                html += `Annual cost: ${escHtml(formatCost(sys.annualCost))}&nbsp;&nbsp;|&nbsp;&nbsp;`;
                html += `Contract ends: ${escHtml(formatContractEnd(sys.endYear, sys.endMonth))}&nbsp;&nbsp;|&nbsp;&nbsp;`;
                html += `Notice: ${sys.noticePeriod ? sys.noticePeriod + ' months' : '—'}`;
                html += `</p>`;
                // Notice trigger date
                {
                    const trigger = computeNoticeTrigger(sys);
                    if (trigger) {
                        const vesting = state.transitionStructure ? state.transitionStructure.vestingDate : null;
                        const relative = formatVestingRelative(trigger.triggerTotalMonths, vesting);
                        const triggerColour = trigger.isOverdue ? '#d4351c' : '#0b0c0c';
                        html += `<p style="margin:2px 0;font-size:13px;color:${triggerColour};font-weight:bold;">`;
                        html += `Notice trigger: ${escHtml(trigger.triggerDate)}`;
                        if (relative) html += ` (${escHtml(relative)})`;
                        if (trigger.isOverdue) html += ` — OVERDUE`;
                        html += `</p>`;
                    }
                }
            }
        } else if (decision.systemChoice === 'procure' && decision.procuredSystem) {
            const ps = decision.procuredSystem;
            html += `<p style="margin:2px 0;"><strong>Decision:</strong> Procure new — ${escHtml(ps.label)}</p>`;
            html += `<p style="margin:2px 0;font-size:12px;color:#505a5f;">`;
            if (ps.vendor) html += `Vendor: ${escHtml(ps.vendor)}&nbsp;&nbsp;|&nbsp;&nbsp;`;
            html += `Annual cost: ${escHtml(formatCost(ps.annualCost))}&nbsp;&nbsp;|&nbsp;&nbsp;`;
            html += `Hosting: ${ps.isCloud ? 'Cloud' : 'On-premise'}`;
            html += `</p>`;
        } else if (decision.systemChoice === 'defer') {
            html += `<p style="margin:2px 0;"><strong>Decision:</strong> Defer — no consolidation decision made</p>`;
            // Show deferred systems with notice trigger intelligence
            if (allocations.length > 0) {
                html += `<p style="margin:6px 0 2px 0;font-size:12px;font-weight:bold;">Systems running in parallel (${allocations.length}):</p>`;
                html += `<ul style="margin:0 0 0 16px;padding:0;font-size:12px;color:#505a5f;">`;
                for (const a of allocations) {
                    const sys = a.system;
                    if (!sys) continue;
                    const parts = [];
                    if (sys.vendor) parts.push(`vendor: ${sys.vendor}`);
                    if (sys.annualCost) parts.push(`${formatCost(sys.annualCost)}/yr`);
                    const contractEnd = formatContractEnd(sys.endYear, sys.endMonth);
                    if (contractEnd !== '—') parts.push(`contract ends: ${contractEnd}`);
                    html += `<li>${escHtml(sys.label || sys.id)}`;
                    if (parts.length > 0) html += ` (${escHtml(parts.join(', '))})`;
                    const trigger = computeNoticeTrigger(sys);
                    if (trigger) {
                        const vesting = state.transitionStructure ? state.transitionStructure.vestingDate : null;
                        const relative = formatVestingRelative(trigger.triggerTotalMonths, vesting);
                        const triggerColour = trigger.isOverdue ? '#d4351c' : '#b54c00';
                        html += ` <span style="color:${triggerColour};font-weight:bold;">`;
                        html += `Notice trigger: ${escHtml(trigger.triggerDate)}`;
                        if (relative) html += ` (${escHtml(relative)})`;
                        if (trigger.isOverdue) html += ` — OVERDUE`;
                        html += `</span>`;
                    }
                    html += `</li>`;
                }
                html += `</ul>`;
            }
        }

        // Decommissioned systems
        if (decision.systemChoice !== 'defer') {
            const retainedIds = new Set(decision.retainedSystemIds);
            const decommissioned = allocations.filter(a => a.system && !retainedIds.has(a.system.id));
            if (decommissioned.length > 0) {
                html += `<p style="margin:6px 0 2px 0;font-size:12px;font-weight:bold;">Decommissioned systems:</p>`;
                html += `<ul style="margin:0 0 0 16px;padding:0;font-size:12px;color:#505a5f;">`;
                for (const da of decommissioned) {
                    const sys = da.system;
                    html += `<li>${escHtml(sys.label || sys.id)}`;
                    const parts = [];
                    if (sys.annualCost) parts.push(`${formatCost(sys.annualCost)}/yr`);
                    if (sys.vendor) parts.push(`vendor: ${sys.vendor}`);
                    const contractEnd = formatContractEnd(sys.endYear, sys.endMonth);
                    if (contractEnd !== '—') parts.push(`contract ends: ${contractEnd}`);
                    if (parts.length > 0) html += ` (${escHtml(parts.join(', '))})`;
                    html += `</li>`;
                }
                html += `</ul>`;
            }
        }

        html += `</div>`;
    });

    return html;
}

/**
 * Builds the vendor consolidation section.
 * @param {Map} decisions
 * @returns {string}
 */
function buildVendorConsolidation(decisions) {
    const baselineAlloc = state.simulationState && state.simulationState.baselineAllocation;
    if (!baselineAlloc) {
        return '<p style="color:#505a5f;">No allocation data available.</p>';
    }

    // Count "before" vendors with system count and spend
    const beforeVendors = new Map(); // vendor -> { systemIds: Set, spend: number }
    baselineAlloc.forEach(funcMap => {
        funcMap.forEach(allocations => {
            for (const a of allocations) {
                if (a.system && a.system.vendor) {
                    if (!beforeVendors.has(a.system.vendor)) {
                        beforeVendors.set(a.system.vendor, { systemIds: new Set(), spend: 0 });
                    }
                    const entry = beforeVendors.get(a.system.vendor);
                    if (!entry.systemIds.has(a.system.id)) {
                        entry.systemIds.add(a.system.id);
                        entry.spend += (typeof a.system.annualCost === 'number' ? a.system.annualCost : 0);
                    }
                }
            }
        });
    });

    // Count "after" vendors (retained + procured) with spend
    const afterVendors = new Map(); // vendor -> { systemIds: Set, spend: number }
    decisions.forEach(decision => {
        if (decision.systemChoice === 'choose') {
            const allocations = getDecisionSystems(decision);
            const retained = allocations.filter(a => a.system && decision.retainedSystemIds.includes(a.system.id));
            for (const ra of retained) {
                const sys = ra.system;
                if (sys.vendor) {
                    if (!afterVendors.has(sys.vendor)) afterVendors.set(sys.vendor, { systemIds: new Set(), spend: 0 });
                    const entry = afterVendors.get(sys.vendor);
                    if (!entry.systemIds.has(sys.id)) {
                        entry.systemIds.add(sys.id);
                        entry.spend += (typeof sys.annualCost === 'number' ? sys.annualCost : 0);
                    }
                }
            }
        } else if (decision.systemChoice === 'procure' && decision.procuredSystem && decision.procuredSystem.vendor) {
            const ps = decision.procuredSystem;
            const key = `${decision.functionId}::${decision.successorName}`;
            if (!afterVendors.has(ps.vendor)) afterVendors.set(ps.vendor, { systemIds: new Set(), spend: 0 });
            const entry = afterVendors.get(ps.vendor);
            if (!entry.systemIds.has(key)) {
                entry.systemIds.add(key);
                entry.spend += (typeof ps.annualCost === 'number' ? ps.annualCost : 0);
            }
        } else if (decision.systemChoice === 'defer') {
            // Deferred systems continue running — include them in "after"
            const allocations = getDecisionSystems(decision);
            for (const a of allocations) {
                const sys = a.system;
                if (sys && sys.vendor) {
                    if (!afterVendors.has(sys.vendor)) afterVendors.set(sys.vendor, { systemIds: new Set(), spend: 0 });
                    const entry = afterVendors.get(sys.vendor);
                    if (!entry.systemIds.has(sys.id)) {
                        entry.systemIds.add(sys.id);
                        entry.spend += (typeof sys.annualCost === 'number' ? sys.annualCost : 0);
                    }
                }
            }
        }
    });

    // Combine vendor sets
    const allVendors = new Set([...beforeVendors.keys(), ...afterVendors.keys()]);
    if (allVendors.size === 0) {
        return '<p style="color:#505a5f;">No vendor data available.</p>';
    }

    let html = `<table>`;
    html += `<thead><tr><th scope="col">Vendor</th><th scope="col">Before (systems)</th><th scope="col">Before (spend)</th><th scope="col">After (systems)</th><th scope="col">After (spend)</th><th scope="col">Spend change</th></tr></thead>`;
    html += `<tbody>`;

    const vendorRows = [];
    allVendors.forEach(vendor => {
        const bv = beforeVendors.get(vendor) || { systemIds: new Set(), spend: 0 };
        const av = afterVendors.get(vendor) || { systemIds: new Set(), spend: 0 };
        vendorRows.push({
            vendor,
            beforeCount: bv.systemIds.size,
            beforeSpend: bv.spend,
            afterCount: av.systemIds.size,
            afterSpend: av.spend,
            spendDelta: av.spend - bv.spend
        });
    });

    vendorRows.sort((a, b) => b.beforeSpend - a.beforeSpend);

    for (const row of vendorRows) {
        const deltaStr = row.spendDelta !== 0 ? formatSpendDelta(row.spendDelta) : '—';
        const deltaColour = row.spendDelta < 0 ? '#00703c' : row.spendDelta > 0 ? '#d4351c' : '#0b0c0c';
        html += `<tr>`;
        html += `<td>${escHtml(row.vendor)}</td>`;
        html += `<td>${row.beforeCount}</td>`;
        html += `<td>${escHtml(formatCost(row.beforeSpend))}</td>`;
        html += `<td>${row.afterCount}</td>`;
        html += `<td>${escHtml(formatCost(row.afterSpend))}</td>`;
        html += `<td style="color:${escHtml(deltaColour)};">${escHtml(deltaStr)}</td>`;
        html += `</tr>`;
    }

    html += `</tbody></table>`;
    return html;
}

/**
 * Builds the commercial obligations section (all obligations with cost data).
 * @param {Array} obligations
 * @returns {string}
 */
function buildCommercialObligations(obligations) {
    if (obligations.length === 0) {
        return '<p style="color:#505a5f;">No obligations recorded.</p>';
    }

    const weights = state.signalWeights || {};

    // Sort by severity (high first)
    const sorted = [...obligations].sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return (order[computeObligationSeverity(a, weights)] ?? 2) - (order[computeObligationSeverity(b, weights)] ?? 2);
    });

    let html = `<table>`;
    html += `<thead><tr><th scope="col">Function</th><th scope="col">From System</th><th scope="col">To System</th><th scope="col">Type</th><th scope="col">Severity</th><th scope="col">Cost</th><th scope="col">Contract End</th><th scope="col">Vendor</th></tr></thead>`;
    html += `<tbody>`;

    for (const obl of sorted) {
        const fs = obl.fromSystem;
        const ts = obl.toSystem;
        const sev = computeObligationSeverity(obl, weights);
        html += `<tr>`;
        html += `<td>${escHtml(obl.functionLabel || obl.functionId || '—')}</td>`;
        const typeDisplay = obl.type === 'capability-gap' && obl.capabilityType && obl.capabilityType.length > 0
            ? `Capability gap (${(obl.capabilityType || []).join(', ')})`
            : (obl.type || '').replace(/-/g, ' ');
        html += `<td>${escHtml(fs ? fs.label : '—')}</td>`;
        html += `<td>${escHtml(ts ? ts.label : '—')}</td>`;
        html += `<td>${escHtml(typeDisplay)}</td>`;
        html += `<td><span class="sev-${sev}">${escHtml(sev)}</span></td>`;
        html += `<td>${escHtml(fs ? formatCost(fs.annualCost) : '—')}</td>`;
        html += `<td>${escHtml(obl.contractEndDate || '—')}</td>`;
        html += `<td>${escHtml(fs && fs.vendor ? fs.vendor : '—')}</td>`;
        html += `</tr>`;
    }

    html += `</tbody></table>`;
    return html;
}

/**
 * Builds a date-ordered procurement action timeline table from all decisions.
 * @param {Map} decisions
 * @param {Array} [obligations]  Optional obligations array to add capability-gap entries
 * @returns {string}
 */
function buildProcurementTimeline(decisions, obligations) {
    const vestingDate = state.transitionStructure ? state.transitionStructure.vestingDate : null;
    const vesting = vestingDate;
    const rows = [];

    decisions.forEach(decision => {
        const funcEntry = state.lgaFunctionMap.get(decision.functionId);
        const funcLabel = funcEntry ? funcEntry.label : decision.functionId;
        const allocations = getDecisionSystems(decision);

        if (decision.systemChoice === 'choose') {
            const retainedIds = new Set(decision.retainedSystemIds);
            for (const a of allocations) {
                const sys = a.system;
                if (!sys) continue;
                const isRetained = retainedIds.has(sys.id);
                const actionType = isRetained ? 'Novate / renew' : 'Serve notice / exit';
                const trigger = computeNoticeTrigger(sys);
                if (!trigger) continue;
                const relative = formatVestingRelative(trigger.triggerTotalMonths, vesting);
                rows.push({
                    triggerDate: trigger.triggerDate,
                    triggerTotalMonths: trigger.triggerTotalMonths,
                    vestingRelative: relative,
                    systemLabel: sys.label || sys.id,
                    vendor: sys.vendor || '—',
                    functionLabel: funcLabel,
                    successorName: decision.successorName,
                    actionType,
                    isOverdue: trigger.isOverdue
                });
            }
        } else if (decision.systemChoice === 'defer') {
            for (const a of allocations) {
                const sys = a.system;
                if (!sys) continue;
                const trigger = computeNoticeTrigger(sys);
                if (!trigger) continue;
                const relative = formatVestingRelative(trigger.triggerTotalMonths, vesting);
                rows.push({
                    triggerDate: trigger.triggerDate,
                    triggerTotalMonths: trigger.triggerTotalMonths,
                    vestingRelative: relative,
                    systemLabel: sys.label || sys.id,
                    vendor: sys.vendor || '—',
                    functionLabel: funcLabel,
                    successorName: decision.successorName,
                    actionType: 'Decision needed (deferred)',
                    isOverdue: trigger.isOverdue
                });
            }
            // procure decisions: skip (no existing contract)
        }
    });

    // Add capability-gap entries where the removed system has contract data
    if (obligations && Array.isArray(obligations)) {
        const capGapObls = obligations.filter(obl => obl.type === 'capability-gap');
        for (const obl of capGapObls) {
            if (!obl.fromSystem) continue;
            const trigger = computeNoticeTrigger(obl.fromSystem);
            if (!trigger) continue;
            const relative = formatVestingRelative(trigger.triggerTotalMonths, vestingDate);
            rows.push({
                triggerDate: trigger.triggerDate,
                triggerTotalMonths: trigger.triggerTotalMonths,
                vestingRelative: relative,
                systemLabel: obl.fromSystem.label || obl.fromSystem.id || '—',
                vendor: obl.fromSystem.vendor || '—',
                functionLabel: obl.functionLabel || '—',
                successorName: (obl.affectedSuccessors || [])[0] || '—',
                actionType: `Capability gap (${(obl.capabilityType || []).join(', ')})`,
                isOverdue: trigger.isOverdue
            });
        }
    }

    if (rows.length === 0) {
        return '<p style="color:#505a5f;">No upcoming contract actions identified.</p>';
    }

    // Sort by trigger date ascending
    rows.sort((a, b) => a.triggerTotalMonths - b.triggerTotalMonths);

    let html = `<table>`;
    html += `<thead><tr>`;
    html += `<th scope="col">Notice Trigger</th>`;
    html += `<th scope="col">Vesting Context</th>`;
    html += `<th scope="col">System</th>`;
    html += `<th scope="col">Vendor</th>`;
    html += `<th scope="col">Function</th>`;
    html += `<th scope="col">Successor</th>`;
    html += `<th scope="col">Action Required</th>`;
    html += `</tr></thead>`;
    html += `<tbody>`;

    for (const row of rows) {
        const triggerStyle = row.isOverdue ? 'color:#d4351c;font-weight:bold;' : '';
        html += `<tr>`;
        html += `<td style="${triggerStyle}">${escHtml(row.triggerDate)}${row.isOverdue ? ' — OVERDUE' : ''}</td>`;
        html += `<td>${escHtml(row.vestingRelative || '—')}</td>`;
        html += `<td>${escHtml(row.systemLabel)}</td>`;
        html += `<td>${escHtml(row.vendor)}</td>`;
        html += `<td>${escHtml(row.functionLabel)}</td>`;
        html += `<td>${escHtml(row.successorName)}</td>`;
        html += `<td>${escHtml(row.actionType)}</td>`;
        html += `</tr>`;
    }

    html += `</tbody></table>`;
    return html;
}

/**
 * Builds the complete commercial report.
 * @param {Map} decisions
 * @param {Object|null} impact
 * @param {Array} obligations
 * @returns {string}
 */
function buildCommercialReport(decisions, impact, obligations) {
    let html = '';

    // Section 1: Cost Summary
    html += `<h2>1. Cost Summary</h2>`;
    html += buildCostSummary(impact);

    // Section 2: Decisions with Contract Detail
    html += `<h2>2. Decisions with Contract Detail</h2>`;
    html += buildDecisionsWithContractDetail(decisions);

    // Section 3: Vendor Consolidation
    html += `<h2>3. Vendor Consolidation</h2>`;
    html += buildVendorConsolidation(decisions);

    // Section 4: Obligations
    html += `<h2>4. Obligations</h2>`;
    html += buildCommercialObligations(obligations);

    // Section 5: Procurement Action Timeline
    html += `<h2>5. Procurement Action Timeline</h2>`;
    html += buildProcurementTimeline(decisions, obligations);

    // Section 6: Governance Arrangements
    html += `<h2>6. Governance Arrangements</h2>`;
    html += buildGovernanceArrangements(obligations, true);

    return html;
}

// ===================================================================
// ARCHITECT REPORT
// ===================================================================

/**
 * Builds the technical summary section.
 * @returns {string}
 */
function buildTechnicalSummary() {
    const baselineAlloc = state.simulationState && state.simulationState.baselineAllocation;
    if (!baselineAlloc) {
        return '<p style="color:#505a5f;">No allocation data available.</p>';
    }

    // Count from baseline
    function countTechCharacteristics(alloc) {
        const seenIds = new Set();
        let monolithic = 0, lowPortability = 0, erp = 0, onPrem = 0;
        alloc.forEach(funcMap => {
            funcMap.forEach(allocations => {
                for (const a of allocations) {
                    const sys = a.system;
                    if (!sys || seenIds.has(sys.id)) continue;
                    seenIds.add(sys.id);
                    if (sys.dataPartitioning === 'Monolithic') monolithic++;
                    if (sys.portability === 'Low') lowPortability++;
                    if (sys.isERP) erp++;
                    if (!sys.isCloud) onPrem++;
                }
            });
        });
        return { monolithic, lowPortability, erp, onPrem, total: seenIds.size };
    }

    const before = countTechCharacteristics(baselineAlloc);

    // Try to get post-simulation allocation
    const impact = state.simulationState && state.simulationState.lastImpact;
    const afterAlloc = impact && impact.afterAllocation;
    const after = afterAlloc ? countTechCharacteristics(afterAlloc) : null;

    const row = (label, beforeVal, afterVal) => {
        if (after !== null) {
            const delta = afterVal - beforeVal;
            const deltaStr = delta !== 0 ? (delta > 0 ? `+${delta}` : `${delta}`) : '0';
            const deltaColour = delta < 0 ? '#00703c' : delta > 0 ? '#d4351c' : '#0b0c0c';
            return `<tr><td>${escHtml(label)}</td><td>${beforeVal}</td><td>${afterVal}</td><td style="color:${deltaColour};">${escHtml(deltaStr)}</td></tr>`;
        }
        return `<tr><td>${escHtml(label)}</td><td>${beforeVal}</td></tr>`;
    };

    let html = `<table class="cost-summary-table">`;
    if (after !== null) {
        html += `<thead><tr><th scope="col">Characteristic</th><th scope="col">Before</th><th scope="col">After</th><th scope="col">Change</th></tr></thead>`;
    } else {
        html += `<thead><tr><th scope="col">Characteristic</th><th scope="col">Count</th></tr></thead>`;
    }
    html += `<tbody>`;
    html += row('Monolithic data stores', before.monolithic, after ? after.monolithic : null);
    html += row('Low portability systems', before.lowPortability, after ? after.lowPortability : null);
    html += row('ERP platforms', before.erp, after ? after.erp : null);
    html += row('On-premise systems', before.onPrem, after ? after.onPrem : null);
    html += row('Total unique systems', before.total, after ? after.total : null);
    html += `</tbody></table>`;

    // Add narrative synthesis when post-simulation data is available
    if (after !== null) {
        const bullets = generatePostureNarrative(before, after);
        if (bullets.length > 0) {
            html += `<div style="margin-top:12px;padding:8px 12px;background:#f3f2f1;border-left:4px solid #4c2c92;">`;
            html += `<p style="font-weight:bold;margin:0 0 4px 0;font-size:13px;">Technical posture summary</p>`;
            html += `<ul style="margin:0 0 0 16px;padding:0;font-size:13px;color:#0b0c0c;">`;
            bullets.forEach(b => { html += `<li>${escHtml(b)}</li>`; });
            html += `</ul>`;
            html += `</div>`;
        }
    }

    return html;
}

/**
 * Builds the decisions with data complexity section.
 * @param {Map} decisions
 * @returns {string}
 */
function buildDecisionsWithDataComplexity(decisions) {
    if (decisions.size === 0) {
        return '<p style="color:#505a5f;">No decisions recorded yet.</p>';
    }

    let html = '';

    decisions.forEach(decision => {
        const funcEntry = state.lgaFunctionMap.get(decision.functionId);
        const funcLabel = funcEntry ? funcEntry.label : decision.functionId;
        const allocations = getDecisionSystems(decision);
        const tier = state.tierMap.get(decision.functionId) || 3;
        const colour = tierColour(tier);

        html += `<div class="decision-block">`;
        html += `<p style="margin:0 0 4px 0;font-weight:bold;">${escHtml(funcLabel)} — ${escHtml(decision.successorName)} <span class="tier-badge" style="background:${escHtml(colour)};">${escHtml(tierLabel(tier))}</span></p>`;

        if (decision.systemChoice === 'choose' && decision.retainedSystemIds.length > 0) {
            const retainedAllocs = allocations.filter(a => a.system && decision.retainedSystemIds.includes(a.system.id));
            for (const ra of retainedAllocs) {
                const sys = ra.system;
                html += `<p style="margin:2px 0;"><strong>Decision:</strong> Choose — ${escHtml(sys.label || sys.id)}</p>`;
                html += `<p style="margin:2px 0;font-size:12px;color:#505a5f;">`;
                html += `Data partitioning: ${escHtml(sys.dataPartitioning || '—')}&nbsp;&nbsp;|&nbsp;&nbsp;`;
                html += `Portability: ${escHtml(sys.portability || '—')}&nbsp;&nbsp;|&nbsp;&nbsp;`;
                html += `Hosting: ${sys.isCloud ? 'Cloud' : 'On-premise'}&nbsp;&nbsp;|&nbsp;&nbsp;`;
                html += `ERP: ${sys.isERP ? 'Yes' : 'No'}`;
                html += `</p>`;

                // TCoP considerations
                const tcop = [];
                if (!sys.isCloud) tcop.push('Point 3 — System is on-premise; cloud migration should be assessed');
                if (sys.portability === 'Low') tcop.push('Point 4 — Low portability; vendor lock-in risk, exit plan required');
                if (sys.dataPartitioning === 'Monolithic') tcop.push('Point 5 — Monolithic data store; data extraction strategy needed');
                if (sys.isERP) tcop.push('Point 9 — ERP system; assess multi-authority integration complexity');
                if (tcop.length > 0) {
                    html += `<p style="margin:6px 0 2px 0;font-size:12px;font-weight:bold;">TCoP considerations:</p>`;
                    html += `<ul style="margin:0 0 0 16px;padding:0;font-size:12px;color:#505a5f;">`;
                    tcop.forEach(t => { html += `<li>${escHtml(t)}</li>`; });
                    html += `</ul>`;
                }
            }
        } else if (decision.systemChoice === 'procure' && decision.procuredSystem) {
            const ps = decision.procuredSystem;
            html += `<p style="margin:2px 0;"><strong>Decision:</strong> Procure new — ${escHtml(ps.label)}</p>`;
            html += `<p style="margin:2px 0;font-size:12px;color:#505a5f;">`;
            html += `Hosting: ${ps.isCloud ? 'Cloud' : 'On-premise or unspecified'}`;
            html += `</p>`;
        } else if (decision.systemChoice === 'defer') {
            html += `<p style="margin:2px 0;"><strong>Decision:</strong> Deferred</p>`;
            // Show data complexity of existing systems
            if (allocations.length > 0) {
                html += `<p style="margin:6px 0 2px 0;font-size:12px;font-weight:bold;">Existing systems (still running in parallel):</p>`;
                html += `<ul style="margin:0 0 0 16px;padding:0;font-size:12px;color:#505a5f;">`;
                for (const a of allocations) {
                    const sys = a.system;
                    if (!sys) continue;
                    html += `<li>${escHtml(sys.label || sys.id)}: `;
                    const flags = [];
                    if (sys.dataPartitioning === 'Monolithic') flags.push('Monolithic');
                    if (sys.portability === 'Low') flags.push('Low portability');
                    if (!sys.isCloud) flags.push('On-premise');
                    if (sys.isERP) flags.push('ERP');
                    html += flags.length > 0 ? escHtml(flags.join(', ')) : 'No flags';
                    html += `</li>`;
                }
                html += `</ul>`;
            }
        }

        html += `</div>`;
    });

    return html;
}

/**
 * Builds the architect obligations section (all obligations with data flags).
 * @param {Array} obligations
 * @returns {string}
 */
function buildArchitectObligations(obligations) {
    if (obligations.length === 0) {
        return '<p style="color:#505a5f;">No obligations recorded.</p>';
    }

    const weights = state.signalWeights || {};

    // Sort by severity (high first)
    const sorted = [...obligations].sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return (order[computeObligationSeverity(a, weights)] ?? 2) - (order[computeObligationSeverity(b, weights)] ?? 2);
    });

    let html = `<table>`;
    html += `<thead><tr><th scope="col">Function</th><th scope="col">From System</th><th scope="col">To System</th><th scope="col">Type</th><th scope="col">Severity</th><th scope="col">Capability</th><th scope="col">Monolithic</th><th scope="col">Low Portability</th><th scope="col">ERP</th><th scope="col">On-Prem</th><th scope="col">Migration Scope</th></tr></thead>`;
    html += `<tbody>`;

    for (const obl of sorted) {
        const fs = obl.fromSystem;
        const ts = obl.toSystem;
        const bullets = generateMigrationScopeBullets(obl);
        const scopeHtml = bullets.length > 0
            ? `<ul class="scope-bullets">${bullets.map(b => `<li>${escHtml(b)}</li>`).join('')}</ul>`
            : '—';

        const yesStyle = 'color:#d4351c;font-weight:bold;';
        const noStyle = 'color:#505a5f;';
        const sev = computeObligationSeverity(obl, weights);

        const capTypeStr = obl.capabilityType && obl.capabilityType.length > 0
            ? obl.capabilityType.join(', ')
            : '—';

        html += `<tr>`;
        html += `<td>${escHtml(obl.functionLabel || obl.functionId || '—')}</td>`;
        html += `<td>${escHtml(fs ? fs.label : '—')}</td>`;
        html += `<td>${escHtml(ts ? ts.label : '—')}</td>`;
        html += `<td>${escHtml(obl.type || '—')}</td>`;
        html += `<td><span class="sev-${sev}">${escHtml(sev)}</span></td>`;
        html += `<td>${escHtml(capTypeStr)}</td>`;
        html += `<td style="${obl.isMonolithic ? yesStyle : noStyle}">${obl.isMonolithic ? 'Yes' : 'No'}</td>`;
        html += `<td style="${obl.isLowPortability ? yesStyle : noStyle}">${obl.isLowPortability ? 'Yes' : 'No'}</td>`;
        html += `<td style="${obl.isERP ? yesStyle : noStyle}">${obl.isERP ? 'Yes' : 'No'}</td>`;
        html += `<td style="${obl.isOnPrem ? yesStyle : noStyle}">${obl.isOnPrem ? 'Yes' : 'No'}</td>`;
        html += `<td>${scopeHtml}</td>`;
        html += `</tr>`;
    }

    html += `</tbody></table>`;
    return html;
}

/**
 * Builds the complete architect report.
 * @param {Map} decisions
 * @param {Object|null} impact
 * @param {Array} obligations
 * @returns {string}
 */
function buildArchitectReport(decisions, impact, obligations) {
    let html = '';

    // Section 1: Estate Impact Summary
    html += `<h2>1. Estate Impact Summary</h2>`;
    html += buildEstateSummaryTable(impact, obligations);

    // Section 2: Technical Summary
    html += `<h2>2. Technical Summary</h2>`;
    html += buildTechnicalSummary();

    // Section 3: Decisions with Data Complexity
    html += `<h2>3. Decisions with Data Complexity</h2>`;
    html += buildDecisionsWithDataComplexity(decisions);

    // Section 4: Obligations
    html += `<h2>4. Obligations</h2>`;
    html += buildArchitectObligations(obligations);

    // Section 5: Governance Arrangements
    html += `<h2>5. Governance Arrangements</h2>`;
    html += buildGovernanceArrangements(obligations, true);

    return html;
}

// ===================================================================
// MAIN EXPORT FUNCTION
// ===================================================================

/**
 * Generates a persona-tailored report HTML and opens it in a new window.
 *
 * Reads state.activePersona, state.simulationState, state.lgaFunctionMap,
 * state.tierMap, state.signalWeights, state.transitionStructure.
 *
 * If no simulation results exist, shows an error message.
 */
export function exportReport() {
    const persona = state.activePersona || 'executive';
    const decisions = (state.simulationState && state.simulationState.decisions) || new Map();
    const impact = state.simulationState && state.simulationState.lastImpact;
    const obligations = (impact && impact.obligations) || [];

    let html = buildReportDocStart(persona);

    // Handle missing simulation state
    if (!state.simulationState) {
        html += buildReportHeader(persona, decisions);
        html += `<div style="border:2px solid #f47738;padding:16px;background:#fff7e6;margin-top:24px;">`;
        html += `<p style="font-weight:bold;color:#0b0c0c;">No simulation results to export. Make decisions first.</p>`;
        html += `<p>Open the Simulation workspace, make at least one function decision, then export again.</p>`;
        html += `</div>`;
        html += buildReportDocEnd();
    } else {
        html += buildReportHeader(persona, decisions);

        if (persona === 'executive') {
            html += buildExecutiveReport(decisions, impact, obligations);
        } else if (persona === 'commercial') {
            html += buildCommercialReport(decisions, impact, obligations);
        } else {
            html += buildArchitectReport(decisions, impact, obligations);
        }

        html += buildReportDocEnd();
    }

    const reportWindow = window.open('', '_blank');
    if (reportWindow) {
        reportWindow.document.write(html);
        reportWindow.document.close();
    }
}
