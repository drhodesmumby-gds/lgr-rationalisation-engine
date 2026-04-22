import { computeTcopAssessment } from './signals.js';

export function generatePersonaQuestions(persona, pattern, signals, systems, anchorSystem, allocations, tierInfo) {
    const questions = [];

    // Helper: find signal by id
    const sig = id => signals.find(s => s.id === id);

    // Helper: total users with null guard
    const totalUsers = systems.reduce((sum, s) => sum + (s.users || 0), 0);
    const totalCost = systems.reduce((sum, s) => sum + (s.annualCost || 0), 0);
    const onPremCount = systems.filter(s => !s.isCloud).length;
    const monoSystems = systems.filter(s => s.dataPartitioning === 'Monolithic' || s.isERP);
    const lowPortability = systems.filter(s => s.portability === 'Low');
    const medPortability = systems.filter(s => s.portability === 'Medium');

    // Helper: get vendors and check for commonality
    const vendorMap = {};
    systems.forEach(s => {
        if (s.vendor && s.vendor !== 'In-House') {
            if (!vendorMap[s.vendor]) vendorMap[s.vendor] = [];
            vendorMap[s.vendor].push(s);
        }
    });
    const sharedVendors = Object.entries(vendorMap).filter(([, sysList]) => sysList.length > 1);

    // Helper: systems with notice periods
    const withNotice = systems.filter(s => s.noticePeriod && s.noticePeriod > 0 && s.endYear).sort((a, b) => {
        const aDate = new Date(a.endYear, (a.endMonth || 1) - 1, 1);
        const bDate = new Date(b.endYear, (b.endMonth || 1) - 1, 1);
        return aDate - bDate;
    });

    // Helper: cost savings estimate for consolidation
    const costSavingsText = () => {
        if (systems.length < 2 || totalCost === 0) return null;
        const sorted = [...systems].filter(s => s.annualCost > 0).sort((a, b) => b.annualCost - a.annualCost);
        if (sorted.length < 2) return null;
        const savings = sorted.slice(1).reduce((sum, s) => sum + s.annualCost, 0);
        const fmt = n => n >= 1000000 ? `£${(n/1000000).toFixed(1)}m` : n >= 1000 ? `£${(n/1000).toFixed(0)}k` : `£${n}`;
        return `Decommissioning non-retained systems could release approximately ${fmt(savings)}/yr, subject to exit costs and migration investment.`;
    };

    // Helper: nearest contract decision date
    const nearestDecision = () => {
        if (withNotice.length === 0) return null;
        const s = withNotice[0];
        const noticeStart = new Date(s.endYear, (s.endMonth || 1) - 1, 1);
        noticeStart.setMonth(noticeStart.getMonth() - (s.noticePeriod || 0));
        const now = new Date();
        const monthsUntil = Math.round((noticeStart - now) / (1000 * 60 * 60 * 24 * 30));
        if (monthsUntil <= 0) return { sys: s, text: `${s.label} notice period has already started — action required now.`, indicator: 'red' };
        if (monthsUntil <= 3) return { sys: s, text: `${s.label} notice window opens in approximately ${monthsUntil} month(s) — immediate attention required.`, indicator: 'red' };
        if (monthsUntil <= 12) return { sys: s, text: `${s.label} notice window opens in approximately ${monthsUntil} months.`, indicator: 'amber' };
        return { sys: s, text: `${s.label} notice window opens in approximately ${monthsUntil} months.`, indicator: 'green' };
    };

    // Helper: vesting zone signal
    const contractSig = sig('contractExpiry');
    const isPreVesting = contractSig && contractSig.tag === 'tag-red';
    const isYear1 = contractSig && contractSig.tag === 'tag-orange';

    const isExtract = pattern === 'extract-and-partition' || pattern === 'extract-partition-and-consolidate';
    const isConsolidate = pattern === 'choose-and-consolidate' || pattern === 'extract-partition-and-consolidate';

    // ===================== EXECUTIVE QUESTIONS =====================
    if (persona === 'executive' || persona === null) {

        // Q1: Day 1 operational readiness
        const isTier1 = tierInfo && tierInfo.tier === 1;
        const day1Answer = isTier1
            ? `This function has Tier 1 (Day 1 critical) designation. Systems must be operational from vesting day with no dependency on predecessor systems.`
            : `This function is not classified as Tier 1 critical. Standard transition arrangements apply — the service can operate behind a veneer strategy if needed during the immediate post-vesting period.`;
        questions.push({
            question: 'What needs to be operational on Day 1?',
            answer: day1Answer,
            indicator: isTier1 ? 'red' : 'blue',
            indicatorLabel: isTier1 ? 'Day 1 critical' : 'Not Tier 1'
        });

        // Q2: Contract decision timeline
        const decision = nearestDecision();
        questions.push({
            question: 'When must contract decisions be made?',
            answer: decision
                ? decision.text + (withNotice.length > 1 ? ` There are ${withNotice.length} systems with active notice periods requiring sequenced decisions.` : '')
                : 'No contract expiry data is available for systems in this function. Review system records to establish contract positions.',
            indicator: decision ? decision.indicator : 'neutral',
            indicatorLabel: decision ? (decision.indicator === 'red' ? 'Action now' : decision.indicator === 'amber' ? 'Soon' : 'Managed') : 'No data'
        });

        // Q3: Financial exposure
        const savings = costSavingsText();
        const costAnswer = totalCost > 0
            ? `Current combined annual spend across ${systems.length} system(s) is approximately £${totalCost >= 1000000 ? (totalCost/1000000).toFixed(1) + 'm' : (totalCost/1000).toFixed(0) + 'k'}/yr. ${savings || ''}`
            : 'Cost data is not fully available for all systems in this function. Consolidate financial records from predecessor councils to establish total exposure.';
        questions.push({
            question: 'What is the financial exposure?',
            answer: costAnswer,
            indicator: totalCost > 500000 ? 'amber' : totalCost > 0 ? 'green' : 'neutral',
            indicatorLabel: totalCost > 500000 ? 'High spend' : totalCost > 0 ? 'Manageable' : 'No data'
        });

        // Q4: Shared service risk
        const sharedSig = sig('sharedService');
        if (sharedSig) {
            questions.push({
                question: 'Is there a shared service at risk?',
                answer: sharedSig.value,
                indicator: sharedSig.tag === 'tag-red' ? 'red' : 'amber',
                indicatorLabel: sharedSig.tag === 'tag-red' ? 'Unwinding required' : 'Shared service present'
            });
        }

        // Q5 (consolidate patterns): Consolidation options
        if (isConsolidate) {
            const anchor = anchorSystem;
            const consolidateAnswer = anchor
                ? `${anchor.label} is the likely consolidation anchor based on user volume (${(anchor.users || 0).toLocaleString()} users). Portability is rated ${anchor.portability || 'unknown'}. Other systems in this function should be assessed for decommission sequencing. ${savings || ''}`
                : `No clear anchor system is identifiable from user volume data alone. Consider assessing portability, contract timelines, and TCoP alignment to identify the preferred consolidation candidate. ${savings || ''}`;
            questions.push({
                question: 'What are the consolidation options?',
                answer: consolidateAnswer,
                indicator: anchor ? 'blue' : 'amber',
                indicatorLabel: anchor ? 'Anchor identified' : 'Needs assessment'
            });
        }

        // Q6 (extract patterns): Data extraction complexity
        if (isExtract) {
            const monoAnswer = monoSystems.length > 0
                ? `${monoSystems.map(s => s.label).join(', ')} ${monoSystems.length === 1 ? 'has' : 'have'} a monolithic data layer. Partitioning will require dedicated ETL planning and may extend the transition timeline significantly.`
                : `Systems in this function have segmented data layers, which should support partition without full ETL redesign. Verify data mapping before committing to a timeline.`;
            questions.push({
                question: 'How complex is the data extraction?',
                answer: monoAnswer,
                indicator: monoSystems.length > 0 ? 'red' : 'green',
                indicatorLabel: monoSystems.length > 0 ? 'Complex extraction' : 'Manageable'
            });
        }
    }

    // ===================== COMMERCIAL QUESTIONS =====================
    if (persona === 'commercial' || persona === null) {

        // Q1: Vendor commonality
        if (sharedVendors.length > 0) {
            const vendorNames = sharedVendors.map(([v, sysList]) => `${v} (${sysList.length} systems)`).join(', ');
            questions.push({
                question: 'Can we leverage vendor commonality?',
                answer: `Vendor commonality exists: ${vendorNames}. This may support a volume renegotiation or unified contract, reducing administrative overhead and potentially improving pricing. Engage the vendor early to understand cross-authority licensing terms.`,
                indicator: 'green',
                indicatorLabel: 'Opportunity'
            });
        } else {
            const vendorCount = Object.keys(vendorMap).length;
            questions.push({
                question: 'Can we leverage vendor commonality?',
                answer: vendorCount > 1
                    ? `No vendor commonality detected across ${vendorCount} vendor(s). Each contract will need to be managed independently. Review whether any vendors offer multi-council licences.`
                    : systems.length > 0 && systems[0].vendor === 'In-House'
                        ? 'Systems in this function are in-house developed. No commercial vendor relationships to consolidate.'
                        : 'Insufficient vendor data to assess commonality. Ensure vendor fields are populated in system records.',
                indicator: vendorCount > 1 ? 'blue' : 'neutral',
                indicatorLabel: vendorCount > 1 ? 'No overlap' : 'No data'
            });
        }

        // Q2: Notice period constraints
        if (withNotice.length > 0) {
            const noticeList = withNotice.map(s =>
                `<li><strong>${s.label}</strong> — ${s.noticePeriod}mo notice, expires ${String(s.endMonth || 1).padStart(2,'0')}/${s.endYear}</li>`
            ).join('');
            const decision = nearestDecision();
            questions.push({
                question: 'What notice constraints apply?',
                answer: `${withNotice.length} system(s) have defined notice periods:<ul class="mt-1 ml-4 space-y-0.5 text-sm list-disc">${noticeList}</ul><p class="mt-2 text-sm">${decision ? decision.text : ''} Contract decisions must be sequenced to avoid inadvertent auto-renewal.</p>`,
                indicator: decision ? decision.indicator : 'blue',
                indicatorLabel: decision ? (decision.indicator === 'red' ? 'Action now' : 'Scheduled') : 'Review needed'
            });
        } else {
            questions.push({
                question: 'What notice constraints apply?',
                answer: 'No notice period data is available. Review contract terms for all systems to establish whether auto-renewal clauses apply and when notice windows open.',
                indicator: 'neutral',
                indicatorLabel: 'No data'
            });
        }

        // Q3: Cost paths
        const costFmt = n => n >= 1000000 ? `£${(n/1000000).toFixed(1)}m` : n >= 1000 ? `£${(n/1000).toFixed(0)}k` : n > 0 ? `£${n}` : null;
        const costedSystems = systems.filter(s => s.annualCost > 0);
        if (costedSystems.length > 0) {
            const costList = costedSystems
                .sort((a, b) => (b.annualCost || 0) - (a.annualCost || 0))
                .map(s => `<li><strong>${s.label}</strong> — ${costFmt(s.annualCost)}/yr${s.vendor ? ` <span class="text-gray-400">(${s.vendor})</span>` : ''}</li>`)
                .join('');
            questions.push({
                question: 'What are the cost paths?',
                answer: `<ul class="mt-1 ml-4 space-y-0.5 text-sm list-disc">${costList}</ul><p class="mt-2 text-sm font-semibold">Total combined spend: ${costFmt(totalCost) || '—'}/yr</p>${isConsolidate && costSavingsText() ? `<p class="mt-1 text-sm">${costSavingsText()}</p>` : ''}`,
                indicator: totalCost > 500000 ? 'amber' : 'blue',
                indicatorLabel: totalCost > 500000 ? 'High spend' : 'Costed'
            });
        } else {
            questions.push({
                question: 'What are the cost paths?',
                answer: 'Annual cost data is not available. Obtain spend data from predecessor finance teams to build a cost comparison.',
                indicator: 'neutral',
                indicatorLabel: 'No data'
            });
        }

        // Q4: Procurement consolidation opportunity
        const procAnswer = isConsolidate
            ? sharedVendors.length > 0
                ? `Procurement consolidation opportunity exists. Shared vendor(s) ${sharedVendors.map(([v]) => v).join(', ')} could support a single call-off under a new authority contract. Consider Crown Commercial Service frameworks (G-Cloud, DOS) where applicable.`
                : `No vendor commonality, but consolidation to a single system reduces contract overhead. Consider running a mini-competition under existing frameworks when consolidation decisions are finalised.`
            : `No active consolidation decision required for this pattern. Monitor contract renewal dates and vendor market developments.`;
        questions.push({
            question: isConsolidate ? 'What is the recommended procurement approach?' : 'Is there a procurement consolidation opportunity?',
            answer: procAnswer,
            indicator: isConsolidate && sharedVendors.length > 0 ? 'green' : 'blue',
            indicatorLabel: isConsolidate ? 'Action needed' : 'Informational'
        });

        // Q5: Portability risk for commercial
        if (lowPortability.length > 0 || medPortability.length > 0) {
            const riskSystems = [...lowPortability, ...medPortability];
            const riskList = riskSystems.map(s =>
                `<li><strong>${s.label}</strong> — ${s.portability} portability${s.vendor ? ` <span class="text-gray-400">(${s.vendor})</span>` : ''}</li>`
            ).join('');
            questions.push({
                question: 'What are the data exit and portability risks?',
                answer: `<ul class="mt-1 ml-4 space-y-0.5 text-sm list-disc">${riskList}</ul><p class="mt-2 text-sm">${lowPortability.length > 0 ? 'Low portability affects exit negotiating position and may increase switching costs.' : 'Medium portability — review export capabilities.'} Ensure data exit rights are clearly stated in contract terms and verify whether Data Processing Agreements cover the successor authority.</p>`,
                indicator: lowPortability.length > 0 ? 'red' : 'amber',
                indicatorLabel: lowPortability.length > 0 ? 'Exit risk' : 'Review needed'
            });
        }
    }

    // ===================== ARCHITECT QUESTIONS =====================
    if (persona === 'architect' || persona === null) {

        // Q1: Migration anchor
        const anchor = anchorSystem;
        questions.push({
            question: 'Which system should be the migration anchor?',
            answer: anchor
                ? `${anchor.label} is the strongest anchor candidate: ${(anchor.users || 0).toLocaleString()} users (proportionality threshold met). Portability: ${anchor.portability || 'unknown'}. ${anchor.isCloud ? 'Cloud-hosted.' : 'On-premise — cloud migration should be assessed.'} ${anchor.isERP ? 'ERP system — data extraction complexity is high.' : ''} Validate this with TCoP alignment and contract position before committing.`
                : `No clear anchor is identifiable from user volume data. Assess systems against: (1) data portability, (2) TCoP alignment, (3) cloud-native architecture, (4) vendor support roadmap, and (5) contract renewal timing.`,
            indicator: anchor ? 'blue' : 'amber',
            indicatorLabel: anchor ? 'Anchor identified' : 'Needs assessment'
        });

        // Q2: Data complexity — per-system breakdown
        const dataList = systems.map(s => {
            const flags = [];
            if (s.dataPartitioning === 'Monolithic') flags.push('<span class="text-[#d4351c] font-semibold">Monolithic</span>');
            else if (s.dataPartitioning) flags.push(`<span class="text-[#00703c]">${s.dataPartitioning}</span>`);
            if (s.isERP) flags.push('<span class="text-[#d4351c] font-semibold">ERP</span>');
            if (s.portability) flags.push(`Portability: <span class="${s.portability === 'Low' ? 'text-[#d4351c] font-semibold' : s.portability === 'High' ? 'text-[#00703c]' : ''}">${s.portability}</span>`);
            return `<li><strong>${s.label}</strong> — ${flags.join(' · ') || 'No data layer metadata'}</li>`;
        }).join('');
        let dataSummary = '';
        if (monoSystems.length > 0) {
            dataSummary = `Data disaggregation will require ETL planning. ${isExtract ? 'In an extract pattern, partition must precede consolidation — ensure data lineage is mapped before migration.' : 'Assess whether a clean logical partition exists before migration.'}`;
        } else if (lowPortability.length > 0) {
            dataSummary = 'No monolithic systems, but low portability increases data migration complexity. Verify API availability and bulk export capability.';
        } else {
            dataSummary = 'Segmented data layers with no low-portability flags. Data migration risk is lower — verify export formats and API compatibility.';
        }
        questions.push({
            question: 'What data complexity exists?',
            answer: `<ul class="mt-1 ml-4 space-y-0.5 text-sm list-disc">${dataList}</ul><p class="mt-2 text-sm">${dataSummary}</p>`,
            indicator: monoSystems.length > 0 ? 'red' : lowPortability.length > 0 ? 'amber' : 'green',
            indicatorLabel: monoSystems.length > 0 ? 'High complexity' : lowPortability.length > 0 ? 'Medium risk' : 'Lower risk'
        });

        // Q3: TCoP alignment — per-system structured assessment
        const perSystemTcop = systems.map(s => {
            const assess = computeTcopAssessment(s);
            return { label: s.label, alignments: assess.alignments, concerns: assess.concerns };
        }).filter(s => s.alignments.length > 0 || s.concerns.length > 0);
        const totalConcerns = perSystemTcop.reduce((n, s) => n + s.concerns.length, 0);
        const totalAligns = perSystemTcop.reduce((n, s) => n + s.alignments.length, 0);

        if (perSystemTcop.length > 0) {
            const tcopHtml = perSystemTcop.map(s => {
                const items = [
                    ...s.concerns.map(c => `<li class="text-[#d4351c]"><span class="text-gray-700">${c.description}</span></li>`),
                    ...s.alignments.map(a => `<li class="text-[#00703c]"><span class="text-gray-700">${a.description}</span></li>`)
                ].join('');
                return `<div class="mb-2"><strong class="text-sm">${s.label}</strong><ul class="ml-4 mt-0.5 space-y-0.5 text-sm list-disc">${items}</ul></div>`;
            }).join('');
            questions.push({
                question: 'Which approach aligns with the Technology Code of Practice?',
                answer: `${tcopHtml}<p class="mt-2 text-xs text-gray-500 italic">These are factors alongside operational and commercial requirements. See the full TCoP Assessment section below for detail.</p>`,
                indicator: totalConcerns > totalAligns ? 'amber' : totalAligns > 0 ? 'green' : 'neutral',
                indicatorLabel: totalConcerns > 0 ? 'Concerns present' : 'Aligned'
            });
        } else {
            questions.push({
                question: 'Which approach aligns with the Technology Code of Practice?',
                answer: 'Insufficient system metadata to assess TCoP alignment. Populate cloud, ERP, portability, and data partitioning fields for a full assessment.',
                indicator: 'neutral',
                indicatorLabel: 'No data'
            });
        }

        // Q4: On-premise exposure
        if (onPremCount > 0) {
            const onPremList = systems.filter(s => !s.isCloud).map(s =>
                `<li><strong>${s.label}</strong>${s.vendor ? ` <span class="text-gray-400">(${s.vendor})</span>` : ''}</li>`
            ).join('');
            questions.push({
                question: 'What is the on-premise exposure?',
                answer: `${onPremCount} of ${systems.length} system(s) are on-premise:<ul class="mt-1 ml-4 space-y-0.5 text-sm list-disc">${onPremList}</ul><p class="mt-2 text-sm">On-premise systems increase migration complexity, require infrastructure transition planning, and may conflict with cloud-first TCoP guidance (Point 5).</p>`,
                indicator: 'amber',
                indicatorLabel: 'On-premise present'
            });
        } else {
            questions.push({
                question: 'What is the on-premise exposure?',
                answer: 'All systems in this function are cloud-hosted. Infrastructure migration risk is lower. Verify SaaS contracts allow successor authority access and data residency requirements are met.',
                indicator: 'green',
                indicatorLabel: 'Cloud-native'
            });
        }

        // Q5 (extract): Data extraction strategy
        if (isExtract) {
            questions.push({
                question: 'What is the data extraction strategy?',
                answer: `In an extract-and-partition pattern, the recommended sequence is: (1) map data entities to successor boundaries, (2) verify API or bulk export capability, (3) build and test extraction pipeline, (4) run parallel operation, (5) cut over and decommission. ${monoSystems.length > 0 ? `Monolithic systems (${monoSystems.map(s => s.label).join(', ')}) will require ETL tooling and extended parallel running.` : 'Segmented data architecture supports cleaner extraction.'}`,
                indicator: monoSystems.length > 0 ? 'red' : 'blue',
                indicatorLabel: monoSystems.length > 0 ? 'ETL required' : 'Structured approach'
            });
        }

        // Q6 (consolidate): API and integration implications
        if (isConsolidate) {
            const portList = systems.map(s =>
                `<li><strong>${s.label}</strong> — ${s.portability || 'Unknown'} portability, ${s.isCloud ? 'cloud' : 'on-premise'}${s.vendor ? ` <span class="text-gray-400">(${s.vendor})</span>` : ''}</li>`
            ).join('');
            const lowPort = systems.filter(s => s.portability === 'Low');
            questions.push({
                question: 'What are the API and integration implications?',
                answer: `<ul class="mt-1 ml-4 space-y-0.5 text-sm list-disc">${portList}</ul><p class="mt-2 text-sm">${lowPort.length > 0
                    ? 'Low portability systems suggest limited API surface or proprietary data formats. Integration with the retained system will require vendor engagement.'
                    : 'Systems have Medium or High portability. Integration risk during consolidation is manageable.'} Document upstream/downstream integrations for each system before decommissioning.</p>`,
                indicator: lowPort.length > 0 ? 'amber' : 'green',
                indicatorLabel: lowPort.length > 0 ? 'Integration risk' : 'Manageable'
            });
        }
    }

    return questions;
}
