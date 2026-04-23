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
  table { border-collapse: collapse; width: 100%; font-size: 13px; margin-bottom: 16px; }
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
  .sev-medium { color: #f47738; font-weight: bold; }
  .sev-low { color: #6f777b; }

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
  ul.scope-bullets { margin: 4px 0 4px 18px; padding: 0; font-size: 12px; color: #505a5f; }
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
 * @returns {string}
 */
function buildEstateSummaryTable(impact) {
    if (!impact) {
        return '<p style="color:#505a5f;">No impact data available — run simulation first.</p>';
    }

    const { before, after, delta } = impact;

    const row = (label, beforeVal, afterVal, deltaVal) =>
        `<tr><td>${escHtml(label)}</td><td>${escHtml(String(beforeVal))}</td><td>${escHtml(String(afterVal))}</td><td>${escHtml(String(deltaVal))}</td></tr>`;

    let html = `<table>`;
    html += `<thead><tr><th>Metric</th><th>Before</th><th>After</th><th>Change</th></tr></thead>`;
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
        html += `<thead><tr><th>Function</th><th>Successor</th><th>Decision</th><th>System</th><th>Obligations</th></tr></thead>`;
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
    html += `<thead><tr><th>Function</th><th>System</th><th>Type</th><th>Successors Affected</th><th>Notes</th></tr></thead>`;
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
        ? `<tr><th>Function</th><th>Shared Service</th><th>Host Authority</th><th>Participating Successors</th><th>Governance Points</th></tr>`
        : `<tr><th>Function</th><th>Shared Service</th><th>Host Authority</th><th>Participating Successors</th></tr>`;
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
    html += buildEstateSummaryTable(impact);

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
    html += `<tr><td>Estimated change</td><td style="color:${delta.totalAnnualSpend !== null && delta.totalAnnualSpend < 0 ? '#00703c' : '#d4351c'};">${escHtml(savings)}</td></tr>`;
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

    // Count "before" vendors (all systems in baseline)
    const beforeVendors = new Map(); // vendor -> Set of system IDs
    baselineAlloc.forEach(funcMap => {
        funcMap.forEach(allocations => {
            for (const a of allocations) {
                if (a.system && a.system.vendor) {
                    if (!beforeVendors.has(a.system.vendor)) {
                        beforeVendors.set(a.system.vendor, new Set());
                    }
                    beforeVendors.get(a.system.vendor).add(a.system.id);
                }
            }
        });
    });

    // Count "after" vendors (retained + procured)
    const afterVendors = new Map(); // vendor -> Set of system labels
    decisions.forEach(decision => {
        if (decision.systemChoice === 'choose') {
            const allocations = getDecisionSystems(decision);
            const retained = allocations.filter(a => a.system && decision.retainedSystemIds.includes(a.system.id));
            for (const ra of retained) {
                const sys = ra.system;
                if (sys.vendor) {
                    if (!afterVendors.has(sys.vendor)) afterVendors.set(sys.vendor, new Set());
                    afterVendors.get(sys.vendor).add(sys.id);
                }
            }
        } else if (decision.systemChoice === 'procure' && decision.procuredSystem && decision.procuredSystem.vendor) {
            const vendor = decision.procuredSystem.vendor;
            if (!afterVendors.has(vendor)) afterVendors.set(vendor, new Set());
            afterVendors.get(vendor).add(`${decision.functionId}::${decision.successorName}`);
        }
    });

    // Combine vendor sets
    const allVendors = new Set([...beforeVendors.keys(), ...afterVendors.keys()]);
    if (allVendors.size === 0) {
        return '<p style="color:#505a5f;">No vendor data available.</p>';
    }

    let html = `<table>`;
    html += `<thead><tr><th>Vendor</th><th>Before (systems)</th><th>After (systems)</th><th>Change</th></tr></thead>`;
    html += `<tbody>`;

    const vendorRows = [];
    allVendors.forEach(vendor => {
        const before = (beforeVendors.get(vendor) || new Set()).size;
        const after = (afterVendors.get(vendor) || new Set()).size;
        vendorRows.push({ vendor, before, after, delta: after - before });
    });

    vendorRows.sort((a, b) => b.before - a.before);

    for (const row of vendorRows) {
        const deltaStr = row.delta !== 0 ? formatDelta(row.delta) : '0';
        const deltaColour = row.delta < 0 ? '#00703c' : row.delta > 0 ? '#d4351c' : '#0b0c0c';
        html += `<tr>`;
        html += `<td>${escHtml(row.vendor)}</td>`;
        html += `<td>${row.before}</td>`;
        html += `<td>${row.after}</td>`;
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

    let html = `<table>`;
    html += `<thead><tr><th>Function</th><th>From System</th><th>To System</th><th>Type</th><th>Cost</th><th>Contract End</th><th>Vendor</th></tr></thead>`;
    html += `<tbody>`;

    for (const obl of obligations) {
        const fs = obl.fromSystem;
        const ts = obl.toSystem;
        html += `<tr>`;
        html += `<td>${escHtml(obl.functionLabel || obl.functionId || '—')}</td>`;
        html += `<td>${escHtml(fs ? fs.label : '—')}</td>`;
        html += `<td>${escHtml(ts ? ts.label : '—')}</td>`;
        html += `<td>${escHtml(obl.type)}</td>`;
        html += `<td>${escHtml(fs ? formatCost(fs.annualCost) : '—')}</td>`;
        html += `<td>${escHtml(obl.contractEndDate || '—')}</td>`;
        html += `<td>${escHtml(fs && fs.vendor ? fs.vendor : '—')}</td>`;
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

    // Section 5: Governance Arrangements
    html += `<h2>5. Governance Arrangements</h2>`;
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

    // Count technical characteristics across all systems in baseline
    const seenIds = new Set();
    let monolithicCount = 0;
    let lowPortabilityCount = 0;
    let erpCount = 0;
    let onPremCount = 0;

    baselineAlloc.forEach(funcMap => {
        funcMap.forEach(allocations => {
            for (const a of allocations) {
                const sys = a.system;
                if (!sys || seenIds.has(sys.id)) continue;
                seenIds.add(sys.id);
                if (sys.dataPartitioning === 'Monolithic') monolithicCount++;
                if (sys.portability === 'Low') lowPortabilityCount++;
                if (sys.isERP) erpCount++;
                if (!sys.isCloud) onPremCount++;
            }
        });
    });

    let html = `<table class="cost-summary-table">`;
    html += `<tbody>`;
    html += `<tr><td>Monolithic data stores</td><td>${monolithicCount}</td></tr>`;
    html += `<tr><td>Low portability systems</td><td>${lowPortabilityCount}</td></tr>`;
    html += `<tr><td>ERP platforms</td><td>${erpCount}</td></tr>`;
    html += `<tr><td>On-premise systems</td><td>${onPremCount}</td></tr>`;
    html += `<tr><td>Total unique systems assessed</td><td>${seenIds.size}</td></tr>`;
    html += `</tbody></table>`;
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

    let html = `<table>`;
    html += `<thead><tr><th>Function</th><th>From System</th><th>Monolithic</th><th>Low Portability</th><th>ERP</th><th>On-Prem</th><th>Migration Scope</th></tr></thead>`;
    html += `<tbody>`;

    for (const obl of obligations) {
        const fs = obl.fromSystem;
        const bullets = generateMigrationScopeBullets(obl);
        const scopeHtml = bullets.length > 0
            ? `<ul class="scope-bullets">${bullets.map(b => `<li>${escHtml(b)}</li>`).join('')}</ul>`
            : '—';

        const yesStyle = 'color:#d4351c;font-weight:bold;';
        const noStyle = 'color:#505a5f;';

        html += `<tr>`;
        html += `<td>${escHtml(obl.functionLabel || obl.functionId || '—')}</td>`;
        html += `<td>${escHtml(fs ? fs.label : '—')}</td>`;
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

    // Section 1: Technical Summary
    html += `<h2>1. Technical Summary</h2>`;
    html += buildTechnicalSummary();

    // Section 2: Decisions with Data Complexity
    html += `<h2>2. Decisions with Data Complexity</h2>`;
    html += buildDecisionsWithDataComplexity(decisions);

    // Section 3: Obligations
    html += `<h2>3. Obligations</h2>`;
    html += buildArchitectObligations(obligations);

    // Section 4: Governance Arrangements
    html += `<h2>4. Governance Arrangements</h2>`;
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
        html += `<p style="font-weight:bold;color:#f47738;">No simulation results to export. Make decisions first.</p>`;
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
