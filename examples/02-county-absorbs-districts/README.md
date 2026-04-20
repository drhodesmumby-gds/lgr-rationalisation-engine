# Scenario 2: County Council Absorbing Three Districts

A county council with significant enterprise systems absorbs three district councils into a single new unitary authority. This scenario introduces the complexity of merging county-level systems (large ERPs, adult social care, children's services) with district-level functions, plus a Civica-heavy legacy district (Millbrook), a mixed-vendor district (Fenwick), and a cloud-first district (Ashbury).

## Councils

| Council | Tier | Key Characteristics |
|---------|------|-------------------|
| Hartfordshire County Council | County | Oracle ERP (on-prem, monolithic, £2.4m/yr), Liquidlogic social care, Dynamics 365 CRM |
| Millbrook District Council | District | Civica-heavy stack, Unit4 ERP, mostly on-premises |
| Fenwick District Council | District | Mixed vendors (NEC, Idox, Access Group), mix of cloud and on-prem |
| Ashbury District Council | District | Cloud-first (Arcus Global, Jadu, Workday, Salesforce) |

## Transition Structure

All four councils merge into a single new unitary authority.

- **Vesting Date**: 2027-04-01
- **Successors**: Hartfordshire Council (full predecessors: all four councils)

## What This Scenario Demonstrates

- ERP dominance: Oracle E-Business Suite (county) and Unit4 (Millbrook) both serve Finance and HR — the engine should flag the ERP collision and lock-in risk
- County functions (adult social care 148, children's services 152, highways 109, libraries 76) are unique to the county — no collisions from districts, but districts bring new functions the county doesn't cover
- Civica vendor concentration in Millbrook — the commercial persona should flag the dependency risk
- Cloud/on-prem divide: Ashbury's entire estate is cloud, Millbrook's is largely on-prem — the architect persona should surface modernisation complexity
- Multiple contract expirations in 2026-2027 coinciding with the vesting window — the timeline view shows high-pressure decision points
- Four-way collisions on waste (142), benefits (3), planning (101), housing (159), and elections (146) — the engine should show multi-council rationalisation decisions
- Oracle ERP notice period is 12 months — any decision to migrate needs to be made before April 2026 to avoid straddling the vesting date

## Files

- `hartfordshire-county.json` — County council architecture (6 systems incl. Oracle ERP and Liquidlogic)
- `millbrook-district.json` — Millbrook District (9 systems, Civica-heavy, Unit4 ERP)
- `fenwick-district.json` — Fenwick District (9 systems, mixed NEC/Idox/Access Group)
- `ashbury-district.json` — Ashbury District (9 systems, cloud-first Arcus/Jadu/Workday/Salesforce)
- `transition-config.json` — Transition configuration (vesting 2027-04-01, single successor)

## How to Use

1. Open the LGR Rationalisation Engine in a browser
2. Upload all four council JSON files in Stage 1
3. Import `transition-config.json` or manually configure the transition structure
4. Proceed through baselining to the dashboard
5. Explore the analysis from different persona perspectives:
   - **Executive**: The Oracle ERP lock-in (£2.4m/yr, 12-month notice, expires 2029) is the biggest strategic risk — any migration decision must be made now to avoid a costly straddled renewal
   - **Commercial**: Civica appears across multiple Millbrook systems and Hartfordshire — significant vendor concentration and potential leverage
   - **Architect**: Three ERPs in scope (Oracle, Unit4, Hartfordshire's ERP); Millbrook's on-prem Civica stack has the lowest overall portability; Ashbury's Salesforce CRM collides with the county's Dynamics 365
