export const state = {
    rawUploads: [],
    mergedArchitecture: { nodes: [], edges: [], councils: new Set() },
    activePersona: 'executive',
    activePerspective: 'all',
    lgaFunctionMap: new Map(),
    signalWeights: null,  // initialized later from PERSONA_DEFAULT_WEIGHTS
    analysisModalData: [],
    transitionStructure: null,
    operatingMode: 'discovery',
    successorAllocationMap: null,
    pendingTransitionConfig: null,
    pendingScenario: null,
    tierMap: new Map(),
    councilTierMap: new Map(),
    distressedCouncils: new Set(),
    capabilityDependencies: new Map(),  // consumerId → Set<providerId>
    capabilityProviders: new Map(),     // providerId → Map<consumerId, capabilities[]>
    activeSortMode: 'tier',
    activeFilters: { tier: 'all', collision: 'all' },
    archEditorState: null,
    simulationState: null,
    headerCollapsed: false,
    bannerCollapsed: false,
    importWizardState: null,
    cardCollapseState: 'collapsed',  // 'collapsed' | 'expanded' — global default
    expandedCards: new Set(),         // Set of system IDs individually toggled to opposite of default
    activeTab: 'matrix',              // 'matrix' | 'overview' | 'timeline'
    matrixViewMode: 'hierarchy',      // 'hierarchy' | 'flat'
    activeDomainId: null,             // root category ID or custom workstream ID when drilled in
    customWorkstreams: [],            // [{ id, name, functionIds: string[] }]
    simPanelCollapsed: false,
    readinessFactors: {
        contractUrgency: true,
        disaggregationComplexity: true,
        unsupportedSystems: true,
        sharedServiceUnwinding: true
    },
};
