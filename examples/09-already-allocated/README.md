# Pre-Allocated Migration

Demonstrates the `targetAuthorities` field and "Detect from architecture" feature. Three councils merging into two unitary authorities, with varying levels of pre-planned system allocation.

## Councils

| Council | Tier | Key Characteristics |
|---------|------|-------------------|
| Penworth County Council | County | All systems pre-allocated via targetAuthorities |
| Langton District Council | District | Half systems pre-allocated, half undecided |
| Middleham District Council | District | No pre-allocation — greenfield planning |

## Transition Structure

- **Vesting Date**: 2027-04-01
- **Penworth North Council**: Penworth County (partial) + Langton District (full)
- **Penworth South Council**: Penworth County (partial) + Middleham District (full)

## What This Scenario Demonstrates

- `targetAuthorities` field pre-populating successor allocations
- "Detect from architecture" button auto-detecting pre-planned allocations
- Mixed allocation states: fully planned, partially planned, completely unplanned
- County disaggregation with Oracle ERP going to both successors
- Contrast between councils at different stages of migration planning

## Files

- `penworth-county.json` — County with all 8 systems targeting specific successors
- `langton-district.json` — District with 4/8 systems pre-allocated to Penworth North
- `middleham-district.json` — District with no pre-allocation (greenfield)
- `transition-config.json` — Two-successor transition structure

## How to Use

1. Open the LGR Rationalisation Engine in a browser
2. Upload all three council JSON files in Stage 1
3. Click "Detect from architecture" to auto-populate successor allocations
4. Or manually configure transition structure and compare with detected allocations
5. Proceed through baselining to the dashboard
6. Explore the analysis from different persona perspectives
