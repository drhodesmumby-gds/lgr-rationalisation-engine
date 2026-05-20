# Data Preparation Template — Design Spec

## Problem

Councils need to prepare architecture data for the LGR Rationalisation Engine. Currently they must produce JSON files with a specific schema including ESD function IDs, portability ratings, capability edges, and support model classifications. This is a significant lift for IT teams who have their systems recorded in spreadsheets, CMDBs, or informally.

## Solution

An in-app downloadable Excel (.xlsx) template that councils fill in offline, then upload. The template is structured as a domain-by-domain walkthrough with pre-populated ESD functions, dropdown validation, inline guidance, and example rows. Upload auto-converts to the JSON schema.

## Workbook Structure

| # | Sheet | Purpose | Visible |
|---|---|---|---|
| 1 | Index | Overview, hyperlinks, instructions | Yes |
| 2 | Council Info | Council name, tier, financial distress | Yes |
| 3–11 | Domain sheets (×9) | Systems per ESD function domain | Yes |
| 12 | Dependencies | System-to-system capability dependencies | Yes |
| 13 | _Lookups | Dropdown validation source | Hidden |
| 14 | _SystemNames | Aggregated system names from all domains | Hidden |

## Sheet Specifications

### 1. Index Sheet

- Title row: "LGR Architecture Data Template" (bold, large)
- Instructions block (5–6 bullets):
  - "Fill in the Council Info sheet first"
  - "Work through each domain sheet — delete the example row, fill in your systems"
  - "If you don't deliver a function, leave the row empty"
  - "Multiple systems for the same function = add extra rows with the same function"
  - "Fill in the Dependencies sheet for systems that rely on other systems"
  - "Upload the completed .xlsx to the LGR Rationalisation Engine"
- Hyperlinked table: Sheet name | Description | one row per sheet
- Version field: "Template v1.0 — generated [date]"

### 2. Council Info Sheet

- Row 1: Guidance text (merged A1:D1, grey background): "Enter your council's details below. This identifies your architecture in the merged estate."
- Row 3: Column headers
- Row 4: Example row (italic, grey fill, column A = "EXAMPLE — delete this row")
- Row 5: Empty row for user input

| Column | Header | Validation |
|---|---|---|
| A | Council Name | Free text, required |
| B | Council Tier | Dropdown: County / District / Borough / Unitary |
| C | Financial Distress | Dropdown: Yes / No |

### 3–11. Domain Sheets

One sheet per ESD root category (only categories containing functions):
- "Health & Social Care"
- "Administration & Government"
- "Environmental Protection"
- "Planning & Building Control"
- "Housing"
- "Transport & Highways"
- "Advice & Benefits"
- "Leisure & Culture"
- "Business & Employment"

**Layout:**

- Row 1: Domain description + guidance (merged, grey background): "List the IT systems your council uses for each function below. Leave functions empty if you don't deliver them. Add extra rows if multiple systems serve the same function."
- Row 2: Column headers with Excel cell comments explaining each field
- Row 3: Example row (greyed italic, cell A3 = "EXAMPLE — delete this row")
- Row 4+: Pre-populated ESD function rows. Functions sorted by ID within the domain.
- **Data area formatted as an Excel Table** (ListObject) with a named identifier per domain (e.g., `HealthSocialCare`, `AdminGov`, `EnvironmentalProtection`, `PlanningBuildingControl`, `Housing`, `TransportHighways`, `AdviceBenefits`, `LeisureCulture`, `BusinessEmployment`). Tables auto-expand when councils add rows, ensuring formulas and validation references stay current.

**Columns:**

