import { state } from '../state.js';
import { classifyVestingZone, detectSharedServiceBoundary } from './allocation.js';

// --- TCoP alignment assessment (pure function) ---
// Accepts an ITSystem node and returns an object with `alignments` and
// `concerns` arrays, each containing { point, description }.
// Assesses the system against Technology Code of Practice criteria using
// existing schema fields: isCloud, portability, isERP, dataPartitioning.
export function computeTcopAssessment(system) {
    var alignments = [];
    var concerns = [];

    // Point 5: Cloud first
    if (system.isCloud === true) {
        alignments.push({ point: 5, description: 'Cloud first — aligns with TCoP Point 5' });
    } else if (system.isCloud === false) {
        concerns.push({ point: 5, description: 'On-premise hosting — TCoP Point 5 recommends cloud first' });
    }

    // Point 4: Open standards / portability
    if (system.portability === 'High') {
        alignments.push({ point: 4, description: 'Open standards — aligns with TCoP Point 4' });
    }

    // Points 3, 4, 11: Vendor lock-in risk (low portability)
    if (system.portability === 'Low') {
        concerns.push({ point: 3, description: 'Vendor lock-in risk — TCoP Point 3 (spend controls)' });
        concerns.push({ point: 4, description: 'Vendor lock-in risk — TCoP Point 4 (open standards)' });
        concerns.push({ point: 11, description: 'Vendor lock-in risk — TCoP Point 11 (contracts and commercial)' });
    }

    // Point 9: Modular components (monolithic ERP concern)
    if (system.isERP === true && system.dataPartitioning === 'Monolithic') {
        concerns.push({ point: 9, description: 'Monolithic architecture — TCoP Point 9 recommends modular components' });
    }

    return { alignments: alignments, concerns: concerns };
}

// --- Signal emphasis (display-time adjustment per rationalisation pattern) ---
// Accepts a RationalisationPattern string and the current signalWeights object.
// Returns a NEW weights object with emphasis adjustments applied (does not mutate input).
// extract patterns → +1 to dataMonolith, dataPortability (capped at 3)
// choose-and-consolidate → +1 to userVolume, vendorDensity, tcopAlignment (capped at 3)
// inherit-as-is → no changes
export function computeSignalEmphasis(pattern, weights) {
    var result = {};
    for (var key in weights) {
        if (Object.prototype.hasOwnProperty.call(weights, key)) {
            result[key] = weights[key];
        }
    }

    if (pattern === 'extract-and-partition' || pattern === 'extract-partition-and-consolidate') {
        result.dataMonolith = Math.min((result.dataMonolith || 0) + 1, 3);
        result.dataPortability = Math.min((result.dataPortability || 0) + 1, 3);
    } else if (pattern === 'choose-and-consolidate') {
        result.userVolume = Math.min((result.userVolume || 0) + 1, 3);
        result.vendorDensity = Math.min((result.vendorDensity || 0) + 1, 3);
        result.tcopAlignment = Math.min((result.tcopAlignment || 0) + 1, 3);
    }
    // inherit-as-is → no changes

    return result;
}

// --- Vendor density metrics (pure function) ---
export function computeVendorDensityMetrics(systems) {
    var vendorMap = {};
    systems.forEach(function(sys) {
        var vendor = sys.vendor;
        if (!vendor) return;
        if (!vendorMap[vendor]) vendorMap[vendor] = { vendor: vendor, systemCount: 0, councils: new Set(), totalSpend: 0 };
        vendorMap[vendor].systemCount++;
        if (sys._sourceCouncil) vendorMap[vendor].councils.add(sys._sourceCouncil);
        if (typeof sys.annualCost === 'number') vendorMap[vendor].totalSpend += sys.annualCost;
    });
    return Object.values(vendorMap)
        .map(function(v) { return { vendor: v.vendor, systemCount: v.systemCount, councilCount: v.councils.size, councils: Array.from(v.councils).sort(), totalSpend: v.totalSpend }; })
        .sort(function(a, b) { return b.systemCount - a.systemCount; });
}

