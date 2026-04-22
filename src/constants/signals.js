// Signal definitions (neutral, factual labels)
export const SIGNAL_DEFS = [
    { id: 'contractUrgency', label: 'Contract urgency',   desc: 'Proximity of the earliest notice period trigger across systems in this function' },
    { id: 'userVolume',      label: 'User volume',        desc: 'Relative scale of systems by reported user count' },
    { id: 'dataMonolith',    label: 'Monolithic data',    desc: 'Systems with entangled data structures that would require ETL disaggregation' },
    { id: 'dataPortability', label: 'Data portability',   desc: 'Ease of bulk data extraction — Low portability indicates vendor lock-in risk' },
    { id: 'vendorDensity',   label: 'Vendor density',     desc: 'Same vendor present across multiple councils for this function' },
    { id: 'techDebt',        label: 'On-premise systems', desc: 'Systems hosted on council servers rather than cloud/SaaS' },
    { id: 'tcopAlignment',   label: 'TCoP alignment',     desc: 'Assessment against Technology Code of Practice criteria' },
    { id: 'sharedService',   label: 'Shared service',     desc: 'Systems jointly operated by multiple predecessor councils' }
];

// Per-persona default weights (0=Off, 1=Low, 2=Medium, 3=High)
export const PERSONA_DEFAULT_WEIGHTS = {
    executive:  { contractUrgency: 3, userVolume: 2, dataMonolith: 3, dataPortability: 1, vendorDensity: 2, techDebt: 1, tcopAlignment: 1, sharedService: 2 },
    commercial: { contractUrgency: 3, userVolume: 1, dataMonolith: 1, dataPortability: 0, vendorDensity: 3, techDebt: 0, tcopAlignment: 0, sharedService: 3 },
    architect:  { contractUrgency: 1, userVolume: 2, dataMonolith: 3, dataPortability: 3, vendorDensity: 1, techDebt: 3, tcopAlignment: 3, sharedService: 1 }
};
