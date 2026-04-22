// Default tier mapping: ESD function ID → playbook tier (1, 2, or 3)
// Tier 1: Day 1 critical — statutory and safeguarding services
// Tier 2: High priority — approaching contract renewal or regulatory compliance
// Tier 3: Post-Day 1 — can run behind the veneer
// Unmapped functions default to Tier 2
export const DEFAULT_TIER_MAP = new Map([
    // Tier 1 (Day 1 critical)
    ['148', 1], ['152', 1], ['3', 1], ['124', 1], ['146', 1], ['119', 1],
    ['116', 1], ['19', 1], ['130', 1], ['131', 1], ['65', 1], ['68', 1],
    ['142', 1], ['34', 1],
    // Tier 2 (High priority)
    ['109', 2], ['171', 2], ['99', 2], ['100', 2], ['101', 2], ['103', 2],
    ['66', 2], ['67', 2], ['69', 2], ['111', 2], ['54', 2], ['16', 2],
    ['15', 2],
    // Tier 3 (Post-Day 1)
    ['76', 3], ['72', 3], ['75', 3], ['73', 3], ['81', 3], ['78', 3],
    ['80', 3], ['36', 3], ['74', 3], ['79', 3]
]);
