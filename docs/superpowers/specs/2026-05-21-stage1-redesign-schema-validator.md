# Stage 1 Redesign: Landing Page, Schema Documentation & Validator

## Problem

Stage 1 currently has too many import paths with unclear relationships. The JSON schema — the primary machine-friendly format — has no in-app documentation, no downloadable schema definition, and no validation tooling. The transition configuration schema is also undocumented in-app. Councils producing JSON programmatically have no way to verify their output before importing.

## Solution

Redesign Stage 1 as three clear sections, plus a standalone schema documentation page. Both schemas (architecture + transition config) are covered. All documentation is generated from a single semantic source.

## Phases

| Phase | Deliverable | Depends on |
|---|---|---|
| 1 | Landing page layout + schema reference (from semantic source) + JSON Schema files | — |
| 2 | Validator (linter mode): two-column input/results view | Phase 1 |
| 3 | Interactive pre-import editor: load → fix → re-export | Phase 2 |

---

## Phase 1: Landing Page + Schema Documentation

### Stage 1 Layout (3 sections)

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Ingest Council Architectures                                │
│                                                                 │
│  ═══ UPLOAD ═══════════════════════════════════════════════════  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Upload architecture files                                │  │
│  │  Accepts: .json (LGR schema) · .xlsx (completed template) │  │
│  │                                                           │  │
│  │           [Select files]                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ── Staged Files (visible after upload) ───────────────────────  │
│  Council A (28 nodes) [Edit]                                    │
│  Council B (20 nodes) [Edit]                                    │
│  transition-config.json (2 successors)                          │
│  [Proceed to Baselining →]                                      │
│                                                                 │
│  ═══ SCHEMA REFERENCE ═════════════════════════════════════════  │
│                                                                 │
│  Two file types are accepted:                                   │
│                                                                 │
│  ┌─ Council Architecture ──────┐  ┌─ Transition Config ───────┐ │
│  │ councilName (required)      │  │ vestingDate (required)     │ │
│  │ councilMetadata { tier }    │  │ successors[] {             │ │
│  │ nodes[] { Function, IT... } │  │   name, fullPredecessors,  │ │
│  │ edges[] { REALIZES, ... }   │  │   partialPredecessors }    │ │
│  │                             │  │                            │ │
│  │ [Full reference ↗]          │  │ [Full reference ↗]         │ │
│  │ [Download .schema.json]     │  │ [Download .schema.json]    │ │
│  │ [Copy example]              │  │ [Copy example]             │ │
│  └─────────────────────────────┘  └────────────────────────────┘ │
│                                                                 │
│  ═══ DATA PREPARATION TOOLS ═══════════════════════════════════  │
│                                                                 │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐ │
│  │ Download Excel │  │ Validate a     │  │ Import from        │ │
│  │ Template       │  │ File           │  │ CSV / Spreadsheet  │ │
│  │                │  │                │  │                    │ │
│  │ Guided .xlsx   │  │ Check JSON     │  │ Map columns from   │ │
│  │ with dropdowns │  │ before import  │  │ existing data      │ │
│  └────────────────┘  └────────────────┘  └────────────────────┘ │
│                                                                 │
│  ┌────────────────┐  ┌────────────────┐                         │
│  │ Build from     │  │ Load Demo      │                         │
│  │ Scratch        │  │ Scenario       │                         │
│  └────────────────┘  └────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

**Key principles:**
- Three clearly separated sections: Upload (action), Schema Reference (always visible), Tools (things that help you produce valid files)
- Schema reference shows BOTH file types side by side — architecture and transition config
- Tools are presented as equal-weight cards, not a hierarchy
- Staged files appear inline below the upload area after files are selected
- Nothing is collapsed/hidden by default

### Semantic Schema Source

A single source of truth for schema definitions: `src/constants/schema-definitions.js`

Exports a structured object describing both schemas:

