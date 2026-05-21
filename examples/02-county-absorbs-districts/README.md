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

## Features Demonstrated

- **ERP dominance**: Oracle E-Business Suite (county, vendor-supported) and Unit4 (Millbrook, vendor-supported) both serve Finance and HR — collisions with lock-in risk
- **County functions**: Adult social care, children's services, highways, libraries are unique to the county — districts bring new distinct functions (housing, environmental health, waste)
- **Vendor concentration**: Civica heavy in Millbrook (waste, revenues, planning, housing, EH, elections) — single-vendor dependency risk
- **Cloud/on-prem modernisation**: Ashbury entirely cloud and vendor-supported; Millbrook heavily on-premises — wide gap in operational maturity
- **Contract urgency**: Millbrook Electoral IQ expires September 2026; multiple Civica contracts hit within the vesting window (June 2027)
- **Multi-council collisions**: Waste, benefits, planning, housing, and elections each have competing systems across 3-4 councils
- **Capability dependencies**: Oracle ERP provides payments to Capita Pay360; Liquidlogic systems provide SMS/email via GOV.UK Notify
- **Support model profile**: Most systems vendor-supported; Millbrook Civica stack demonstrates legacy on-premises risk

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
