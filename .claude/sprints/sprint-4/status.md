# Sprint 4 Status: Sticky Headers + Sort/Filter

**Status: COMPLETE**
**Tests: 41/41 passing**

## Implemented

### AC-1 & AC-2: Sticky headers and sticky function column (CSS)
Added to `<style>` block (lines 65-83):
- `#dashboardMatrix thead th` — sticky top, z-index 10, black background
- `#dashboardMatrix thead th:first-child` and `tbody td:first-child` — sticky left, z-index 5
- Top-left corner cell gets z-index 20
- First `tbody` column cells get explicit white background

### AC-3: Scroll context
Matrix wrapper div changed from `overflow-x-auto` to `overflow-auto max-h-[80vh]` — enables both horizontal and vertical scrolling.

### AC-4: Sort controls
- State variable `activeSortMode = 'tier'` added near other state vars (~line 318)
- `sortFunctionRows()` extended to support 4 modes: `tier` (default), `collisions`, `alpha`, `urgency`
- `earliestNotice` computed per row during functionRows construction (earliest notice trigger date as fractional year across all systems)
- Change handler on `#sortModeSelect` calls `renderDashboard()`

### AC-5: Filter controls
- State variable `activeFilters = { tier: 'all', collision: 'all' }` added (~line 319)
- Filter logic applied to `functionRows` before sorting (tier filter, collision filter)
- Change handlers on `#filterTierSelect` and `#filterCollisionSelect` call `renderDashboard()`
- Filter and sort state persists across persona switches (module-level vars, not reset in `renderDashboard()`)

### Toolbar
- `#matrixToolbar` div inserted between estate summary panel and matrix
- GOV.UK styling: `bg-[#f3f2f1]`, `border border-[#b1b4b6]`
- Shows "Showing X of Y functions" count (right-aligned)
- Toolbar hidden initially, shown by `renderDashboard()` with current state synced to dropdowns
- Works in both Estate Discovery and Transition Planning modes

### AC-6: Regression
- All 41 property tests pass
- No changes to test files
- Export, modals, all personas unaffected
