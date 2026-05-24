/**
 * SCHEMA_DEFINITIONS — single source of truth for all input file schemas used
 * by the LGR Rationalisation Engine.
 *
 * Two schemas are defined:
 *   architecture    — council architecture JSON file
 *   transitionConfig — transition configuration JSON file
 *
 * Field definition shape:
 * {
 *   name: string,
 *   type: 'string'|'number'|'boolean'|'array'|'object',
 *   required: boolean,
 *   description: string,
 *   enum?: string[],
 *   enumDescriptions?: Record<string, string>,
 *   const?: string,
 *   format?: string,
 *   min?: number,
 *   max?: number,
 *   items?: 'string',
 *   fields?: FieldDefinition[]
 * }
 */

export const SCHEMA_DEFINITIONS = {

    // -------------------------------------------------------------------------
    // Architecture file — one per council
    // -------------------------------------------------------------------------
    architecture: {
        title: 'Council Architecture File',
        description: 'Describes a single council\'s IT estate: its service functions, IT systems, and the relationships between them.',

        topLevel: [
            {
                name: 'councilName',
                type: 'string',
                required: true,
                description: 'Official council name'
            },
            {
                name: 'councilMetadata',
                type: 'object',
                required: false,
                description: 'Council classification',
                fields: [
                    {
                        name: 'tier',
                        type: 'string',
                        required: false,
                        description: 'Council tier',
                        enum: ['county', 'district', 'borough', 'unitary']
                    },
                    {
                        name: 'financialDistress',
                        type: 'boolean',
                        required: false,
                        description: 'Whether the council is under s114 notice or equivalent'
                    }
                ]
            },
            {
                name: 'nodes',
                type: 'array',
                required: true,
                description: 'Array of Function and ITSystem nodes'
            },
            {
                name: 'edges',
                type: 'array',
                required: true,
                description: 'Array of relationships between nodes'
            }
        ],

        nodeTypes: {
            Function: {
                fields: [
                    {
                        name: 'id',
                        type: 'string',
                        required: true,
                        description: 'Unique node identifier'
                    },
                    {
                        name: 'label',
                        type: 'string',
                        required: true,
                        description: 'Human-readable function name'
                    },
                    {
                        name: 'type',
                        type: 'string',
                        required: true,
                        description: 'Node type discriminator',
                        const: 'Function'
                    },
                    {
                        name: 'lgaFunctionId',
                        type: 'string',
                        required: true,
                        description: "ESD function taxonomy identifier (e.g. '148' for Adult Social Care)"
                    }
                ]
            },

            ITSystem: {
                fields: [
                    {
                        name: 'id',
                        type: 'string',
                        required: true,
                        description: 'Unique node identifier'
                    },
                    {
                        name: 'label',
                        type: 'string',
                        required: true,
                        description: 'System name as the council knows it'
                    },
                    {
                        name: 'type',
                        type: 'string',
                        required: true,
                        description: 'Node type discriminator',
                        const: 'ITSystem'
                    },
                    {
                        name: 'vendor',
                        type: 'string',
                        required: true,
                        description: "Software vendor, or 'In-House' if internally developed"
                    },
                    {
                        name: 'users',
                        type: 'number',
                        required: false,
                        description: 'Approximate staff user count'
                    },
                    {
                        name: 'annualCost',
                        type: 'number',
                        required: false,
                        description: 'Annual cost in pounds'
                    },
                    {
                        name: 'cost',
                        type: 'string',
                        required: false,
                        description: "Human-readable cost (e.g. '£950k/yr')"
                    },
                    {
                        name: 'endYear',
                        type: 'number',
                        required: false,
                        description: 'Contract expiry year'
                    },
                    {
                        name: 'endMonth',
                        type: 'number',
                        required: false,
                        min: 1,
                        max: 12,
                        description: 'Contract expiry month'
                    },
                    {
                        name: 'noticePeriod',
                        type: 'number',
                        required: false,
                        description: 'Months notice to exit contract'
                    },
                    {
                        name: 'portability',
                        type: 'string',
                        required: false,
                        description: 'Ease of bulk data extraction',
                        enum: ['High', 'Medium', 'Low'],
                        enumDescriptions: {
                            High: 'Open APIs, standard formats (CSV/XML/JSON), vendor provides export tools. Migration possible without vendor assistance.',
                            Medium: 'Some export capability exists but may require vendor support or have proprietary elements.',
                            Low: 'Proprietary format, no bulk export API. Significant vendor lock-in. Migration requires vendor cooperation.'
                        }
                    },
                    {
                        name: 'dataPartitioning',
                        type: 'string',
                        required: false,
                        description: 'How data is organised within the system',
                        enum: ['Segmented', 'Monolithic'],
                        enumDescriptions: {
                            Segmented: 'Data logically separated by service area. Can be split without major restructuring.',
                            Monolithic: 'Data entangled across all areas. Splitting requires ETL (Extract, Transform, Load) work.'
                        }
                    },
                    {
                        name: 'isCloud',
                        type: 'boolean',
                        required: false,
                        description: 'Whether hosted in cloud (true) or on-premise (false)'
                    },
                    {
                        name: 'isERP',
                        type: 'boolean',
                        required: false,
                        description: 'Whether this is an Enterprise Resource Planning system spanning multiple functions'
                    },
                    {
                        name: 'sharedWith',
                        type: 'array',
                        required: false,
                        items: 'string',
                        description: 'Names of other councils sharing this system instance'
                    },
                    {
                        name: 'targetAuthorities',
                        type: 'array',
                        required: false,
                        items: 'string',
                        description: 'Successor authorities this system is explicitly allocated to'
                    },
                    {
                        name: 'capabilityType',
                        type: 'array',
                        required: false,
                        items: 'string',
                        description: "Capabilities provided to other systems (e.g. ['payments', 'workflow'])"
                    },
                    {
                        name: 'supportModel',
                        type: 'string',
                        required: false,
                        description: 'Who maintains the system going forward',
                        enum: ['vendor-supported', 'community-supported', 'unsupported'],
                        enumDescriptions: {
                            'vendor-supported': 'Commercial vendor with SLA, support contract, and product roadmap.',
                            'community-supported': 'Maintained collaboratively (multi-council, open source, shared digital team).',
                            'unsupported': 'No active maintenance agreement. Developer left, product EOL, or no SLA.'
                        }
                    },
                    {
                        name: 'version',
                        type: 'string',
                        required: false,
                        description: 'System version or release identifier (e.g. "SAP S/4HANA 2023", "v4.2.1")'
                    },
                    {
                        name: 'notes',
                        type: 'string',
                        required: false,
                        description: 'Free-text notes for context not captured by other fields'
                    }
                ]
            }
        },

        edgeTypes: {
            REALIZES: {
                fields: [
                    {
                        name: 'source',
                        type: 'string',
                        required: true,
                        description: 'ITSystem node ID'
                    },
                    {
                        name: 'target',
                        type: 'string',
                        required: true,
                        description: 'Function node ID'
                    },
                    {
                        name: 'relationship',
                        type: 'string',
                        required: true,
                        description: 'Edge type discriminator',
                        const: 'REALIZES'
                    }
                ]
            },

            CONSUMES_CAPABILITY: {
                fields: [
                    {
                        name: 'source',
                        type: 'string',
                        required: true,
                        description: 'Consuming system node ID'
                    },
                    {
                        name: 'target',
                        type: 'string',
                        required: true,
                        description: 'Providing system node ID'
                    },
                    {
                        name: 'relationship',
                        type: 'string',
                        required: true,
                        description: 'Edge type discriminator',
                        const: 'CONSUMES_CAPABILITY'
                    },
                    {
                        name: 'capabilities',
                        type: 'array',
                        required: true,
                        items: 'string',
                        description: "Capabilities consumed (e.g. ['payments'])"
                    }
                ]
            }
        },

        example: {
            councilName: 'Example Borough Council',
            councilMetadata: { tier: 'borough', financialDistress: false },
            nodes: [
                { id: 'fn-1', label: 'Adult Social Care', type: 'Function', lgaFunctionId: '148' },
                { id: 'sys-1', label: 'Liquidlogic LAS', type: 'ITSystem', vendor: 'System C', users: 350, annualCost: 95000, portability: 'High', isCloud: true }
            ],
            edges: [
                { source: 'sys-1', target: 'fn-1', relationship: 'REALIZES' }
            ]
        }
    },

    // -------------------------------------------------------------------------
    // Transition configuration file — one per reorganisation
    // -------------------------------------------------------------------------
    transitionConfig: {
        title: 'Transition Configuration File',
        description: 'Defines successor authorities, predecessor assignments, and vesting date.',

        topLevel: [
            {
                name: 'vestingDate',
                type: 'string',
                required: true,
                format: 'date',
                description: "ISO date when successor authorities come into existence (e.g. '2027-04-01')"
            },
            {
                name: 'successors',
                type: 'array',
                required: true,
                description: 'Array of successor authority definitions'
            }
        ],

        successorFields: [
            {
                name: 'name',
                type: 'string',
                required: true,
                description: 'Name of the successor unitary authority'
            },
            {
                name: 'fullPredecessors',
                type: 'array',
                required: false,
                items: 'string',
                description: 'Councils whose entire estate transfers to this successor'
            },
            {
                name: 'partialPredecessors',
                type: 'array',
                required: false,
                items: 'string',
                description: 'Councils whose estate is split across multiple successors'
            }
        ],

        example: {
            vestingDate: '2027-04-01',
            successors: [
                {
                    name: 'North Essex Unitary',
                    fullPredecessors: ['Braintree District'],
                    partialPredecessors: ['Essex County']
                }
            ]
        }
    }
};