```js
export const SCHEMA_DEFINITIONS = {
    architecture: {
        description: 'Council architecture file — one per predecessor council',
        requiredFields: { ... },
        nodeTypes: {
            Function: { fields: [...], required: [...] },
            ITSystem: { fields: [...], required: [...], enums: { portability: [...], ... } }
        },
        edgeTypes: { ... },
        example: { ... }
    },
    transitionConfig: {
        description: 'Transition structure — defines successors and vesting date',
        requiredFields: { ... },
        example: { ... }
    }
};
```

Each field definition includes:
```js
{ name: 'portability', type: 'string', required: false,
  enum: ['High', 'Medium', 'Low'],
  description: 'How easy is it to extract data in bulk?',
  details: { High: '...', Medium: '...', Low: '...' } }
```

This single source generates:
1. The in-app schema reference (rendered into Stage 1)
2. The standalone schema page (`dist/schema.html`)
3. The JSON Schema files (`dist/lgr-architecture.schema.json`, `dist/lgr-transition-config.schema.json`)
4. The validator rules (Phase 2)
5. The template generator dropdown values (replaces hardcoded strings)

### Schema Reference (In-App)

Always-visible section in Stage 1 showing both schemas side by side:
- Compact card per schema (architecture, transition config)
- Each card shows: top-level structure, required fields, link to full reference
- "Download .schema.json" button per schema
- "Copy example" button per schema (copies a minimal valid example to clipboard)

Rendered by `src/features/schema-reference.js` from `SCHEMA_DEFINITIONS`.

### Schema Reference (Standalone Page)

`dist/schema.html` — full-page documentation, deployed alongside the app on GitHub Pages.

Contents:
- Navigation sidebar: Architecture Schema | Transition Config Schema | Downloads
- Full field reference table per schema (all fields, types, descriptions, valid values, examples)
- Interactive example with syntax highlighting
- Copy-to-clipboard on all code blocks
- Download links for both .schema.json files
- Link back to the main app

Built by the build process from `src/schema-page.html` template + `SCHEMA_DEFINITIONS`.

### JSON Schema Files

Two formal JSON Schema (Draft 2020-12) files generated from `SCHEMA_DEFINITIONS`:
- `dist/lgr-architecture.schema.json`
- `dist/lgr-transition-config.schema.json`

Generated by the build script (not hand-maintained). Usable with standard validators (ajv, VS Code JSON schema association, IDE autocomplete).

---

## Navigation Model

Stage 1 operates as a series of **full-page views** (not modals) with clear forward/back navigation:

```
Landing Page (upload + schema ref + tools)
    ├── → Validator view (full-page, two-column)
    │       └── → Editor view (full-page, tabbed)
    │               └── [Export JSON] or [Import to Engine] → back to Landing
    ├── → Schema Reference (full-page — OR standalone page link)
    ├── → Import Wizard (existing — already full-page-ish)
    └── → Manual Builder (existing)
```

Each sub-view has a `← Back` link at the top-left returning to the previous context. No modals for any tool that needs space. The landing page remains the anchor — tools navigate away from it and return to it.

---

## Phase 2: Validator (Linter Mode)

### Access

- "Validate a File" card in the Tools section of Stage 1
- Clicking opens a **full-page validator view** (replaces Stage 1 content, `← Back to upload` link at top)
- Also available on the standalone schema page

### Interface (Two-Column)

```
┌────────────────────────────────┬─────────────────────────────────┐
│  INPUT                         │  RESULTS                        │
│                                │                                 │
│  [Upload .json] [Paste JSON]   │  (empty until validated)        │
│                                │                                 │
│  ┌──────────────────────────┐  │  ✓ Valid JSON structure          │
│  │                          │  │  ✓ councilName: "Test Borough"  │
│  │  { paste/drop area }     │  │  ✓ 12 Function nodes            │
│  │                          │  │  ⚠ 3 warnings                   │
│  │                          │  │  ✗ 2 errors                     │
│  │                          │  │                                 │
│  └──────────────────────────┘  │  ── Errors ──────────────────── │
│                                │  • sys-4: missing "vendor"      │
│  File type: [Auto-detect ▾]   │  • edge 7: invalid target ref   │
│                                │                                 │
│  [Validate]                    │  ── Warnings ─────────────────── │
│                                │  • sys-2: "high" → "High"       │
│                                │  • sys-5: no lgaFunctionId      │
│                                │                                 │
│                                │  [Open in Editor] [Import ▸]    │
└────────────────────────────────┴─────────────────────────────────┘
```

