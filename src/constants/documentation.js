export const DOCUMENTATION = {
    signals: {
        title: 'How Signals Are Computed',
        html: `
                    <p class="text-sm text-gray-700 mb-4">Signals are computed from system properties for each function cell. Each signal maps a raw property to a coloured indicator (Red = urgent, Amber = caution, Green = low concern, Blue = informational).</p>
                    <div class="space-y-4">
                        <div class="border-l-4 border-[#d4351c] pl-3">
                            <p class="font-bold text-sm">Contract Urgency</p>
                            <p class="text-sm text-gray-700">Classifies contract end relative to vesting date into 4 zones:<br>
                            <strong>Pre-vesting</strong> (red): notice trigger falls before vesting — predecessor must act now.<br>
                            <strong>Year 1</strong> (amber): notice trigger falls within 12 months after vesting.<br>
                            <strong>Natural expiry</strong> (blue): expires during transition but successor can handle at natural renewal.<br>
                            <strong>Long-tail</strong> (black): no imminent action needed.
                            </p>
                        </div>
                        <div class="border-l-4 border-[#ffdd00] pl-3">
                            <p class="font-bold text-sm">User Volume</p>
                            <p class="text-sm text-gray-700">Compares the largest system by user count to the second largest. A ratio of 1.5× or more triggers the strong indicator. Identifies anchor systems (migration gravity).</p>
                        </div>
                        <div class="border-l-4 border-[#53284f] pl-3">
                            <p class="font-bold text-sm">Monolithic Data</p>
                            <p class="text-sm text-gray-700">Flags systems where <code>isERP=true</code> or <code>dataPartitioning=Monolithic</code>. These systems require ETL planning for any disaggregation or migration.</p>
                        </div>
                        <div class="border-l-4 border-[#d4351c] pl-3">
                            <p class="font-bold text-sm">Data Portability</p>
                            <p class="text-sm text-gray-700">Maps the <code>portability</code> field: Low (red) = proprietary lock-in. Medium (amber) = batch/CSV exports. High portability systems are not flagged.</p>
                        </div>
                        <div class="border-l-4 border-[#1d70b8] pl-3">
                            <p class="font-bold text-sm">Vendor Density</p>
                            <p class="text-sm text-gray-700">Counts distinct vendors across councils for this function. When the same vendor appears across 2+ predecessors, there is a commercial consolidation opportunity.</p>
                        </div>
                        <div class="border-l-4 border-[#f47738] pl-3">
                            <p class="font-bold text-sm">Tech Debt (On-premise)</p>
                            <p class="text-sm text-gray-700">Identifies systems where <code>isCloud=false</code>. On-premise hosting may complicate licencing, hosting handover, and continuity planning.</p>
                        </div>
                        <div class="border-l-4 border-[#1d70b8] pl-3">
                            <p class="font-bold text-sm">TCoP Alignment</p>
                            <p class="text-sm text-gray-700">Evaluates each system against 5 Technology Code of Practice points:<br>
                            Point 3 (spend): vendor lock-in via low portability.<br>
                            Point 4 (open standards): portability field.<br>
                            Point 5 (cloud first): isCloud field.<br>
                            Point 9 (modularity): ERP + Monolithic combination.<br>
                            Point 11 (commercial): vendor lock-in via low portability.
                            </p>
                        </div>
                        <div class="border-l-4 border-[#1d70b8] pl-3">
                            <p class="font-bold text-sm">Shared Service</p>
                            <p class="text-sm text-gray-700">Detects systems with a <code>sharedWith</code> array. In transition mode, checks whether the sharing councils map to different successors — if so, the shared service must be unwound (red) or can continue within the same successor (green).</p>
                        </div>
                    </div>`
    },
    patterns: {
        title: 'Rationalisation Patterns',
        html: `
                    <p class="text-sm text-gray-700 mb-4">The rationalisation pattern is classified automatically in Transition Planning mode based on how systems are allocated across successors.</p>
                    <div class="space-y-4">
                        <div class="bg-[#eef7e6] border-l-4 border-[#00703c] p-3">
                            <p class="font-bold text-sm text-[#00703c]">Inherit as-is</p>
                            <p class="text-sm text-gray-700 mt-1">A single system serves this function for a single successor. No rationalisation decision needed. Focus on contract novation and licence transfer.</p>
                        </div>
                        <div class="bg-[#e8f0fb] border-l-4 border-[#1d70b8] p-3">
                            <p class="font-bold text-sm text-[#1d70b8]">Choose and consolidate</p>
                            <p class="text-sm text-gray-700 mt-1">Multiple predecessor systems compete for the same function within a single successor. One system is selected; others are decommissioned. Signal emphasis: User Volume + Vendor Density.</p>
                        </div>
                        <div class="bg-[#fce8e6] border-l-4 border-[#d4351c] p-3">
                            <p class="font-bold text-sm text-[#d4351c]">Extract and partition</p>
                            <p class="text-sm text-gray-700 mt-1">A system crosses successor boundaries and must be split. Each successor receives a partition of the data. Signal emphasis: Data Layer + Portability (highest risk for Monolithic systems).</p>
                        </div>
                        <div class="bg-[#f5eef8] border-l-4 border-[#53284f] p-3">
                            <p class="font-bold text-sm text-[#53284f]">Extract, partition and consolidate</p>
                            <p class="text-sm text-gray-700 mt-1">The most complex pattern: systems must be split across successors AND consolidated within each successor. Requires sequenced delivery — partition first, then consolidate. All signals elevated.</p>
                        </div>
                    </div>`
    },
    tcop: {
        title: 'TCoP Assessment Criteria',
        html: `
                    <p class="text-sm text-gray-700 mb-4">The Technology Code of Practice (TCoP) is the UK Government's framework for technology decisions. Five of the 11 points are directly assessable from system properties.</p>
                    <div class="space-y-3">
                        <div class="border border-gray-200 p-3">
                            <p class="font-bold text-sm">Point 3: Spend controls</p>
                            <p class="text-sm text-gray-700">Systems with Low portability trigger a concern — proprietary lock-in prevents competitive procurement and may trap the successor authority in unfavourable commercial terms.</p>
                        </div>
                        <div class="border border-gray-200 p-3">
                            <p class="font-bold text-sm">Point 4: Open standards</p>
                            <p class="text-sm text-gray-700">High portability systems (open APIs, REST) align with this point. Low portability systems raise a concern — no open data access restricts interoperability.</p>
                        </div>
                        <div class="border border-gray-200 p-3">
                            <p class="font-bold text-sm">Point 5: Cloud first</p>
                            <p class="text-sm text-gray-700">Cloud-hosted systems align with TCoP cloud first guidance. On-premise systems raise a concern and may require a hosting migration roadmap.</p>
                        </div>
                        <div class="border border-gray-200 p-3">
                            <p class="font-bold text-sm">Point 9: Modular components</p>
                            <p class="text-sm text-gray-700">Systems flagged as both ERP and Monolithic raise a concern — tightly coupled architectures are hard to replace or extend. Note: this is a structural risk flag, not an instruction to immediately decommission.</p>
                        </div>
                        <div class="border border-gray-200 p-3">
                            <p class="font-bold text-sm">Point 11: Commercial</p>
                            <p class="text-sm text-gray-700">Low portability also raises a Point 11 concern, as vendor lock-in undermines the successor authority's ability to achieve competitive commercial outcomes. Short notice periods can compound this risk.</p>
                        </div>
                    </div>`
    },
    tiers: {
        title: 'Tier Classification',
        html: `
                    <p class="text-sm text-gray-700 mb-4">Functions are assigned a default tier based on the MHCLG Playbook. The effective tier may differ from the default due to automatic promotion.</p>
                    <div class="space-y-4">
                        <div class="bg-red-50 border-l-4 border-[#d4351c] p-3">
                            <p class="font-bold text-sm text-[#d4351c]">Tier 1 — Day 1 Critical</p>
                            <p class="text-sm text-gray-700 mt-1">Statutory and safeguarding services that must be operational from vesting day. Examples: Adult social care, Children's services, Benefits, Finance, Fire safety, Homelessness.</p>
                        </div>
                        <div class="bg-orange-50 border-l-4 border-[#f47738] p-3">
                            <p class="font-bold text-sm text-[#f47738]">Tier 2 — High Priority</p>
                            <p class="text-sm text-gray-700 mt-1">Important services needed post-transition but not Day 1 critical. Examples: Highway maintenance, Planning, Housing, Licensing, Community safety. Functions not listed in the default map also default to Tier 2.</p>
                        </div>
                        <div class="bg-blue-50 border-l-4 border-[#1d70b8] p-3">
                            <p class="font-bold text-sm text-[#1d70b8]">Tier 3 — Post-Day 1</p>
                            <p class="text-sm text-gray-700 mt-1">Services that can be transitioned after the new authority is established. Examples: Libraries, Leisure, Museums, Arts, Tourism, Parks.</p>
                        </div>
                        <div class="bg-[#f3f2f1] border-l-4 border-[#0b0c0c] p-3">
                            <p class="font-bold text-sm">Tier 3 → Tier 2 Promotion</p>
                            <p class="text-sm text-gray-700 mt-1">A Tier 3 function is automatically promoted to Tier 2 if any system in that function has a contract notice trigger date that falls before the vesting date. This ensures commercially urgent Tier 3 functions are escalated for earlier attention.</p>
                        </div>
                    </div>`
    },
    perspectives: {
        title: 'Perspectives',
        html: `
                    <p class="text-sm text-gray-700 mb-4">The Perspective dropdown filters what is highlighted in the matrix.</p>
                    <ul class="list-disc pl-5 space-y-2 text-sm text-gray-700">
                        <li><strong>Unitary (All Councils) / All Successors:</strong> Shows the full merged estate. All columns are equally visible. Use for an overview of the whole transition.</li>
                        <li><strong>Specific council/successor perspective:</strong> Highlights that entity's column and dims others. Analysis cells focus signals on systems relevant to that entity. Use when working through planning for a specific successor authority.</li>
                    </ul>`
    },
    personas: {
        title: 'View Personas',
        html: `
                    <p class="text-sm text-gray-700 mb-4">Each persona applies a different default signal weighting, surfacing the most relevant risks for that role.</p>
                    <div class="space-y-3">
                        <div class="border-l-4 border-[#0b0c0c] pl-3">
                            <p class="font-bold text-sm">Executive / Transition Board</p>
                            <p class="text-sm text-gray-700">Prioritises Day 1 survival risks. High weight on contract urgency and monolithic data. Designed for transition board briefings and milestone reviews.</p>
                        </div>
                        <div class="border-l-4 border-[#00703c] pl-3">
                            <p class="font-bold text-sm">Commercial / Transition Director</p>
                            <p class="text-sm text-gray-700">Prioritises vendor density and shared services. Zero weight on portability and tech debt. Designed for procurement consolidation and contract negotiation.</p>
                        </div>
                        <div class="border-l-4 border-[#53284f] pl-3">
                            <p class="font-bold text-sm">Enterprise Architect (CTO)</p>
                            <p class="text-sm text-gray-700">Prioritises monolithic data, portability, tech debt, and TCoP alignment. Designed for architecture review and migration planning.</p>
                        </div>
                    </ul>
                    <p class="text-xs text-gray-500 mt-3">Signal weights can be customised further via Signal Options in the header.</p>`
    },
    metrics: {
        title: 'Estate Summary Metrics',
        html: `
                    <p class="text-sm text-gray-700 mb-4">The Estate Summary panel at the top of the dashboard provides high-level counts across the merged IT estate.</p>
                    <ul class="list-disc pl-5 space-y-2 text-sm text-gray-700">
                        <li><strong>Predecessor councils:</strong> Number of council architectures uploaded and merged.</li>
                        <li><strong>Total systems:</strong> Count of all ITSystem nodes across all uploaded architectures.</li>
                        <li><strong>Cross-council collisions:</strong> LGA functions where 2 or more councils have mapped systems — these are the primary rationalisation candidates.</li>
                        <li><strong>Total annual IT spend:</strong> Sum of all <code>annualCost</code> fields across systems. Only shown when at least one system has this field set.</li>
                        <li><strong>Pre-vesting notice triggers (Transition mode):</strong> Systems whose contract notice deadline falls before the vesting date — requiring the predecessor to serve notice before the new authority exists.</li>
                        <li><strong>Systems requiring disaggregation (Transition mode):</strong> Systems allocated to more than one successor (partial predecessors) that must be split.</li>
                        <li><strong>Monolithic + disaggregation (Transition mode):</strong> The most complex combination — monolithic systems that also require disaggregation.</li>
                        <li><strong>Cross-boundary shared services (Transition mode):</strong> Shared services whose participant councils map to different successors, requiring formal unwinding.</li>
                    </ul>`
    },
    timeline: {
        title: 'Contract Notice & Expiry Timeline',
        html: `
                    <p class="text-sm text-gray-700 mb-4">The timeline visualises the hard legal deadlines for each system's contract, centred around the vesting date (if configured).</p>
                    <ul class="list-disc pl-5 space-y-2 text-sm text-gray-700">
                        <li><strong>Solid bar:</strong> Spans from today (or chart start) to the contract expiry date.</li>
                        <li><strong>Striped zone (red):</strong> The Notice Period Action Zone — the mandatory notice window before expiry. Action must be taken before this zone begins to avoid auto-renewal.</li>
                        <li><strong>Dashed red vertical line:</strong> The vesting date. Contracts expiring before this line are pre-vesting risks.</li>
                    </ul>
                    <p class="text-xs text-gray-500 mt-3">The timeline is hidden in the Enterprise Architect persona as it focuses on structural risks rather than commercial deadlines.</p>`
    }
};
