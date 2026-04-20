# Sprint 6: Transition Structure Import/Export

## Scope

Add the ability to export the current transition structure configuration to a JSON file, and import a previously saved transition structure from JSON. This enables saving and sharing transition configurations independently of the architecture data.

## Acceptance Criteria

### AC-1: Export transition structure

- [ ] "Export Configuration" button appears on the Transition Structure Configuration panel (Stage 1.5).
- [ ] Clicking generates a JSON file containing the full transition structure:
  ```json
  {
    "vestingDate": "2027-04-01",
    "successors": [
      {
        "name": "Newborough",
        "fullPredecessors": ["Northshire County"],
        "partialPredecessors": ["Easton District", "Westampton District"]
      }
    ],
    "exportedAt": "2026-04-18T12:00:00Z",
    "sourceCouncils": ["Easton District", "Northshire County", "Westampton District"]
  }
  ```
- [ ] Downloads as `transition-config.json`.
- [ ] Button is only enabled when at least one successor is configured.

### AC-2: Import transition structure

- [ ] "Import Configuration" button appears on the Transition Structure Configuration panel.
- [ ] Clicking opens a file picker for JSON files.
- [ ] Valid JSON populates the vesting date, successor names, and predecessor checkboxes.
- [ ] If councils in the imported config don't match uploaded architectures, show a warning listing mismatched councils but still import what can be matched.
- [ ] Import triggers `enforceTransitionConstraints()` and `validateTransitionConfig()` after populating.

### AC-3: Architecture file integration

- [ ] If an uploaded architecture JSON file contains `targetAuthorities` on ITSystem nodes, these are recognised and displayed in the transition config panel as suggested allocations.
- [ ] A "Detect from architecture" button scans all uploaded systems for `targetAuthorities` and pre-populates successor names and allocations from the data.

### AC-4: Regression

- [ ] All 41 existing property tests pass.
- [ ] Zero JS console errors.
- [ ] Manual transition config still works without import.
- [ ] Existing predecessor constraint validation still enforced after import.

## Implementation Notes

### Export function
```javascript
function exportTransitionStructure() {
    const structure = collectTransitionStructure();
    structure.exportedAt = new Date().toISOString();
    structure.sourceCouncils = Array.from(mergedArchitecture.councils);
    const blob = new Blob([JSON.stringify(structure, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transition-config.json';
    a.click();
    URL.revokeObjectURL(url);
}
```

### Import function
Use the same hidden-input-click pattern used for file upload. Read JSON, validate structure, then call `renderTransitionConfigPanel()` with the imported data pre-populated in `transitionStructure`.

### File picker for import
Add a hidden `<input type="file" accept=".json">` near the transition config panel, triggered by the Import button click.

## Key Locations

- Transition config panel HTML: ~lines 130-160
- `renderTransitionConfigPanel()`: line 524
- `collectTransitionStructure()`: line 608
- `addSuccessorRow()`: line 546
- `enforceTransitionConstraints()`: ~line 662
- `validateTransitionConfig()`: ~line 640
- `transitionStructure` state variable: line 309

## Test Plan

1. All 41 property tests pass
2. Configure 2 successors with various predecessor assignments → Export → verify JSON structure
3. Start fresh → Import the exported JSON → verify successors and predecessors populated correctly
4. Import a config with a council name that doesn't match any upload → verify warning shown
5. Upload architecture files with `targetAuthorities` → click "Detect from architecture" → verify pre-population
6. Import → verify constraint enforcement runs (disabled checkboxes correct)