**Auto-detection:** The validator detects whether the uploaded file is an architecture file (has `nodes`) or a transition config (has `successors`, no `nodes`) and validates accordingly.

### Validation Rules

Derived from `SCHEMA_DEFINITIONS`. Structured as:

**Errors (block import):**
- Invalid JSON syntax
- Missing required top-level fields (`nodes`, `councilName` for arch; `successors`, `vestingDate` for config)
- Node missing `id` or `type`
- ITSystem node missing `vendor` (only required field beyond id/type)
- Function node missing `lgaFunctionId`
- Edge referencing non-existent node IDs
- Duplicate node IDs
- Invalid `type` value (not "Function" or "ITSystem")
- Transition config: successor missing `name`

**Warnings (allow import with notice):**
- Invalid enum value with suggestion (e.g., "high" → "High")
- Missing optional but valuable fields (annualCost, endYear, portability)
- ITSystem with no REALIZES edge (orphaned system)
- CONSUMES_CAPABILITY edge with empty capabilities array
- Function with no systems attached
- Transition config: predecessor council name doesn't match any architecture file's councilName (if both uploaded)

**Info (non-blocking observations):**
- Node/edge count summary
- Field completeness percentages
- ESD function coverage (X of 176 mapped)

### Implementation

- `src/features/schema-validator.js`: exports `validateArchitecture(json)` and `validateTransitionConfig(json)` — pure functions returning `{ valid, errors, warnings, info }`
- Rules generated from `SCHEMA_DEFINITIONS` (required fields, enum values, types)
- Additional semantic checks coded separately (reference integrity, orphan detection)
- `src/features/validation-panel.js`: two-column UI panel

---

## Phase 3: Interactive Pre-Import Editor

### Access

- "Open in Editor" button on validator results (navigates from validator view to editor view)
- Pre-import only — does NOT replace the existing architecture editor modal

### Interface

**Full-page tabbed editor** (replaces the validator view, `← Back to validator` link at top):

**Tab 1: Council Info**
- Form: council name, tier (dropdown), financial distress (toggle)
- Validation indicator per field

**Tab 2: Functions**
- Table of Function nodes
- ESD function search/autocomplete for `lgaFunctionId`
- Add/remove rows
- Per-row validation (green/red indicator)

**Tab 3: Systems**
- Table of ITSystem nodes
- Inline dropdowns for validated fields (portability, partitioning, cloud, ERP, support model)
- Shows which function(s) each system REALIZES
- Per-field validation highlighting (red for invalid/missing required)
- Per-cell descriptions from `SCHEMA_DEFINITIONS` on hover/focus

**Tab 4: Dependencies**
- Table of CONSUMES_CAPABILITY edges
- System name dropdowns (populated from Systems tab)
- Capability type suggestions from LGAM vocabulary

**Footer:**
- [Re-validate] — re-run linter on current state
- [Export JSON] — download as valid JSON
- [Import to Engine] — import directly (bypasses upload, goes straight to staging)

### Design Decisions

- Pre-import tool only (not a replacement for the post-import architecture editor modal)
- Works with raw JSON — no app state dependency
- Validation indicators update live as user edits
- Field descriptions pulled from `SCHEMA_DEFINITIONS` (same source as docs)
- Could be hosted standalone on the schema page too (future enhancement)

---

## Semantic Source Structure

`src/constants/schema-definitions.js` defines:

```js
export const SCHEMA_DEFINITIONS = {
    architecture: {
        title: 'Council Architecture File',
        description: 'One file per predecessor council, describing their IT systems, the functions they serve, and the relationships between them.',
        topLevel: [
            { name: 'councilName', type: 'string', required: true, description: 'Official council name as it appears in LGR documentation' },
            { name: 'councilMetadata', type: 'object', required: false, description: 'Council classification', fields: [
                { name: 'tier', type: 'string', required: false, enum: ['county', 'district', 'borough', 'unitary'], description: 'Council tier classification' },
                { name: 'financialDistress', type: 'boolean', required: false, description: 'Whether the council is in financial distress (s114 notice or equivalent)' }
            ]},
            { name: 'nodes', type: 'array', required: true, description: 'Array of Function and ITSystem nodes' },
            { name: 'edges', type: 'array', required: true, description: 'Array of relationships between nodes' }
        ],
        nodeTypes: {
            Function: {
                description: 'A local government function from the ESD taxonomy',
                fields: [
                    { name: 'id', type: 'string', required: true, description: 'Unique node identifier' },
                    { name: 'label', type: 'string', required: true, description: 'Human-readable function name' },
                    { name: 'type', type: 'string', required: true, const: 'Function' },
                    { name: 'lgaFunctionId', type: 'string', required: true, description: 'ESD function taxonomy identifier (e.g., "148" for Adult Social Care)' }
                ]
            },
            ITSystem: {
                description: 'An IT system operated by the council',
                fields: [
                    { name: 'id', type: 'string', required: true, description: 'Unique node identifier' },
                    { name: 'label', type: 'string', required: true, description: 'System name as the council knows it' },
                    { name: 'type', type: 'string', required: true, const: 'ITSystem' },
                    { name: 'vendor', type: 'string', required: true, description: 'Software vendor, or "In-House" if internally developed' },
                    { name: 'users', type: 'number', required: false, description: 'Approximate number of staff users' },
                    { name: 'annualCost', type: 'number', required: false, description: 'Annual licence/hosting/support cost in pounds' },
                    { name: 'cost', type: 'string', required: false, description: 'Human-readable cost string (e.g., "£950k/yr")' },
                    { name: 'endYear', type: 'number', required: false, description: 'Contract expiry year' },
                    { name: 'endMonth', type: 'number', required: false, min: 1, max: 12, description: 'Contract expiry month (1-12)' },
                    { name: 'noticePeriod', type: 'number', required: false, description: 'Months of notice required to exit contract' },
                    { name: 'portability', type: 'string', required: false, enum: ['High', 'Medium', 'Low'], description: 'Ease of bulk data extraction', enumDescriptions: {
                        High: 'Open APIs, standard formats, vendor provides export tools. Migration possible without vendor assistance.',
                        Medium: 'Some export capability but may require vendor support or have proprietary elements.',
                        Low: 'Proprietary format, no bulk export API, significant vendor lock-in.'
                    }},
                    { name: 'dataPartitioning', type: 'string', required: false, enum: ['Segmented', 'Monolithic'], description: 'How data is organised within the system', enumDescriptions: {
                        Segmented: 'Data logically separated by service area. Can be split without major restructuring.',
                        Monolithic: 'Data entangled across all areas. Splitting requires ETL planning.'
                    }},
                    { name: 'isCloud', type: 'boolean', required: false, description: 'Whether the system is cloud-hosted (true) or on-premise (false)' },
                    { name: 'isERP', type: 'boolean', required: false, description: 'Whether this is an Enterprise Resource Planning system spanning multiple functions' },
                    { name: 'sharedWith', type: 'array', items: 'string', required: false, description: 'Names of other councils sharing this system instance' },
                    { name: 'supportModel', type: 'string', required: false, enum: ['vendor-supported', 'community-supported', 'unsupported'], description: 'Who maintains the system going forward', enumDescriptions: {
                        'vendor-supported': 'Commercial vendor with SLA, support contract, and product roadmap.',
                        'community-supported': 'Maintained collaboratively (multi-council, open source, shared digital team).',
                        'unsupported': 'No active maintenance agreement. Developer left, product EOL, or no SLA.'
                    }},
                    { name: 'capabilityType', type: 'array', items: 'string', required: false, description: 'Capabilities this system provides to other systems (e.g., ["payments", "workflow"])' },
                    { name: 'targetAuthorities', type: 'array', items: 'string', required: false, description: 'Successor authorities this system is explicitly allocated to' }
                ]
            }
        },
        edgeTypes: {
            REALIZES: {
                description: 'System delivers/serves a function',
                fields: [
                    { name: 'source', type: 'string', required: true, description: 'ITSystem node ID' },
                    { name: 'target', type: 'string', required: true, description: 'Function node ID' },
                    { name: 'relationship', type: 'string', required: true, const: 'REALIZES' }
                ]
            },
            CONSUMES_CAPABILITY: {
                description: 'System depends on another system for a specific capability',
                fields: [
                    { name: 'source', type: 'string', required: true, description: 'Consuming system node ID' },
                    { name: 'target', type: 'string', required: true, description: 'Providing system node ID' },
                    { name: 'relationship', type: 'string', required: true, const: 'CONSUMES_CAPABILITY' },
                    { name: 'capabilities', type: 'array', items: 'string', required: true, description: 'What capabilities are consumed (e.g., ["payments"])' }
                ]
            }
        }
    },
    transitionConfig: {
        title: 'Transition Configuration File',
        description: 'Defines the successor authorities, which predecessor councils feed into each, and the vesting date.',
        topLevel: [
            { name: 'vestingDate', type: 'string', required: true, format: 'date', description: 'ISO date when successor authorities come into existence (e.g., "2027-04-01")' },
            { name: 'successors', type: 'array', required: true, description: 'Array of successor authority definitions' }
        ],
        successorFields: [
            { name: 'name', type: 'string', required: true, description: 'Name of the successor unitary authority' },
            { name: 'fullPredecessors', type: 'array', items: 'string', required: false, description: 'Council names whose entire estate transfers to this successor' },
            { name: 'partialPredecessors', type: 'array', items: 'string', required: false, description: 'Council names whose estate is split across multiple successors (e.g., county councils)' }
        ]
    }
};
```