// --- Signal computation (neutral, factual) ---
// weightsOverride: optional object — when provided, used instead of global signalWeights
// This enables signal emphasis (display-time weight adjustments) without mutating user config
export function computeSignals(systems, weightsOverride) {
    const weights = weightsOverride || state.signalWeights;
    const signals = [];
    const now = new Date();
    const nowMonths = now.getFullYear() * 12 + now.getMonth();

    // Contract urgency: earliest notice trigger
    if (weights.contractUrgency > 0) {
        const dated = systems.filter(s => s.endYear);
        if (dated.length > 0) {
            if (state.transitionStructure?.vestingDate) {
                // Vesting-anchored contract analysis
                const zoneOrder = { 'pre-vesting': 0, 'year-1': 1, 'natural-expiry': 2, 'long-tail': 3 };
                const zoneLabels = {
                    'pre-vesting': 'Pre-vesting notice required',
                    'year-1': 'Year 1 successor window',
                    'natural-expiry': 'Natural expiry window',
                    'long-tail': 'Long-tail contract'
                };
                const classified = dated.map(s => ({
                    system: s,
                    zone: classifyVestingZone(s.endYear, s.endMonth, s.noticePeriod || 0, state.transitionStructure.vestingDate)
                }));
                // Find most urgent (lowest zone order, then earliest trigger)
                classified.sort((a, b) => {
                    const za = zoneOrder[a.zone], zb = zoneOrder[b.zone];
                    if (za !== zb) return za - zb;
                    const aM = a.system.endYear * 12 + (a.system.endMonth || 12) - (a.system.noticePeriod || 0);
                    const bM = b.system.endYear * 12 + (b.system.endMonth || 12) - (b.system.noticePeriod || 0);
                    return aM - bM;
                });
                const most = classified[0];
                const e = most.system;
                const zone = most.zone;
                const triggerMonths = e.endYear * 12 + (e.endMonth || 12) - (e.noticePeriod || 0);
                const vDate = new Date(state.transitionStructure.vestingDate);
                const vestingMonth = vDate.getFullYear() * 12 + (vDate.getMonth() + 1);
                const monthsDiff = triggerMonths - vestingMonth;
                const triggerY = Math.floor((triggerMonths - 1) / 12);
                const triggerM = ((triggerMonths - 1) % 12) + 1;

                let tag, strong, valueText;
                if (zone === 'pre-vesting') {
                    tag = 'tag-red'; strong = true;
                    valueText = `${e.label} · ${zoneLabels[zone]} — notice trigger ${String(triggerM).padStart(2,'0')}/${triggerY}, ${Math.abs(monthsDiff)} months before vesting — predecessor must serve notice`;
                } else if (zone === 'year-1') {
                    tag = 'tag-orange'; strong = true;
                    valueText = `${e.label} · ${zoneLabels[zone]} — notice trigger ${String(triggerM).padStart(2,'0')}/${triggerY}, ${monthsDiff} months after vesting`;
                } else if (zone === 'natural-expiry') {
                    tag = 'tag-blue'; strong = false;
                    valueText = `${e.label} · ${zoneLabels[zone]} — notice trigger ${String(triggerM).padStart(2,'0')}/${triggerY}, ${monthsDiff} months after vesting`;
                } else {
                    tag = 'tag-black'; strong = false;
                    valueText = `${e.label} · ${zoneLabels[zone]} — notice trigger ${String(triggerM).padStart(2,'0')}/${triggerY}, ${monthsDiff} months after vesting`;
                }
                signals.push({ id: 'contractUrgency', weight: weights.contractUrgency, label: 'Contract urgency',
                    value: valueText, tag, border: 'border-[#d4351c]', strong });
            } else {
                // Today-relative calculation (no vesting date)
                const sorted = [...dated].sort((a, b) => {
                    const aM = a.endYear * 12 + (a.endMonth || 1) - (a.noticePeriod || 0);
                    const bM = b.endYear * 12 + (b.endMonth || 1) - (b.noticePeriod || 0);
                    return aM - bM;
                });
                const e = sorted[0];
                const triggerMonths = e.endYear * 12 + (e.endMonth || 1) - (e.noticePeriod || 0);
                const monthsAway = triggerMonths - nowMonths;
                const triggerY = Math.floor((triggerMonths - 1) / 12);
                const triggerM = ((triggerMonths - 1) % 12) + 1;
                const tag = monthsAway < 12 ? 'tag-red' : monthsAway < 24 ? 'tag-orange' : 'tag-blue';
                signals.push({ id: 'contractUrgency', weight: weights.contractUrgency, label: 'Contract urgency',
                    value: `${e.label} · notice trigger ${String(triggerM).padStart(2,'0')}/${triggerY}`,
                    tag, border: 'border-[#d4351c]', strong: monthsAway < 18 });
            }
        }
    }

    // User volume: largest system and ratio to next
    if (weights.userVolume > 0) {
        const withUsers = systems.filter(s => s.users > 0);
        if (withUsers.length >= 2) {
            const sorted = [...withUsers].sort((a, b) => b.users - a.users);
            const ratio = sorted[1].users > 0 ? (sorted[0].users / sorted[1].users).toFixed(1) : null;
            signals.push({ id: 'userVolume', weight: weights.userVolume, label: 'User volume',
                value: `${sorted[0].label} largest · ${sorted[0].users.toLocaleString()} users${ratio ? ` (${ratio}× next)` : ''}`,
                tag: 'tag-black', border: 'border-[#ffdd00]', strong: ratio >= 1.5 });
        } else if (withUsers.length === 1) {
            signals.push({ id: 'userVolume', weight: weights.userVolume, label: 'User volume',
                value: `${withUsers[0].label} · ${withUsers[0].users.toLocaleString()} users (sole system)`,
                tag: 'tag-blue', border: 'border-[#1d70b8]', strong: false });
        }
    }

    // Monolithic data layer
    if (weights.dataMonolith > 0) {
        const mono = systems.filter(s => s.dataPartitioning === 'Monolithic' || s.isERP);
        if (mono.length > 0) {
            signals.push({ id: 'dataMonolith', weight: weights.dataMonolith, label: 'Monolithic data',
                value: `${mono.map(s => s.label).join(', ')} · data disaggregation would require ETL planning`,
                tag: 'tag-purple', border: 'border-[#53284f]', strong: true });
        }
    }

    // Data portability
    if (weights.dataPortability > 0) {
        const low  = systems.filter(s => s.portability === 'Low');
        const med  = systems.filter(s => s.portability === 'Medium');
        const worst = low.length > 0 ? low : med;
        if (worst.length > 0) {
            const level = low.length > 0 ? 'Low' : 'Medium';
            signals.push({ id: 'dataPortability', weight: weights.dataPortability, label: 'Data portability',
                value: `${worst.map(s => s.label).join(', ')} · ${level} portability`,
                tag: low.length > 0 ? 'tag-red' : 'tag-orange',
                border: low.length > 0 ? 'border-[#d4351c]' : 'border-[#f47738]', strong: low.length > 0 });
        }
    }

    // Vendor density
    if (weights.vendorDensity > 0) {
        const vm = {};
        systems.forEach(s => {
            if (s.vendor && s.vendor !== 'In-House') {
                if (!vm[s.vendor]) vm[s.vendor] = new Set();
                vm[s.vendor].add(s._sourceCouncil);
            }
        });
        const shared = Object.entries(vm).filter(([, cs]) => cs.size > 1);
        if (shared.length > 0) {
            signals.push({ id: 'vendorDensity', weight: weights.vendorDensity, label: 'Vendor density',
                value: shared.map(([v, cs]) => `${v} across ${cs.size} councils`).join('; '),
                tag: 'tag-blue', border: 'border-[#1d70b8]', strong: false });
        }
    }

    // On-premise tech debt
    if (weights.techDebt > 0) {
        const onPrem = systems.filter(s => !s.isCloud);
        if (onPrem.length > 0) {
            signals.push({ id: 'techDebt', weight: weights.techDebt, label: 'On-premise',
                value: `${onPrem.map(s => s.label).join(', ')}`,
                tag: 'tag-orange', border: 'border-[#f47738]', strong: false });
        }
    }

    // TCoP alignment signal
    if (weights.tcopAlignment > 0) {
        const allConcerns = [];
        const allAlignments = [];
        systems.forEach(s => {
            const assessment = computeTcopAssessment(s);
            assessment.concerns.forEach(c => allConcerns.push({ system: s.label, ...c }));
            assessment.alignments.forEach(a => allAlignments.push({ system: s.label, ...a }));
        });
        if (allConcerns.length > 0 || allAlignments.length > 0) {
            const parts = [];
            if (allConcerns.length > 0) {
                parts.push(allConcerns.map(c => `${c.system}: ${c.description}`).join('; '));
            }
            if (allAlignments.length > 0) {
                parts.push(allAlignments.map(a => `${a.system}: ${a.description}`).join('; '));
            }
            const valueText = parts.join(' · ') + ' · These are factors to consider alongside operational, commercial, and service-specific requirements.';
            let tag, strong;
            if (allConcerns.length > 0 && allAlignments.length === 0) {
                tag = 'tag-orange'; strong = true;
            } else if (allConcerns.length === 0 && allAlignments.length > 0) {
                tag = 'tag-green'; strong = false;
            } else {
                tag = 'tag-blue'; strong = allConcerns.length > allAlignments.length;
            }
            signals.push({ id: 'tcopAlignment', weight: weights.tcopAlignment, label: 'TCoP alignment',
                value: valueText, tag, border: 'border-[#1d70b8]', strong });
        }
    }

    // Shared service signal
    if (weights.sharedService > 0) {
        const sharedSystems = systems.filter(s => s.sharedWith && Array.isArray(s.sharedWith) && s.sharedWith.length > 0);
        if (sharedSystems.length > 0) {
            if (state.operatingMode === 'transition' && state.transitionStructure) {
                // Build councilToSuccessorMap from transitionStructure
                const councilToSuccessorMap = new Map();
                state.transitionStructure.successors.forEach(succ => {
                    (succ.fullPredecessors || []).forEach(c => {
                        if (!councilToSuccessorMap.has(c)) councilToSuccessorMap.set(c, []);
                        councilToSuccessorMap.get(c).push(succ.name);
                    });
                    (succ.partialPredecessors || []).forEach(c => {
                        if (!councilToSuccessorMap.has(c)) councilToSuccessorMap.set(c, []);
                        councilToSuccessorMap.get(c).push(succ.name);
                    });
                });

                const parts = [];
                let hasUnwinding = false;
                sharedSystems.forEach(s => {
                    const boundary = detectSharedServiceBoundary(s, councilToSuccessorMap);
                    if (boundary.unwinding) {
                        hasUnwinding = true;
                        parts.push(`${s.label}: shared service unwinding required — councils map to ${boundary.successors.join(', ')} — review contract ownership, data partition, and hosting arrangements`);
                    } else {
                        parts.push(`${s.label}: shared service continues within the same successor`);
                    }
                });

                const valueText = parts.join('; ');
                const tag = hasUnwinding ? 'tag-red' : 'tag-green';
                const strong = hasUnwinding;
                signals.push({ id: 'sharedService', weight: weights.sharedService, label: 'Shared service',
                    value: valueText, tag, border: hasUnwinding ? 'border-[#d4351c]' : 'border-[#00703c]', strong });
            } else {
                // Estate Discovery mode: note which councils share each system
                const parts = sharedSystems.map(s => {
                    const allCouncils = [s._sourceCouncil, ...s.sharedWith].filter(Boolean);
                    return `${s.label}: shared across ${allCouncils.join(', ')}`;
                });
                const valueText = parts.join('; ');
                signals.push({ id: 'sharedService', weight: weights.sharedService, label: 'Shared service',
                    value: valueText, tag: 'tag-blue', border: 'border-[#1d70b8]', strong: false });
            }
        }
    }

    return signals.sort((a, b) => b.weight - a.weight);
}
