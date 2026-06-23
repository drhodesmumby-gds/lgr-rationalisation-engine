---
title: Data Format Reference
order: 6
section: user-guide
---

# Data Format Reference

This page documents the full data schema for council architecture files and transition configuration files used by the LGR Rationalisation Engine.

## Council architecture file

Each council provides one JSON file describing their IT estate. The file contains four top-level fields:

```json
{
  "councilName": "Example Borough Council",
  "councilMetadata": {
    "tier": "borough",
    "financialDistress": false
  },
  "nodes": [ ],
  "edges": [ ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `councilName` | string | Yes | Official council name as it should appear in the tool |
| `councilMetadata` | object | No | Council classification metadata |
| `councilMetadata.tier` | string | No | One of: `county`, `district`, `borough`, `unitary` |
| `councilMetadata.financialDistress` | boolean | No | Set to `true` if the council is under s114 notice or equivalent financial intervention |
| `nodes` | array | Yes | All Function and ITSystem nodes |
| `edges` | array | Yes | All relationships between nodes |

> **Note:** The `councilMetadata.tier` field is used for cross-tier collision detection. When a county system and a district system both serve the same function, the engine flags this as a potential complementary delivery pattern rather than simple duplication.

## Function nodes

Function nodes represent the service functions a council delivers. They are the anchor points for cross-council reconciliation.

```json
{
  "id": "fn-asc",
  "label": "Adult Social Care",
  "type": "Function",
  "lgaFunctionId": "148"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier within this file (any format) |
| `label` | string | Yes | Human-readable function name as the council knows it |
| `type` | string | Yes | Must be `"Function"` |
| `lgaFunctionId` | string | Yes | ESD Standard Function Taxonomy identifier |

### About ESD Function IDs

The `lgaFunctionId` is the critical field that enables cross-council comparison. It references the LGA/ESD Standard Function Taxonomy - a nationally agreed list of 176 local government service functions.

Two councils calling the same service different names (e.g., "Refuse Operations" and "Waste Collection") will appear in the same analysis row if they share the same ESD identifier.

> **Note:** Functions without a valid `lgaFunctionId` are excluded from the analysis matrix and flagged during baselining. The Architecture Editor provides search and auto-suggest to help find the correct identifier.

Common ESD function IDs:

| ID | Function |
|----|----------|
| 148 | Adult Social Care |
| 24 | Children's Social Care |
| 63 | Council Tax |
| 116 | Housing Benefits |
| 66 | Planning Applications |
| 132 | Highways Maintenance |
| 53 | Waste Collection |

## ITSystem nodes

IT system nodes describe each system in the council's estate.

```json
{
  "id": "sys-liq",
  "label": "Liquidlogic LAS",
  "type": "ITSystem",
  "vendor": "System C",
  "users": 350,
  "annualCost": 95000,
  "endYear": 2028,
  "endMonth": 3,
  "noticePeriod": 12,
  "portability": "High",
  "dataPartitioning": "Segmented",
  "hosting": "cloud",
  "isERP": false,
  "isIndependent": false,
  "sharedWith": ["Other Borough Council"],
  "targetAuthorities": ["North Unitary"],
  "capabilityType": ["workflow"],
  "supportModel": "vendor-supported",
  "version": "v14.2",
  "notes": "Migrated to cloud in 2024"
}
```

### All ITSystem fields

| Field | Type | Required | Description | Guidance |
|-------|------|----------|-------------|----------|
| `id` | string | Yes | Unique identifier within this file | Use a consistent prefix (e.g., `sys-`) |
| `label` | string | Yes | System name as the council knows it | Use the common name, not the product code |
| `type` | string | Yes | Must be `"ITSystem"` | - |
| `vendor` | string | Yes | Software vendor name, or `"In-House"` for internally developed systems | Use consistent spelling across councils |
| `users` | number | No | Approximate staff user count | Agree on counting method (concurrent, named, or total) across all councils |
| `annualCost` | number | No | Annual cost in pounds (numeric) | Used for estate spend calculations and cost delta in simulation |
| `endYear` | number | No | Contract expiry year (e.g., 2028) | Needed for contract urgency signal |
| `endMonth` | number | No | Contract expiry month (1-12) | Needed for contract urgency signal |
| `noticePeriod` | number | No | Months of notice required to exit | The engine subtracts this from the end date to find the notice trigger |
| `portability` | string | No | Data extraction ease: `"High"`, `"Medium"`, or `"Low"` | See portability ratings below |
| `dataPartitioning` | string | No | Data organisation: `"Segmented"` or `"Monolithic"` | See data partitioning guidance below |
| `hosting` | string | No | Hosting model: `"cloud"`, `"on-premise"`, or `"partner-hosted"` | See hosting guidance below |
| `hostingPartner` | string | No | Name of the hosting partner (when hosting is `"partner-hosted"`) | Specify which council or body hosts the system |
| `isERP` | boolean | No | Whether this is an Enterprise Resource Planning system | ERPs get distinct risk treatment (monolithic data, multi-function span) |
| `isIndependent` | boolean | No | True for capability systems (e.g., GOV.UK Notify) | Systems that do not realise LGA functions directly but provide capabilities to other systems |
| `sharedWith` | string[] | No | Names of other councils sharing this system instance | Use exact council names as they appear in their own files |
| `targetAuthorities` | string[] | No | Explicit successor authority allocation | Overrides the default allocation logic |
| `capabilityType` | string[] | No | Capabilities this system provides | e.g., `["payments", "forms", "sms"]` |
| `supportModel` | string | No | Maintenance arrangement: `"vendor-supported"`, `"community-supported"`, or `"unsupported"` | See support model guidance below |
| `version` | string | No | System version or release identifier | Helps identify upgrade opportunities |
| `notes` | string | No | Free-text notes | For context not captured by other fields |

### Portability ratings

| Rating | Meaning | Examples |
|--------|---------|----------|
| **High** | Open APIs, standard formats (CSV/XML/JSON), vendor provides export tools. Migration possible without vendor assistance. | Modern SaaS with REST API, open-source systems |
| **Medium** | Some export capability exists but may require vendor support or have proprietary elements. | Systems with batch export but proprietary internal format |
| **Low** | Proprietary format, no bulk export API. Significant vendor lock-in. Migration requires vendor cooperation. | Legacy systems with no documented API, vendor-locked databases |

### Data partitioning guidance

| Value | Meaning | Impact on analysis |
|-------|---------|-------------------|
| **Segmented** | Data is logically separated by service area, ward, or department. Can be split across successors without major restructuring. | Lower disaggregation complexity |
| **Monolithic** | Data is entangled across all areas. Splitting requires ETL (Extract, Transform, Load) work. | Triggers monolithic data signal; higher disaggregation severity |

### Hosting field

| Value | Meaning | Considerations |
|-------|---------|----------------|
| **cloud** | Vendor-hosted SaaS or cloud platform. Council has no infrastructure responsibility. | Simplest transition - no physical infrastructure to transfer |
| **on-premise** | Hosted on council-owned infrastructure (data centre, servers). | Infrastructure must transfer to successor or system must be migrated to cloud |
| **partner-hosted** | Hosted by another council or shared service body. | Hosting arrangement may need renegotiation if partner is assigned to a different successor |


### Support model guidance

| Value | Meaning | Risk level |
|-------|---------|-----------|
| **vendor-supported** | Commercial vendor with SLA, support contract, and product roadmap. | Lowest risk - vendor responsible for maintenance |
| **community-supported** | Maintained collaboratively (multi-council consortium, open source, shared digital team). | Medium risk - sustainability depends on community health |
| **unsupported** | No active maintenance agreement. Developer left, product EOL, or no SLA. | Highest risk - no safety net if system fails during transition |

## Edge types

Edges define relationships between nodes. Two types are supported.

### REALIZES

Maps an IT system to the business function it delivers.

```json
{
  "source": "sys-liq",
  "target": "fn-asc",
  "relationship": "REALIZES"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source` | string | Yes | The ITSystem node ID |
| `target` | string | Yes | The Function node ID |
| `relationship` | string | Yes | Must be `"REALIZES"` |

One system can REALIZE multiple functions (e.g., an ERP covering both Finance and HR). One function can be REALIZED by multiple systems within the same council (though this is uncommon).

### CONSUMES_CAPABILITY

Indicates that one system depends on capabilities provided by another.

```json
{
  "source": "sys-housing",
  "target": "sys-erp",
  "relationship": "CONSUMES_CAPABILITY",
  "capabilities": ["payments"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source` | string | Yes | The consuming system node ID |
| `target` | string | Yes | The providing system node ID |
| `relationship` | string | Yes | Must be `"CONSUMES_CAPABILITY"` |
| `capabilities` | string[] | Yes | Which capabilities are consumed (e.g., `["payments", "forms"]`) |

Common capability types: `payments`, `forms`, `sms`, `email`, `workflow`, `identity`, `reporting`, `gis`.

> **Note:** CONSUMES_CAPABILITY edges create "blast radius" dependencies. When simulation models the decommissioning of a capability provider, all consuming systems are flagged with capability gap obligations.

## Transition configuration file

A separate JSON file defines the reorganisation structure.

```json
{
  "vestingDate": "2027-04-01",
  "successors": [
    {
      "name": "North Essex Unitary",
      "fullPredecessors": ["Braintree District Council", "Colchester Borough Council"],
      "partialPredecessors": ["Essex County Council"]
    },
    {
      "name": "South Essex Unitary",
      "fullPredecessors": ["Basildon District Council", "Castle Point Borough Council"],
      "partialPredecessors": ["Essex County Council"]
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `vestingDate` | string | Yes | ISO date when successor authorities come into existence (e.g., `"2027-04-01"`) |
| `successors` | array | Yes | Array of successor authority definitions |

### Successor fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Name of the successor unitary authority |
| `fullPredecessors` | string[] | No | Councils whose entire estate transfers to this successor |
| `partialPredecessors` | string[] | No | Councils whose estate is split across multiple successors |

> **Note:** Council names in `fullPredecessors` and `partialPredecessors` must match the `councilName` field in the corresponding architecture files exactly (including capitalisation and spacing).

### Auto-detection

If a transition configuration file is uploaded alongside architecture files at Stage 1, the engine automatically detects it. Detection logic: a file with a `successors` array and no `nodes` array is classified as a transition configuration.

## Complete example: architecture file

```json
{
  "councilName": "Northshire County Council",
  "councilMetadata": {
    "tier": "county",
    "financialDistress": false
  },
  "nodes": [
    {
      "id": "fn-asc",
      "label": "Adult Social Care",
      "type": "Function",
      "lgaFunctionId": "148"
    },
    {
      "id": "fn-finance",
      "label": "Financial Management",
      "type": "Function",
      "lgaFunctionId": "210"
    },
    {
      "id": "sys-liq",
      "label": "Liquidlogic LAS",
      "type": "ITSystem",
      "vendor": "System C",
      "users": 3500,
      "annualCost": 950000,
      "endYear": 2028,
      "endMonth": 3,
      "noticePeriod": 12,
      "portability": "High",
      "dataPartitioning": "Segmented",
      "hosting": "cloud",
      "isERP": false,
      "supportModel": "vendor-supported"
    },
    {
      "id": "sys-oracle",
      "label": "Oracle ERP",
      "type": "ITSystem",
      "vendor": "Oracle",
      "users": 8000,
      "annualCost": 2400000,
      "endYear": 2029,
      "endMonth": 9,
      "noticePeriod": 18,
      "portability": "Low",
      "dataPartitioning": "Monolithic",
      "hosting": "on-premise",
      "isERP": true,
      "capabilityType": ["payments", "reporting"],
      "supportModel": "vendor-supported"
    }
  ],
  "edges": [
    { "source": "sys-liq", "target": "fn-asc", "relationship": "REALIZES" },
    { "source": "sys-oracle", "target": "fn-finance", "relationship": "REALIZES" },
    {
      "source": "sys-liq",
      "target": "sys-oracle",
      "relationship": "CONSUMES_CAPABILITY",
      "capabilities": ["payments"]
    }
  ]
}
```

## Complete example: transition configuration

```json
{
  "vestingDate": "2027-04-01",
  "successors": [
    {
      "name": "North Unitary",
      "fullPredecessors": ["Northshire County Council"],
      "partialPredecessors": []
    },
    {
      "name": "South Unitary",
      "fullPredecessors": ["Southton District Council"],
      "partialPredecessors": ["Midshire County Council"]
    },
    {
      "name": "East Unitary",
      "fullPredecessors": ["Eastbury Borough Council"],
      "partialPredecessors": ["Midshire County Council"]
    }
  ]
}
```

## Common validation errors and fixes

| Error | Cause | Fix |
|-------|-------|-----|
| "Function excluded from analysis" | Function node missing `lgaFunctionId` | Add a valid ESD function ID using the Architecture Editor |
| "Edge references non-existent node" | A REALIZES or CONSUMES_CAPABILITY edge has a `source` or `target` that does not match any node `id` | Check for typos in node IDs; ensure the referenced system/function exists |
| "Council name mismatch in transition config" | A name in `fullPredecessors` or `partialPredecessors` does not match any uploaded council's `councilName` | Ensure exact spelling match including spacing and capitalisation |
| "No REALIZES edges for system" | An ITSystem node exists but has no REALIZES edge connecting it to a function | Add a REALIZES edge mapping the system to its function |
| "Duplicate node IDs" | Two nodes in the same file share the same `id` value | Use unique identifiers for every node |
| "Invalid portability value" | Portability field contains something other than High, Medium, or Low | Use exact capitalisation: `"High"`, `"Medium"`, or `"Low"` |
| "Invalid endMonth" | `endMonth` is outside the 1-12 range | Use a number between 1 (January) and 12 (December) |
| "Partial predecessor not in multiple successors" | A council listed as `partialPredecessors` appears in only one successor | Partial predecessors must appear in at least two successors (otherwise use `fullPredecessors`) |

## Tips for preparing data

- **Start simple** - a file with just system names, vendors, and REALIZES edges is enough to begin. Add detail iteratively.
- **Get ESD IDs right first** - this is the most impactful field. Without it, cross-council reconciliation does not work.
- **Use the Excel template** - download it from Stage 1 for a structured workbook with domain sheets, ESD references, and dropdown validation.
- **Be consistent with vendor names** - "System C", "SystemC", and "System C Ltd" are treated as three different vendors.
- **Include contract dates** - without `endYear`, `endMonth`, and `noticePeriod`, the contract urgency signal cannot fire.
- **Mark shared services** - the `sharedWith` field enables critical shared service boundary analysis.