---

## File Structure

| File | Phase | Purpose |
|---|---|---|
| `src/constants/schema-definitions.js` | 1 | Single semantic source for both schemas |
| `src/features/schema-reference.js` | 1 | Renders in-app schema reference from definitions |
| `src/schema-page.html` | 1 | Template for standalone schema page |
| `build.js` changes | 1 | Generate schema.html + .schema.json files |
| `dist/schema.html` | 1 | Built standalone page |
| `dist/lgr-architecture.schema.json` | 1 | Generated JSON Schema |
| `dist/lgr-transition-config.schema.json` | 1 | Generated JSON Schema |
| `src/features/schema-validator.js` | 2 | Validation logic (pure functions) |
| `src/features/validation-panel.js` | 2 | Two-column validator UI |
| `src/features/pre-import-editor.js` | 3 | Interactive editor component |

---

## Build Changes

`build.js` additions:
1. Import `SCHEMA_DEFINITIONS` and generate `dist/lgr-architecture.schema.json` + `dist/lgr-transition-config.schema.json` (convert from our format to JSON Schema Draft 2020-12)
2. Build `dist/schema.html` from `src/schema-page.html` (same inject pattern as main app)
3. Existing `dist/lgr-rationalisation-engine.html` build unchanged

---

## Constraints

- All client-side (no server)
- JSON Schema files must be valid Draft 2020-12
- Standalone schema page is self-contained HTML (same build pattern as main app)
- Validator handles files with 500+ nodes without lag
- Pre-import editor (Phase 3) is transient — no persistence beyond the session
- Single semantic source: changing a field definition in `schema-definitions.js` updates all downstream artifacts automatically
