# Sprint 6 Status: Transition Structure Import/Export

## Status: COMPLETE

## Date: 2026-04-18

## Tests: 41/41 passing

## What was implemented

### AC-1: Export Configuration
- `exportTransitionStructure()` function added (~line 849)
- Calls `collectTransitionStructure()`, adds `exportedAt` ISO timestamp and `sourceCouncils` array
- Downloads as `transition-config.json` via blob URL pattern
- Export button disabled when no successors configured (updated in `validateTransitionConfig()`)

### AC-2: Import Configuration
- Hidden `<input type="file" accept=".json" id="transitionConfigInput" class="sr-only">` added inside `stageTransitionConfig` panel
- `importTransitionStructure(json)` function validates `vestingDate` + `successors`, filters mismatched councils with warning
- Warning banner (`#transitionImportWarning`) shows mismatched council names when detected
- After import: populates `transitionStructure`, calls `renderTransitionConfigPanel()`, `enforceTransitionConstraints()`, `validateTransitionConfig()`

### AC-3: Detect from Architecture
- `detectFromArchitecture()` scans all `rawUploads` for ITSystem nodes with `targetAuthorities`
- Extracts unique authority names and maps predecessor councils per authority
- Pre-populates successor rows with `partialPredecessors` from councils that reference each authority

### AC-4: Regression
- All 41 property tests pass
- Manual transition config flow unchanged
- Constraint enforcement continues to work after import

## Button placement
All three buttons added to the successor authorities toolbar row:
- "Detect from architecture" (`gds-btn-secondary`) — left
- "Import Configuration" (`gds-btn-secondary`) — middle
- "Export Configuration" (`gds-btn` green) — disabled when no successors
- "+ Add Successor" (`gds-btn-secondary`) — right (existing)
