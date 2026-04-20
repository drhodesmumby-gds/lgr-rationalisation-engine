# Scenario 3: Shared Service Partnership Dissolution

Three councils in a shared service arrangement are being split across two different successor authorities. Riverdale and Kingsway currently share three systems (NEC Revenues, MHR iTrent, Civica Elections) — but Riverdale goes to Riverside Council while Kingsway becomes Greater Wolds Council. These shared systems must be unwound, creating procurement complexity and potential service disruption risk.

## Councils

| Council | Tier | Key Characteristics |
|---------|------|-------------------|
| Riverdale Borough Council | District | Part of shared service with Kingsway; merging into Riverside Council |
| Kingsway District Council | District | Part of shared service with Riverdale; forming Greater Wolds Council |
| Stonebridge Borough Council | District | Fully independent systems; also merging into Riverside Council |

## Transition Structure

Two successor authorities are formed from this dissolution:

- **Vesting Date**: 2027-04-01
- **Successors**:
  - Riverside Council — full predecessor: Riverdale Borough Council + Stonebridge Borough Council
  - Greater Wolds Council — full predecessor: Kingsway District Council

## What This Scenario Demonstrates

- Shared systems being split to different successors — the engine should flag NEC Revenues (monolithic, low portability) as the highest risk: two councils use one database, and they're going separate ways
- MHR iTrent (monolithic, medium portability) is also shared across the split — the HR function will be disrupted
- Civica Elections (shared) has medium portability and a June 2027 contract end — tight timeline for separation given the April 2027 vesting
- NEC Revenues is on-premises, monolithic, and has a 9-month notice period — procurement action required well before vesting
- Stonebridge is a clean cloud estate — it brings healthy systems to Riverside Council with no shared-service complications
- The scenario surfaces the difference between "we share a contract" and "we have separate data" — segmented vs monolithic partitioning becomes critical for separation planning
- Multiple three-way collisions (benefits, waste, planning, housing, elections, etc.) — the dashboard should show 3-council collisions on most rows

## Files

- `riverdale-borough.json` — Riverdale Borough Council (9 systems, includes 3 shared systems with Kingsway)
- `kingsway-district.json` — Kingsway District Council (9 systems, includes 3 shared systems with Riverdale)
- `stonebridge-borough.json` — Stonebridge Borough Council (9 systems, fully independent cloud estate)
- `transition-config.json` — Transition configuration (vesting 2027-04-01, two successors)

## How to Use

1. Open the LGR Rationalisation Engine in a browser
2. Upload all three council JSON files in Stage 1
3. Import `transition-config.json` or manually configure the transition structure
4. Proceed through baselining to the dashboard
5. Explore the analysis from different persona perspectives:
   - **Executive**: The NEC Revenues system (shared, monolithic, low portability, on-prem) going to separate successors is the top Day 1 risk — it needs a separation plan urgently
   - **Commercial**: Three shared contracts must be split or duplicated. NEC Revenues (£300k + £240k combined) and MHR iTrent need separate procurements — significant cost implications
   - **Architect**: Monolithic data partitioning on the shared NEC and MHR systems means data extraction and migration are required before separation — not just a contract split
