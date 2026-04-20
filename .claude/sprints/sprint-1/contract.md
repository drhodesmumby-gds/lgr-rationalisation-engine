# Sprint 1: Close Spec Gaps and Enable End-to-End Testing

## Scope

This sprint closes the remaining gaps identified in the gap analysis:
1. Implement the missing shared service indicator on system cards (Requirement 6.2)
2. Update all 5 sample JSON files and the inline demo loader with new optional fields (`sharedWith`, `annualCost`, `councilMetadata`) so all new features are exercisable end-to-end
3. Fix the CLAUDE.md JSON schema documentation (properties nesting mismatch)

After this sprint, 11/11 requirements will be fully implemented and verifiable with sample data.

## Acceptance Criteria

### AC-1: Shared service indicator on system cards (Requirement 6.2)

- [ ] When an ITSystem node has a `sharedWith` array with 1+ entries, `buildSystemCard()` renders a visible indicator on that system's card showing which councils share the system.
- [ ] The indicator appears on the card itself (not just in the analysis column), positioned after the council tier badge and before the disaggregation flag.
- [ ] The indicator text follows the pattern: "Shared with [council names]" (e.g., "Shared with Southby Borough").
- [ ] The indicator uses a distinct visual treatment: a small tag or badge styled consistently with GDS design conventions (e.g., a `gds-tag` with `tag-blue` background, or an info-styled banner).
- [ ] The indicator renders in both Estate Discovery mode and Transition Planning mode.
- [ ] When `sharedWith` is absent, empty, or not an array, no indicator is rendered.
- [ ] The existing shared service signal in the analysis column (lines 1984-2029) continues to work unchanged.

### AC-2: Sample JSON files updated with new optional fields