| Col | Header | Required | Validation | Comment (hover text) |
|---|---|---|---|---|
| A | ESD ID | Auto (locked) | — | "ESD taxonomy function identifier — do not edit" |
| B | Function | Auto (locked) | — | "Standard function name from the ESD taxonomy" |
| C | System Name | Yes | Free text | "The name of the IT system as your council knows it" |
| D | Vendor | Yes | Free text | "Software vendor, or 'In-House' if developed internally" |
| E | Users | No | Number ≥ 0 | "Approximate number of staff who use this system" |
| F | Annual Cost (£) | No | Number ≥ 0 | "Annual licence/hosting/support cost in pounds" |
| G | Contract End | No | Date (format: mm/yyyy) | "When does the current contract expire?" |
| H | Notice Period (months) | No | Number 0–36 | "How many months notice required to exit the contract?" |
| I | Portability | No | Dropdown: High / Medium / Low | "How easy is it to extract your data from this system? High = open APIs/standard formats. Low = proprietary/locked in." |
| J | Data Partitioning | No | Dropdown: Segmented / Monolithic | "Is this system's data cleanly separated per service area (Segmented) or entangled across everything (Monolithic)?" |
| K | Cloud Hosted? | No | Dropdown: Yes / No | "Is this system hosted in the cloud/SaaS, or on your own servers?" |
| L | ERP? | No | Dropdown: Yes / No | "Is this an Enterprise Resource Planning system (e.g., SAP, Oracle, Unit4) that spans multiple functions?" |
| M | Shared With | No | Free text (comma-separated) | "Other councils that share this system instance with you (leave blank if not shared)" |
| N | Support Model | No | Dropdown: Vendor-supported / Community-supported / Unsupported | "Who maintains this system? Vendor = commercial SLA. Community = multi-council/OSS collaboration. Unsupported = no active maintenance." |
| O | Capabilities Provided | No | Free text (comma-separated) | "What capabilities does this system provide to OTHER systems? e.g., payments, SSO, forms, SMS. Leave blank if none." |

**Example row content (for Health & Social Care sheet):**

| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 148 | Adult Social Care | Liquidlogic LAS | System C | 3500 | 950000 | 03/2028 | 12 | High | Segmented | Yes | No | | Vendor-supported | |

### 12. Dependencies Sheet

- Row 1: Guidance text (merged, grey background): "List systems that depend on other systems for a specific capability. Ask yourself: if System B was removed or replaced, would System A stop working properly?"
- Row 2: Column headers
- Row 3: Example row (greyed italic)
- Row 4+: User input

| Col | Header | Validation | Comment |
|---|---|---|---|
| A | System that depends | Free text | "The system that would break — use the exact name from your domain sheets" |
| B | System it depends on | Free text | "The system that provides the capability — use the exact name from your domain sheets" |
| C | What for? | Free text | "What capability is consumed? e.g., payments, workflow, SSO, integration, SMS" |
| D | Match ✓ | Formula (locked) | Auto-validates: shows ✓ if both system names exist on domain sheets, ⚠ if not |

**Column D formula (structured table reference):**
```
=IF(AND([@[System that depends]]<>"", [@[System it depends on]]<>""),
  IF(AND(COUNTIF(_SystemNames!A:A, [@[System that depends]])>0,
         COUNTIF(_SystemNames!A:A, [@[System it depends on]])>0),
    "✓", "⚠ Not found"), "")
```

The Dependencies sheet is also formatted as an Excel Table (`Dependencies`), so the formula auto-fills for new rows.

**Conditional formatting:** Column D cells with "⚠" get red background + bold.

**Example row:**

| A | B | C | D |
|---|---|---|---|
| Liquidlogic LAS | SAP S/4HANA ERP | Payments | ✓ |

### 13. _Lookups Sheet (hidden)

Named ranges for data validation:

| Range Name | Values |
|---|---|
| Tier | County, District, Borough, Unitary |
| YesNo | Yes, No |
| Portability | High, Medium, Low |
| DataPartitioning | Segmented, Monolithic |
| SupportModel | Vendor-supported, Community-supported, Unsupported |
| Capabilities | payments, forms, SSO, SMS, integration, workflow, document-management, case-management, reporting, GIS |

### 14. _SystemNames Sheet (hidden)

Aggregates system names from all 9 domain sheets using structured table references. Because domain sheets use Excel Tables, this list grows automatically as councils add rows.

**Structure:**
- Column A: Collated system names from all domain table columns
- Uses `FILTER` + `VSTACK` (Excel 365+): `=FILTER(VSTACK(HealthSocialCare[System Name], AdminGov[System Name], ...), VSTACK(HealthSocialCare[System Name], AdminGov[System Name], ...)<>"")`
- Fallback for older Excel: individual cell references with `=IFERROR(INDEX(HealthSocialCare[System Name], ROW()-offset), "")` pattern, pre-allocated with generous capacity (50 per domain = 450 slots)
- The template generator uses the VSTACK approach (modern). Councils on older Excel versions will see a static helper that still covers the common case.
- Blank cells are ignored by COUNTIF in the Dependencies validation

