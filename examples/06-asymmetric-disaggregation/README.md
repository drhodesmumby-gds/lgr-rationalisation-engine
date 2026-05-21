# Scenario 6: Asymmetric Disaggregation

Five-Council Disaggregation into Two Unitaries — a county council and four districts reorganise into two new unitary authorities along geographic lines. Two councils (the county and a financially distressed borough) are split across both successors, creating the most complex data disaggregation patterns the engine can surface.

## Councils

| Council | Tier | Key Characteristics |
|---------|------|-------------------|
| Northmoor County Council | County | County-level services (social care, children's, highways), Oracle ERP (vendor-supported, monolithic), Liquidlogic LAS (vendor-supported, critical disaggregation risk — monolithic data, split across both successors), Koha and Public Health Analytics (community-supported OSS) |
| Alderton District Council | District | Unit4 ERP (vendor-supported), standard district service stack with vendor-supported systems throughout, all payments routed via Capita Pay360 (vendor-supported) |
| Bramfield District Council | District | Sage Intacct Finance (vendor-supported), mostly cloud-forward with vendor-supported systems, Capita legacy benefits contract (vendor-supported) expiring soon |
| Chelworth District Council | District | Most modern stack of the four districts, Workday HCM (vendor-supported), Granicus CRM (vendor-supported), all systems vendor-supported, contract dates 2029-2030 |
| Dunstable Borough Council | District (financialDistress: true) | Underinvested with multiple systems marked `unsupported` (expired/expiring contracts 2025-2026), in-house systems and legacy on-prem, split across both successors, only Sage 50 Finance and GOV.UK tools operational |

## Transition Structure

Five councils disaggregate into two geographically defined unitary authorities. The county and the distressed borough are both split across the two successors — requiring system partition, not just migration.

- **Vesting Date**: 2027-04-01
- **Successors**:
  - **North Alderton Council**: Alderton (full), Bramfield (full), and partial areas from Northmoor and Dunstable
  - **South Chelworth Council**: Chelworth (full), and partial areas from Northmoor and Dunstable

## What This Scenario Demonstrates

- **Support Model Asymmetry**: Northmoor and Alderton run entirely vendor-supported systems (commercial vendors + some community OSS). Dunstable's systems heavily marked `unsupported` — expired contracts, EOL products, in-house legacy code. This visualises the risk differential: healthy councils vs. distressed councils in the same disaggregation create technology tiers.
- **Capability Entanglement**: Northmoor's Oracle ERP provides payments/workflow capabilities consumed by Liquidlogic LAS, Confirm highways, and Capita Pay360. Disaggregation means both successors must plan for Oracle access or re-engineer payment flows.
- Extract-and-partition pattern: County systems serving both successor areas must be split, not just migrated
- Northmoor's Liquidlogic LAS (adult social care, monolithic, vendor-supported, payments-consuming) is the highest-risk disaggregation: it must serve both North Alderton and South Chelworth with no clean data boundary
- Northmoor's Oracle ERP (£1.8m/yr, 18-month notice, vendor-supported, contract to 2031) is a long-running cost liability that both successors must plan for or replace
- Dunstable's financially distressed status means urgency: several systems marked `unsupported` (contracts already expired or expiring 2025-2026) — Day 1 continuity risk, no vendor SLA to fall back on
- Bramfield's Capita Benefits contract expires 2027-12 — vendor-supported but needs early re-procurement to land before vesting
- Chelworth's modern cloud stack (Workday, Granicus, all vendor-supported) becomes the template for South Chelworth's target architecture
- Executive persona should surface Dunstable's unsupported systems as critical emergency items requiring emergency procurement and temporary support arrangements
- Commercial persona should identify the five-council vendor landscape, the split between healthy councils (vendor-supported) and distressed (unsupported), and opportunities for aggregated procurement by successor
- Architect persona should flag Liquidlogic LAS monolith partition as the highest technical risk item plus the support model tier mismatch with Dunstable's legacy systems

## Files

- `northmoor-county.json` — Northmoor County Council: vendor-supported systems (Oracle ERP, Liquidlogic LAS, Confirm, Dynamics, Capita Pay360) plus community-supported Koha library system and Public Health Analytics, with targetAuthorities showing system partition across both successors
- `alderton-district.json` — Alderton District Council: all systems vendor-supported, Unit4 ERP (payments/workflow) with 3 downstream systems consuming payments via Capita Pay360
- `bramfield-district.json` — Bramfield District Council: all systems vendor-supported, cloud-forward district portfolio with Sage Intacct finance, GOV.UK tools (community-supported)
- `chelworth-district.json` — Chelworth District Council: all systems vendor-supported, most modern district stack with Workday and Granicus, GOV.UK tools (community-supported)
- `dunstable-borough.json` — Dunstable Borough Council: financially distressed with multiple systems marked `unsupported` (Capita Waste, NEC Benefits, in-house Planning/EH/Finance, Civica Elections), minimal vendor-supported systems, split across both successors, Sage 50 Finance and GOV.UK tools also unsupported
- `transition-config.json` — Transition configuration: two successors (North Alderton Council and South Chelworth Council), county and borough as partial predecessors of both

## How to Use

1. Open the LGR Rationalisation Engine in a browser
2. Upload all five council JSON files in Stage 1
3. Import the transition config — note the two-successor structure and the partial predecessor assignments
4. Proceed through baselining to the dashboard
5. Switch to the Executive persona and look for Dunstable's systems marked `unsupported` — multiple Day 1 risks requiring emergency procurement or emergency support arrangements
6. Switch to the Architect persona and locate Adult Social Care (148) — the Liquidlogic LAS monolith split across two successors is the headline risk; note the Oracle payment dependency
7. Switch to the Commercial persona to review Northmoor's Oracle ERP contract (£1.8m/yr to 2031), Dunstable's lack of vendor SLA coverage, and opportunities for post-vesting platform standardisation (Workday target for both successors based on Chelworth template)
8. Inspect the Capabilities panel to visualize how Northmoor's Oracle ERP payments capability flows to both successors, creating a forced 2031 dependency on Oracle for both authorities