- [ ] `northshire-county.json` includes `councilMetadata` with `"tier": "county"` (Northshire is a county council).
- [ ] `easton-district.json` includes `councilMetadata` with `"tier": "district"`.
- [ ] `southby-borough.json` includes `councilMetadata` with `"tier": "district"`.
- [ ] `westampton-district.json` includes `councilMetadata` with `"tier": "district"`.
- [ ] At least one council JSON file includes `"financialDistress": true` in its `councilMetadata`. Recommended: Easton District (its `_note` on `sys_e_erp` suggests a struggling council with an aging ERP).
- [ ] The `sys_shared_revs` system in `easton-district.json` includes `"sharedWith": ["Southby Borough"]` (this system's `_note` already says "Shared service with Southby").
- [ ] The `sys_shared_revs` system in `southby-borough.json` includes `"sharedWith": ["Easton District"]` (reciprocal relationship).
- [ ] At least 4 ITSystem nodes across the sample files include `annualCost` numeric values matching their `cost` display strings (e.g., `"cost": "£950k/yr"` gets `"annualCost": 950000`). Cover a mix of councils to make the estate summary total meaningful.
- [ ] All 5 JSON files remain valid JSON after editing.
- [ ] `test-complex-lgr.json` is NOT modified (it uses a different schema pattern with `scenario` instead of `councilName` and `targetAuthorities` instead of council-level metadata).

### AC-3: Demo loader updated with new optional fields

- [ ] The inline demo loader (the `btnLoadDemo` click handler at line 2146) is updated to include `councilMetadata` on at least one council (Northshire County should be `"tier": "county"`).
- [ ] At least one demo council includes `"financialDistress": true`.
- [ ] At least one demo system includes a `sharedWith` array.
- [ ] At least one demo system includes an `annualCost` numeric value.
- [ ] The demo loader node count labels in the UI (line 2195) are updated if node counts change.

### AC-4: CLAUDE.md JSON schema documentation fix

- [ ] The ITSystem node schema in CLAUDE.md is updated so properties (`users`, `vendor`, `cost`, `endYear`, `endMonth`, `noticePeriod`, `portability`, `dataPartitioning`, `isCloud`, `isERP`) are shown at the top level of the node object, not nested under a `properties` key.
- [ ] The schema includes the new optional fields: `annualCost` (number), `sharedWith` (string[]), `targetAuthorities` (string[]), `owner` (string).
- [ ] The schema includes the `councilMetadata` top-level object with `tier` and `financialDistress`.
- [ ] The schema remains valid JSON-like pseudocode (it doesn't need to be machine-parseable, just accurate).

## Implementation Notes

### AC-1: Shared service indicator

The insertion point in `buildSystemCard()` should be after the financial distress warning (line 1176) and before the users/vendor metadata row (line 1178). This keeps the information hierarchy consistent: provenance → tier → distress → shared service → users/vendor → disaggregation → contract/architecture details.

Suggested HTML pattern:
```javascript
// After financial distress warning, before the users/vendor div
if (sys.sharedWith && Array.isArray(sys.sharedWith) && sys.sharedWith.length > 0) {
    html += `<div class="mb-2 flex items-center gap-1">
        <span class="gds-tag tag-blue" style="font-size:10px;padding:2px 6px;">Shared service</span>
        <span class="text-[11px] text-gray-600">with ${sys.sharedWith.join(', ')}</span>
    </div>`;
}
```

This reads `sharedWith` directly from the system node (which is preserved through the `{ ...node, _sourceCouncil: councilName }` spread during baselining). No changes to `runBaselining()` are needed.

### AC-2: Sample data field values

Recommended `annualCost` values based on `cost` strings (parse the display string into a number):

| File | System | `cost` | `annualCost` |
|---|---|---|---|
| `northshire-county.json` | Oracle E-Business Suite | "£2.4m/yr" | 2400000 |
| `northshire-county.json` | Liquidlogic LAS | "£950k/yr" | 950000 |
| `northshire-county.json` | Liquidlogic EHM | "£800k/yr" | 800000 |
| `northshire-county.json` | Confirm Environment | "£250k/yr" | 250000 |
| `northshire-county.json` | Symphony ILS | "£180k/yr" | 180000 |
| `northshire-county.json` | Dynamics 365 | "£450k/yr" | 450000 |
| `easton-district.json` | Unit4 Business World | "£450k/yr" | 450000 |
| `easton-district.json` | NEC Revenues (Shared) | "£150k/yr" | 150000 |
| `easton-district.json` | All others | Apply same pattern | ... |
| `southby-borough.json` | All systems | Apply same pattern | ... |
| `westampton-district.json` | All systems | Apply same pattern | ... |

Add `annualCost` to **all** systems across all 4 council files (not just a handful) so the estate summary total is comprehensive and realistic.

### AC-3: Demo loader

The demo loader is a simplified 3-council dataset embedded in JS. Keep it simple — add `councilMetadata` to the county and one or two fields to showcase:
- Northshire County: `councilMetadata: { tier: "county" }`, add `annualCost` to both systems
- Westampton District: `councilMetadata: { tier: "district" }`
- Easton District: `councilMetadata: { tier: "district", financialDistress: true }`, add `sharedWith: ["Westampton District"]` to one system (the Local SQL Routing App or create a plausible shared service)

### AC-4: CLAUDE.md

The current schema block (lines 52-83) shows properties nested under `"properties": { ... }`. Change this to match actual data format where `users`, `vendor`, etc. are top-level on the node object. Add the new optional fields.

## Test Plan

### Property tests
- All 41 existing tests must continue to pass (`npm test`).
- No new property tests are needed (the pure functions for shared service detection are already tested; AC-1 only adds a rendering indicator).

### Browser tests (manual or Playwright)
1. **Shared service on card**: Load the updated `easton-district.json` + `southby-borough.json`. Verify the NEC Revenues system cards show "Shared service — with Southby Borough" (in Easton's column) and "Shared service — with Easton District" (in Southby's column).
2. **Financial distress**: Load the updated files. Verify the Easton District column header shows a financial distress warning. Verify all Easton system cards show the distress banner.
3. **Council tier badges**: Load all 4 updated files. Verify Northshire systems show "COUNTY" badge; district systems show "DISTRICT" badge.
4. **Annual cost in estate summary**: Load all 4 files, proceed through to the dashboard. Verify the estate summary panel shows "Total annual IT spend" with a non-zero aggregate.
5. **Demo loader**: Click "Load Complex LGR Demo Scenario", proceed through. Verify tier badges, distress warning, and shared service indicator appear.
6. **Transition planning mode**: Load files, define a transition structure, verify shared service indicators appear on cards in successor columns.
7. **Export**: Trigger export. Verify the exported HTML includes shared service indicators on cards.

### Sample data
- Load each of the 4 updated JSON files individually — verify no parse errors.
- Load all 4 together — verify full matrix renders without errors.
- `test-complex-lgr.json` should be loadable unchanged (verify no regression).

## Risk Notes

- **Insertion point in `buildSystemCard()`**: The shared service indicator must be added in the right position in the card HTML. Inserting it between the financial distress warning and the users/vendor row maintains the visual hierarchy. Do not insert it inside the persona-conditional blocks (`if (persona === 'commercial'...)`) — it should be visible to all personas.
- **`sharedWith` reciprocity in sample data**: Both sides of the shared relationship must list each other. If `easton-district.json` has `"sharedWith": ["Southby Borough"]` on its NEC Revenues system, then `southby-borough.json` must have `"sharedWith": ["Easton District"]` on its NEC Revenues system. The engine doesn't auto-detect reciprocal sharing — it reads what's declared.
- **`annualCost` values**: These should be plausible numeric representations of the `cost` string. They don't need to be exact — the point is to have any numeric values so the estate summary aggregation works.
- **Demo loader simplicity**: The demo loader is a quick-start feature. Keep additions minimal — just enough to demonstrate the new indicators without bloating the inline data.
- **Do not modify `test-complex-lgr.json`**: This file uses a different pattern (`scenario` block, `targetAuthorities` on nodes, no `councilName`). Modifying it risks breaking its specific test scenario. The new optional fields are not relevant to its disaggregation-focused use case.