## In-App Integration

### Template Generation (Stage 1)

**Trigger:** "Download Template" button on Stage 1, positioned alongside the upload area.

**Implementation:**
- SheetJS (xlsx) loaded from CDN: `https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js`
- Generates the full workbook programmatically:
  - Creates all sheets with headers, validation, formulas
  - Pre-populates ESD functions from `LGA_FUNCTIONS` constant (src/constants/lga-functions.js)
  - Groups functions by root category (using `getRootCategoryId()` from taxonomy.js)
  - Applies cell protection on columns A–B of domain sheets
  - Configures data validation dropdowns from _Lookups ranges
  - Sets column widths, row heights, conditional formatting
  - Adds cell comments on header row
- Downloads as `lgr-architecture-template-[councilCount].xlsx`

**New module:** `src/features/template-generator.js`
- Exports `generateTemplate()` — returns a SheetJS workbook object
- Exports `downloadTemplate()` — generates and triggers browser download
- Imports `LGA_FUNCTIONS` and `getRootCategories()` / `getRootCategoryId()` for ESD function grouping
- Imports `LGAM_CAPABILITIES` for the capabilities suggestion list

### .xlsx Upload Handling (Stage 1)

**Trigger:** User uploads .xlsx file via existing file input.

**Detection:** Check file extension or MIME type. If .xlsx, route to converter instead of JSON parser.

**Implementation:**
- Parse with SheetJS `XLSX.read()`
- Extract Council Info → `councilName`, `councilMetadata`
- For each domain sheet:
  - Skip empty rows (no system name in column C)
  - Build Function nodes from column A (ESD ID) — one per unique function that has systems
  - Build ITSystem nodes from columns C–O
  - Build REALIZES edges (system → function)
  - Generate unique IDs: `fn-[lgaId]` for functions, `sys-[index]` for systems
- Parse Dependencies sheet:
  - Match system names (case-insensitive trim) to generated system IDs
  - Build CONSUMES_CAPABILITY edges
  - Collect warnings for unmatched names
- Parse Contract End column:
  - Accept formats: mm/yyyy, yyyy-mm, mm/yy, Excel date serial numbers
  - Extract endYear and endMonth
- Output: standard council architecture JSON
- Show validation summary: systems imported, functions mapped, dependencies created, warnings

**Validation warnings (non-blocking):**
- "System X in Dependencies not found in domain sheets" (unmatched name)
- "Row Y in [Domain] missing System Name — skipped"
- "Row Y in [Domain] has unrecognised Portability value 'Z' — defaulting to null"

**New module:** `src/features/template-converter.js`
- Exports `convertXlsxToArchitecture(workbook)` — returns `{ architecture, warnings }`
- Pure function (testable) — accepts a SheetJS workbook object, returns JSON + warnings array

### SheetJS Loading

- Load via `<script>` tag from CDN (same pattern as Tailwind CSS)
- Add to `src/index.html` in the `<head>`: `<script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>`
- Global `XLSX` object available at runtime
- Fallback: if `window.XLSX` is undefined when "Download Template" is clicked, show error message suggesting JSON upload

## Constraints

- Template must work in Microsoft Excel (365 and 2019+), LibreOffice Calc, and Google Sheets (import)
- No macros (VBA) — purely formula-based validation using Excel Tables (ListObjects)
- Excel Tables auto-expand, removing fixed row limits. The VSTACK formula in _SystemNames requires Excel 365+; a pre-allocated fallback (50 rows per domain) handles older versions gracefully. The converter handles all rows regardless.
- Contract End column parsing must handle multiple date formats gracefully
- Generated template size should be under 200KB
- SheetJS must support Table/ListObject creation — verify with `XLSX.utils.table_to_sheet` or equivalent API

## Testing

- Property tests for `convertXlsxToArchitecture()`:
  - Correct node/edge generation from mock workbook data
  - Handles empty rows gracefully
  - Parses various date formats for Contract End
  - Warns on unmatched dependency names
  - Handles missing optional fields without error
- Browser verification:
  - Download template → open in Excel → verify structure, dropdowns, examples
  - Fill in data → upload → verify correct ingestion
  - Dependencies validation indicator works (✓ / ⚠)
