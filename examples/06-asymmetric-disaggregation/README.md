# Scenario 6: Asymmetric Disaggregation

Five-Council Disaggregation into Two Unitaries — a county council and four districts reorganise into two new unitary authorities along geographic lines. Two councils (the county and a financially distressed borough) are split across both successors, creating the most complex data disaggregation patterns the engine can surface.

## Councils

| Council | Tier | Key Characteristics |
|---------|------|-------------------|
| Northmoor County Council | County | County-level services (social care, children's, highways), Oracle ERP (monolithic), Liquidlogic LAS (critical disaggregation risk — monolithic data, split across both successors) |
| Alderton District Council | District | Unit4 ERP, standard district service stack, medium-quality mixed vendor portfolio |
| Bramfield District Council | District | No ERP (Sage Intacct), mostly cloud-forward, Capita legacy benefits contract expiring soon |
| Chelworth District Council | District | Most modern stack of the four districts, Workday HCM, Granicus CRM, contract dates 2029-2030 |
| Dunstable Borough Council | District (financialDistress: true) | Underinvested, multiple expired/expiring contracts (2025-2026), in-house and legacy systems, split across both successors |

## Transition Structure

Five councils disaggregate into two geographically defined unitary authorities. The county and the distressed borough are both split across the two successors — requiring system partition, not just migration.

- **Vesting Date**: 2027-04-01
- **Successors**:
  - **North Alderton Council**: Alderton (full), Bramfield (full), and partial areas from Northmoor and Dunstable
  - **South Chelworth Council**: Chelworth (full), and partial areas from Northmoor and Dunstable

## What This Scenario Demonstrates

- Extract-and-partition pattern: County systems serving both successor areas must be split, not just migrated
- Northmoor's Liquidlogic LAS (adult social care, monolithic data) is the highest-risk disaggregation: it must serve both North Alderton and South Chelworth with no clean data boundary
- Northmoor's Oracle ERP (£1.8m/yr, 18-month notice, contract to 2031) is a long-running cost liability that both successors must plan for
- Dunstable's financially distressed status means urgency: several contracts already expired or expiring in 2025-2026 — Day 1 continuity risk
- Bramfield's Capita Benefits contract expires 2027-12 — needs early re-procurement to land before vesting
- Chelworth's modern cloud stack (Workday, Granicus) becomes the template for South Chelworth's target architecture
- Executive persona should surface the Dunstable expired systems as immediate risk items requiring emergency procurement
- Commercial persona should identify the five-council vendor landscape and opportunities for aggregated procurement by successor
- Architect persona should flag Liquidlogic LAS monolith partition as the highest technical risk item in the programme

## Files

- `northmoor-county.json` — Northmoor County Council: county-level systems including the critical Liquidlogic LAS and Oracle ERP, with targetAuthorities set to show expected system destinations
- `alderton-district.json` — Alderton District Council: standard district portfolio with Unit4 ERP
- `bramfield-district.json` — Bramfield District Council: cloud-forward district portfolio, no ERP
- `chelworth-district.json` — Chelworth District Council: most modern district stack, Workday and Granicus
- `dunstable-borough.json` — Dunstable Borough Council: financially distressed, legacy and expired systems, split across both successors
- `transition-config.json` — Transition configuration: two successors (North Alderton and South Chelworth), county and borough as partial predecessors of both

## How to Use

1. Open the LGR Rationalisation Engine in a browser
2. Upload all five council JSON files in Stage 1
3. Import the transition config — note the two-successor structure and the partial predecessor assignments
4. Proceed through baselining to the dashboard
5. Switch to the Executive persona and look for Dunstable's expired and near-expiry systems flagged as Day 1 risks
6. Switch to the Architect persona and locate Adult Social Care (148) — the Liquidlogic LAS monolith split across two successors is the headline risk
7. Switch to the Commercial persona to review Northmoor's Oracle ERP contract (£1.8m/yr to 2031) and the multi-council vendor landscape
