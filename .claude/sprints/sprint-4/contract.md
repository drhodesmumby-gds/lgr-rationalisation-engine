# Sprint 4: Sticky Headers + Sort/Filter

## Scope

Add freeze-pane behavior to the dashboard matrix (sticky header row and function column) and provide sort/filter controls above the matrix.

## Acceptance Criteria

### AC-1: Sticky header row

- [ ] The `<thead>` row of `#dashboardMatrix` uses `position: sticky; top: 0` so it remains visible when scrolling vertically.
- [ ] Header cells have explicit background colors to cover content behind them.
- [ ] Works in both Estate Discovery and Transition Planning modes.

### AC-2: Sticky function column

- [ ] The first `<th>` and first `<td>` in each row use `position: sticky; left: 0` so the Standard Function column remains visible when scrolling horizontally.
- [ ] The top-left corner cell (header + first column intersection) has the highest z-index.
- [ ] First column cells have explicit `bg-white` backgrounds.

### AC-3: Scroll context

- [ ] The matrix wrapper div (`line 201`) uses `overflow: auto` (both axes) and `max-h-[80vh]` to create the scroll context for sticky positioning.
- [ ] The matrix is scrollable both horizontally (for many councils) and vertically (for many functions).

### AC-4: Sort controls

- [ ] A toolbar row appears between the estate summary panel and the matrix.
- [ ] Sort dropdown with options: "Tier priority" (default), "Collision count", "Function name (A-Z)", "Contract urgency".
- [ ] Selecting a sort option re-renders the matrix with the new sort order.
- [ ] Sort state persists across persona switches.
- [ ] New state variable `activeSortMode` added near other state vars.

### AC-5: Filter controls

- [ ] Tier filter dropdown: "All tiers", "Tier 1 only", "Tier 2 only", "Tier 3 only".
- [ ] Collision filter dropdown: "All functions", "Collisions only", "Unique only".
- [ ] Filters apply before sorting in the rendering pipeline.
- [ ] Filter state persists across persona switches.
- [ ] New state variable `activeFilters` added near other state vars.

### AC-6: Regression

- [ ] All 41 existing property tests pass (`npm test`).
- [ ] Zero JavaScript console errors when loading demo data and navigating all stages.
- [ ] Works for all 3 personas.
- [ ] Export still functions.
- [ ] Existing modals (Glossary, Tier Mapping, Analysis, Signal Options) still work.

## Implementation Notes

### CSS for sticky positioning

Add to `<style>` block:
```css
#dashboardMatrix thead th {
    position: sticky;
    top: 0;
    z-index: 10;
    background: #0b0c0c;
}
#dashboardMatrix thead th:first-child,
#dashboardMatrix tbody td:first-child {
    position: sticky;
    left: 0;
    z-index: 5;
}
#dashboardMatrix thead th:first-child {
    z-index: 20;
}
#dashboardMatrix tbody td:first-child {
    background: white;
}
```

### Sort function extension

Current `sortFunctionRows()` at line 1630 sorts by tier → collisions → alpha. Extend to support multiple modes:
```javascript
function sortFunctionRows(rows) {
    return rows.slice().sort((a, b) => {
        switch (activeSortMode) {
            case 'collisions': return b.collisionCount - a.collisionCount || a.label.localeCompare(b.label);
            case 'alpha': return a.label.localeCompare(b.label);
            case 'urgency': return (a.earliestNotice || Infinity) - (b.earliestNotice || Infinity);
            default: // 'tier'
                if (a.tier !== b.tier) return a.tier - b.tier;
                if (a.collisionCount !== b.collisionCount) return b.collisionCount - a.collisionCount;
                return a.label.localeCompare(b.label);
        }
    });
}
```

For urgency sort, compute `earliestNotice` per row from `relevantSystems` during functionRows construction.

### Toolbar rendering

Render inside `renderDashboard()` before the matrix, or as a static element that gets wired once. Prefer rendering it as part of the estate summary section to keep it visually grouped.

### Filter application

Apply filters to `functionRows` before sorting:
```javascript
let filteredRows = functionRows;
if (activeFilters.tier !== 'all') {
    filteredRows = filteredRows.filter(r => r.tier === parseInt(activeFilters.tier));
}
if (activeFilters.collision === 'collision') {
    filteredRows = filteredRows.filter(r => r.collisionCount > 1);
} else if (activeFilters.collision === 'unique') {
    filteredRows = filteredRows.filter(r => r.collisionCount <= 1);
}
```

## Key Locations

- `<style>` block: lines ~20-90
- Matrix wrapper div: line 201
- Estate summary panel: line 198
- Header rendering: lines 1098-1105 (transition), 1196-1206 (discovery)
- First td in each row: lines 1145 (transition), 1246 (discovery)
- `sortFunctionRows()`: line 1630
- `functionRows` construction: lines 1064-1086
- State variables: ~line 300

## Test Plan

1. All 41 property tests pass
2. Scroll down → header stays visible
3. Scroll right → function column stays visible
4. Sort by each option → verify order changes
5. Filter by tier → rows hidden/shown correctly
6. Switch personas → sort/filter state persists
7. Load demo data in both modes → verify sticky + sort/filter work
