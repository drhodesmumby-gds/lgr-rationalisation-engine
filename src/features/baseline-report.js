// ===================================================================
// BASELINE ESTATE REPORT
// ===================================================================
//
// Generates a self-contained HTML report summarising the estate BEFORE
// simulation decisions are made. Available from Stage 3 dashboard via
// the "Baseline Report" button. Persona-tailored: executive, commercial,
// architect each get different sections and emphasis.

import { state } from '../state.js';
import { DEFAULT_TIER_MAP } from '../constants/tier-map.js';
import { computeSignals } from '../analysis/signals.js';
import { computeEstateSummaryMetrics } from '../analysis/metrics.js';
import { formatCost, escHtml, tierLabel, tierColour, personaLabel, personaColour, computeNoticeTrigger } from './report-export.js';

// ===================================================================
// HTML SCAFFOLDING
// ===================================================================

function buildDocStart(persona) {
    const colour = personaColour(persona);
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LGR Baseline Estate Report — ${escHtml(personaLabel(persona))}</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#0b0c0c;background:#fff;margin:0;padding:32px;}
.container{max-width:960px;margin:0 auto;}
table{width:100%;border-collapse:collapse;font-size:14px;}
th{text-align:left;padding:6px 12px;background:#f3f2f1;border-bottom:2px solid #0b0c0c;white-space:nowrap;}
td{padding:5px 12px;border-bottom:1px solid #b1b4b6;}
tr:nth-child(even){background:#f3f2f1;}
.section{margin-bottom:32px;}
.section h2{font-size:18px;font-weight:bold;margin:0 0 12px 0;padding-bottom:6px;border-bottom:2px solid #b1b4b6;}
.badge{font-size:11px;padding:1px 5px;border-radius:2px;color:#fff;display:inline-block;margin-left:6px;}
.badge-red{background:#d4351c;}
.badge-amber{background:#f47738;}
.badge-green{background:#00703c;}
.badge-blue{background:#1d70b8;}
.kv-table td:first-child{font-weight:normal;width:60%;}
.kv-table td:last-child{font-weight:bold;text-align:right;}
@media print{body{padding:16px;} tr{page-break-inside:avoid;}}
</style>
</head>
<body>
<div class="container">
<div style="border-top:8px solid ${colour};padding:20px 0 16px 0;margin-bottom:28px;border-bottom:2px solid #b1b4b6;">
`;
}

function buildDocEnd() {
    return `</div></body></html>`;
}

function buildHeader(persona) {
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
    const predList = Array.from(state.mergedArchitecture.councils || []).join(', ');

    let html = `<h1 style="font-size:26px;font-weight:bold;margin:0 0 4px 0;">LGR Baseline Estate Report</h1>`;
    html += `<p style="font-size:15px;color:#505a5f;margin:0 0 16px 0;">${escHtml(personaLabel(persona))}</p>`;
    html += `<table style="border-collapse:collapse;font-size:13px;width:auto;">`;
    html += `<tr><td style="padding:2px 16px 2px 0;font-weight:bold;">Generated</td><td>${timestamp}</td></tr>`;
    html += `<tr><td style="padding:2px 16px 2px 0;font-weight:bold;">Operating Mode</td><td>${state.operatingMode === 'transition' ? 'Transition Planning' : 'Estate Discovery'}</td></tr>`;
    if (state.transitionStructure) {
        html += `<tr><td style="padding:2px 16px 2px 0;font-weight:bold;">Vesting Date</td><td>${escHtml(state.transitionStructure.vestingDate || 'Not set')}</td></tr>`;
        if (state.transitionStructure.successors && state.transitionStructure.successors.length) {
            html += `<tr><td style="padding:2px 16px 2px 0;font-weight:bold;">Successors</td><td>${escHtml(state.transitionStructure.successors.map(s => s.name).join(', '))}</td></tr>`;
        }
    }
    html += `<tr><td style="padding:2px 16px 2px 0;font-weight:bold;">Predecessors</td><td>${escHtml(predList)}</td></tr>`;
    html += `</table></div>`;
    return html;
}

function section(title, body) {
    return `<div class="section"><h2>${escHtml(title)}</h2>${body}</div>`;
}

// ===================================================================
// SHARED DATA COMPUTATION
// ===================================================================

function getSystemsForFunction(entry) {
    const systems = [];
    const seen = new Set();
    entry.localNodeIds.forEach(fnNodeId => {
        state.mergedArchitecture.edges.forEach(e => {
            if (e.target === fnNodeId && e.relationship === 'REALIZES') {
                const sysNode = state.mergedArchitecture.nodes.find(n => n.id === e.source);
                if (sysNode && sysNode.type === 'ITSystem' && !seen.has(sysNode.id)) {
                    seen.add(sysNode.id);
                    systems.push(sysNode);
                }
            }
        });
    });
    return systems;
}

function getAllSystems() {
    return state.mergedArchitecture.nodes.filter(n => n.type === 'ITSystem');
}

// ===================================================================
// SECTION BUILDERS — SHARED
// ===================================================================

function buildEstateProfile() {
    const allSystems = getAllSystems();
    const predCount = state.mergedArchitecture.councils ? state.mergedArchitecture.councils.size : 0;
    const fnCount = state.lgaFunctionMap.size;
    let collisionCount = 0;
    state.lgaFunctionMap.forEach(entry => { if (entry.councils && entry.councils.size > 1) collisionCount++; });
    let totalSpend = 0;
    let hasSpend = false;
    allSystems.forEach(s => { if (typeof s.annualCost === 'number') { totalSpend += s.annualCost; hasSpend = true; } });

    let html = `<table class="kv-table">`;
    html += `<tr><td>Predecessor councils</td><td>${predCount}</td></tr>`;
    html += `<tr><td>IT systems</td><td>${allSystems.length}</td></tr>`;
    html += `<tr><td>Functions mapped</td><td>${fnCount}</td></tr>`;
    html += `<tr><td>Functions with collisions</td><td>${collisionCount}</td></tr>`;
    html += `<tr><td>Total annual estate spend</td><td>${hasSpend ? formatCost(totalSpend) : '—'}</td></tr>`;
    html += `</table>`;
    return section('1. Estate Profile', html);
}

function buildTierDistribution(sectionNum) {
    const tierCounts = { 1: 0, 2: 0, 3: 0 };
    const tier1Fns = [];
    state.lgaFunctionMap.forEach((entry, fId) => {
        const t = DEFAULT_TIER_MAP.get(fId) || 2;
        tierCounts[t] = (tierCounts[t] || 0) + 1;
        if (t === 1) tier1Fns.push(entry.label);
    });

    let html = `<table>`;
    html += `<tr><th>Tier</th><th>Label</th><th>Count</th></tr>`;
    html += `<tr><td>Tier 1</td><td>Day 1 Critical</td><td><strong>${tierCounts[1]}</strong></td></tr>`;
    html += `<tr><td>Tier 2</td><td>High Priority</td><td><strong>${tierCounts[2]}</strong></td></tr>`;
    html += `<tr><td>Tier 3</td><td>Post-Day 1</td><td><strong>${tierCounts[3]}</strong></td></tr>`;
    html += `</table>`;
    if (tier1Fns.length) {
        html += `<p style="font-size:13px;font-weight:bold;margin:12px 0 4px 0;">Tier 1 functions:</p>`;
        html += `<p style="font-size:13px;color:#0b0c0c;margin:0;">${tier1Fns.map(escHtml).join(', ')}</p>`;
    }
    return section(`${sectionNum}. Tier Distribution`, html);
}

// ===================================================================
// EXECUTIVE REPORT
// ===================================================================

function buildExecutiveReport() {
    let html = buildEstateProfile();

    // Section 2: Transition Risk Summary
    const allSystems = getAllSystems();
    const monolithCount = allSystems.filter(s => s.dataPartitioning === 'Monolithic' || s.isERP).length;
    const sharedCount = allSystems.filter(s => s.sharedWith && s.sharedWith.length > 0).length;
    const onPremCount = allSystems.filter(s => s.isCloud === false).length;

    let s2 = `<table class="kv-table">`;
    if (state.operatingMode === 'transition' && state.transitionStructure) {
        const vDate = new Date(state.transitionStructure.vestingDate);
        const vestingMonth = vDate.getFullYear() * 12 + (vDate.getMonth() + 1);
        let preVestingCount = 0;
        allSystems.forEach(sys => {
            const trigger = computeNoticeTrigger(sys);
            if (trigger && trigger.triggerTotalMonths < vestingMonth) preVestingCount++;
        });
        let disaggCount = 0;
        if (state.successorAllocationMap) {
            state.successorAllocationMap.forEach(funcMap => {
                funcMap.forEach(allocs => {
                    allocs.forEach(a => { if (a.isDisaggregation) disaggCount++; });
                });
            });
        }
        s2 += `<tr><td>Pre-vesting notice triggers</td><td>${preVestingCount}</td></tr>`;
        s2 += `<tr><td>Disaggregation candidates</td><td>${disaggCount}</td></tr>`;
    }
    s2 += `<tr><td>Monolithic / ERP systems</td><td>${monolithCount}</td></tr>`;
    s2 += `<tr><td>Shared service systems</td><td>${sharedCount}</td></tr>`;
    s2 += `<tr><td>On-premise systems</td><td>${onPremCount}</td></tr>`;
    s2 += `</table>`;
    html += section('2. Transition Risk Summary', s2);

    // Section 3: Tier Distribution
    html += buildTierDistribution(3);

    // Section 4: Critical Path Items (transition only)
    let s4 = '';
    if (state.operatingMode === 'transition' && state.transitionStructure) {
        const vDateCP = new Date(state.transitionStructure.vestingDate);
        const vestingMonthCP = vDateCP.getFullYear() * 12 + (vDateCP.getMonth() + 1);
        const now = new Date();
        const nowMonth = now.getFullYear() * 12 + (now.getMonth() + 1);
        const critItems = [];
        allSystems.forEach(sys => {
            const trigger = computeNoticeTrigger(sys);
            if (!trigger) return;
            if (trigger.triggerTotalMonths < vestingMonthCP) {
                const monthsBeforeVesting = vestingMonthCP - trigger.triggerTotalMonths;
                critItems.push({ sys, triggerTotalMonths: trigger.triggerTotalMonths, triggerDateStr: trigger.triggerDate, monthsBeforeVesting });
            }
        });
        critItems.sort((a, b) => a.triggerTotalMonths - b.triggerTotalMonths);
        if (critItems.length) {
            s4 = `<table><tr><th>System</th><th>Vendor</th><th>Contract End</th><th>Notice Period</th><th>Notice Trigger</th><th>Status</th></tr>`;
            critItems.forEach(item => {
                let badge = '';
                if (item.triggerTotalMonths < nowMonth) {
                    badge = `<span class="badge badge-red">OVERDUE</span>`;
                } else if (item.triggerTotalMonths - nowMonth <= 3) {
                    badge = `<span class="badge badge-amber">URGENT</span>`;
                }
                const endStr = item.sys.endYear + (item.sys.endMonth ? '/' + String(item.sys.endMonth).padStart(2, '0') : '');
                s4 += `<tr><td>${escHtml(item.sys.label)}${badge}</td><td>${escHtml(item.sys.vendor || '—')}</td><td>${endStr}</td><td>${item.sys.noticePeriod} months</td><td>${item.triggerDateStr}</td><td>${item.monthsBeforeVesting} months before vesting</td></tr>`;
            });
            s4 += `</table>`;
        } else {
            s4 = `<p style="color:#505a5f;font-size:14px;">No pre-vesting notice triggers identified.</p>`;
        }
    } else {
        s4 = `<p style="color:#505a5f;font-size:14px;">Critical path analysis requires transition mode with a vesting date.</p>`;
    }
    html += section('4. Critical Path Items', s4);

    // Section 5: Per-Successor Summary (transition only)
    let s5 = '';
    if (state.operatingMode === 'transition' && state.successorAllocationMap) {
        s5 = `<table><tr><th>Successor</th><th>Systems</th><th>Annual Spend</th><th>Disaggregations</th><th>Tier 1 Functions</th></tr>`;
        state.successorAllocationMap.forEach((funcMap, successorName) => {
            const seen = new Set();
            let spend = 0, disagg = 0, t1 = 0;
            funcMap.forEach((allocs, fId) => {
                if ((DEFAULT_TIER_MAP.get(fId) || 2) === 1) t1++;
                allocs.forEach(a => {
                    if (!a.system || seen.has(a.system.id)) return;
                    seen.add(a.system.id);
                    if (typeof a.system.annualCost === 'number') spend += a.system.annualCost;
                    if (a.isDisaggregation) disagg++;
                });
            });
            s5 += `<tr><td>${escHtml(successorName)}</td><td>${seen.size}</td><td>${formatCost(spend)}</td><td>${disagg}</td><td>${t1}</td></tr>`;
        });
        s5 += `</table>`;
    } else {
        s5 = `<p style="color:#505a5f;font-size:14px;">Per-successor breakdown requires transition mode.</p>`;
    }
    html += section('5. Per-Successor Summary', s5);

    // Section 6: Key Risk Indicators
    html += buildRiskIndicators(6);

    return html;
}

// ===================================================================
// COMMERCIAL REPORT
// ===================================================================

function buildCommercialReport() {
    let html = buildEstateProfile();

    // Section 2: Contract Landscape
    const allSystems = getAllSystems();
    const vendorMap = {};
    allSystems.forEach(s => {
        if (s.vendor && s.vendor !== 'In-House') {
            if (!vendorMap[s.vendor]) vendorMap[s.vendor] = { count: 0, spend: 0, councils: new Set() };
            vendorMap[s.vendor].count++;
            if (typeof s.annualCost === 'number') vendorMap[s.vendor].spend += s.annualCost;
            if (s._sourceCouncil) vendorMap[s.vendor].councils.add(s._sourceCouncil);
        }
    });
    const vendors = Object.entries(vendorMap).sort((a, b) => b[1].spend - a[1].spend);
    let s2 = '';
    if (vendors.length) {
        s2 = `<table><tr><th>Vendor</th><th>Systems</th><th>Councils</th><th>Annual Spend</th></tr>`;
        vendors.forEach(([name, data]) => {
            s2 += `<tr><td>${escHtml(name)}</td><td>${data.count}</td><td>${data.councils.size}</td><td>${formatCost(data.spend)}</td></tr>`;
        });
        s2 += `</table>`;
    } else {
        s2 = `<p style="color:#505a5f;font-size:14px;">No vendor data available.</p>`;
    }
    html += section('2. Vendor Landscape', s2);

    // Section 3: Procurement Urgency
    let s3 = '';
    const now = new Date();
    const nowMonth = now.getFullYear() * 12 + (now.getMonth() + 1);
    const urgencyItems = [];
    allSystems.forEach(sys => {
        const trigger = computeNoticeTrigger(sys);
        if (!trigger) return;
        const monthsAway = trigger.triggerTotalMonths - nowMonth;
        if (monthsAway <= 12) {
            urgencyItems.push({ sys, triggerTotalMonths: trigger.triggerTotalMonths, triggerDateStr: trigger.triggerDate, monthsAway });
        }
    });
    urgencyItems.sort((a, b) => a.triggerTotalMonths - b.triggerTotalMonths);
    if (urgencyItems.length) {
        s3 = `<p style="font-size:13px;color:#505a5f;margin-bottom:8px;">${urgencyItems.length} system(s) with notice triggers within 12 months:</p>`;
        s3 += `<table><tr><th>System</th><th>Vendor</th><th>Notice Trigger</th><th>Status</th></tr>`;
        urgencyItems.forEach(item => {
            let badge = '';
            if (item.monthsAway < 0) badge = `<span class="badge badge-red">OVERDUE</span>`;
            else if (item.monthsAway <= 3) badge = `<span class="badge badge-amber">URGENT</span>`;
            else badge = `<span class="badge badge-blue">UPCOMING</span>`;
            s3 += `<tr><td>${escHtml(item.sys.label)}</td><td>${escHtml(item.sys.vendor || '—')}</td><td>${item.triggerDateStr}</td><td>${badge}</td></tr>`;
        });
        s3 += `</table>`;
    } else {
        s3 = `<p style="color:#505a5f;font-size:14px;">No notice triggers within 12 months.</p>`;
    }
    html += section('3. Procurement Urgency (next 12 months)', s3);

    // Section 4: Tier Distribution
    html += buildTierDistribution(4);

    // Section 5: Per-Successor Spend (transition only)
    let s5 = '';
    if (state.operatingMode === 'transition' && state.successorAllocationMap) {
        s5 = `<table><tr><th>Successor</th><th>Systems</th><th>Annual Spend</th><th>Vendors</th></tr>`;
        state.successorAllocationMap.forEach((funcMap, successorName) => {
            const seen = new Set();
            const vendorSet = new Set();
            let spend = 0;
            funcMap.forEach(allocs => {
                allocs.forEach(a => {
                    if (!a.system || seen.has(a.system.id)) return;
                    seen.add(a.system.id);
                    if (typeof a.system.annualCost === 'number') spend += a.system.annualCost;
                    if (a.system.vendor) vendorSet.add(a.system.vendor);
                });
            });
            s5 += `<tr><td>${escHtml(successorName)}</td><td>${seen.size}</td><td>${formatCost(spend)}</td><td>${vendorSet.size}</td></tr>`;
        });
        s5 += `</table>`;
    } else {
        s5 = `<p style="color:#505a5f;font-size:14px;">Per-successor breakdown requires transition mode.</p>`;
    }
    html += section('5. Per-Successor Spend', s5);

    // Section 6: Key Risk Indicators
    html += buildRiskIndicators(6);

    return html;
}

// ===================================================================
// ARCHITECT REPORT
// ===================================================================

function buildArchitectReport() {
    let html = buildEstateProfile();

    // Section 2: Technical Posture
    const allSystems = getAllSystems();
    const cloudCount = allSystems.filter(s => s.isCloud === true).length;
    const onPremCount = allSystems.filter(s => s.isCloud === false).length;
    const unknownCount = allSystems.length - cloudCount - onPremCount;
    const highPort = allSystems.filter(s => s.portability === 'High').length;
    const medPort = allSystems.filter(s => s.portability === 'Medium').length;
    const lowPort = allSystems.filter(s => s.portability === 'Low').length;
    const erpCount = allSystems.filter(s => s.isERP).length;
    const monoCount = allSystems.filter(s => s.dataPartitioning === 'Monolithic').length;

    let s2 = `<table class="kv-table">`;
    s2 += `<tr><td>Cloud-hosted</td><td>${cloudCount}</td></tr>`;
    s2 += `<tr><td>On-premise</td><td>${onPremCount}</td></tr>`;
    s2 += `<tr><td>Hosting unknown</td><td>${unknownCount}</td></tr>`;
    s2 += `<tr><td>High portability</td><td>${highPort}</td></tr>`;
    s2 += `<tr><td>Medium portability</td><td>${medPort}</td></tr>`;
    s2 += `<tr><td>Low portability</td><td>${lowPort}</td></tr>`;
    s2 += `<tr><td>ERP systems</td><td>${erpCount}</td></tr>`;
    s2 += `<tr><td>Monolithic data partitioning</td><td>${monoCount}</td></tr>`;
    s2 += `</table>`;
    html += section('2. Technical Posture', s2);

    // Section 3: TCoP Gaps
    const tcopSystems = [];
    allSystems.forEach(sys => {
        const assessment = computeTcopAssessmentLocal(sys);
        if (assessment.concerns.length > 0) {
            tcopSystems.push({ sys, concerns: assessment.concerns });
        }
    });
    tcopSystems.sort((a, b) => b.concerns.length - a.concerns.length);
    let s3 = '';
    if (tcopSystems.length) {
        s3 = `<table><tr><th>System</th><th>TCoP Concerns</th></tr>`;
        tcopSystems.slice(0, 15).forEach(item => {
            s3 += `<tr><td>${escHtml(item.sys.label)}</td><td>${item.concerns.map(c => escHtml(c.description)).join('; ')}</td></tr>`;
        });
        s3 += `</table>`;
    } else {
        s3 = `<p style="color:#505a5f;font-size:14px;">No TCoP concerns detected.</p>`;
    }
    html += section('3. TCoP Gaps', s3);

    // Section 4: Tier Distribution
    html += buildTierDistribution(4);

    // Section 5: Key Risk Indicators
    html += buildRiskIndicators(5);

    return html;
}

// Inline TCoP assessment (avoids async import issues in IIFE bundle)
function computeTcopAssessmentLocal(system) {
    const concerns = [];
    const alignments = [];
    if (system.isCloud === false) concerns.push({ point: 5, description: 'On-premise — TCoP Point 5 recommends cloud first' });
    if (system.portability === 'Low') {
        concerns.push({ point: 3, description: 'Vendor lock-in — TCoP Point 3' });
        concerns.push({ point: 4, description: 'Low portability — TCoP Point 4' });
        concerns.push({ point: 11, description: 'Contract inflexibility — TCoP Point 11' });
    }
    if (system.isERP || system.dataPartitioning === 'Monolithic') {
        concerns.push({ point: 9, description: 'Monolithic architecture — TCoP Point 9' });
    }
    if (system.isCloud === true) alignments.push({ point: 5, description: 'Cloud first' });
    if (system.portability === 'High') alignments.push({ point: 4, description: 'Open standards' });
    return { concerns, alignments };
}


// ===================================================================
// SHARED: KEY RISK INDICATORS
// ===================================================================

function buildRiskIndicators(sectionNum) {
    const riskRows = [];
    state.lgaFunctionMap.forEach((entry, fId) => {
        const systems = getSystemsForFunction(entry);
        if (!systems.length) return;
        const signals = computeSignals(systems);
        const strongSigs = signals.filter(sg => sg.strong);
        if (!strongSigs.length) return;
        riskRows.push({ label: entry.label, tier: DEFAULT_TIER_MAP.get(fId) || 2, strongSigs });
    });
    riskRows.sort((a, b) => { if (a.tier !== b.tier) return a.tier - b.tier; return b.strongSigs.length - a.strongSigs.length; });
    const top10 = riskRows.slice(0, 10);

    let html = '';
    if (top10.length) {
        html = `<table><tr><th>Function</th><th>Tier</th><th>Key Signals</th></tr>`;
        top10.forEach(row => {
            html += `<tr><td>${escHtml(row.label)}</td><td>${row.tier}</td><td>${row.strongSigs.map(sg => escHtml(sg.label)).join(', ')}</td></tr>`;
        });
        html += `</table>`;
    } else {
        html = `<p style="color:#505a5f;font-size:14px;">No strong signals detected across functions.</p>`;
    }
    return section(`${sectionNum}. Key Risk Indicators`, html);
}

// ===================================================================
// MAIN EXPORT
// ===================================================================

export function exportBaselineReport() {
    const persona = state.activePersona || 'executive';

    let html = buildDocStart(persona);
    html += buildHeader(persona);

    if (persona === 'executive') {
        html += buildExecutiveReport();
    } else if (persona === 'commercial') {
        html += buildCommercialReport();
    } else {
        html += buildArchitectReport();
    }

    html += buildDocEnd();

    const reportWindow = window.open('', '_blank');
    if (reportWindow) {
        reportWindow.document.write(html);
        reportWindow.document.close();
    }
}
