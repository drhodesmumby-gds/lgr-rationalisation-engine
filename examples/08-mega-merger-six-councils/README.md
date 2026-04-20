# Scenario 8: Six-Council Mega-Merger into Two Unitaries

A complex six-council LGR where one county and five districts are reorganised into two successor unitary authorities. The county is disaggregated across both successors, while three districts become West Elmhurst and two become Ivy Hatherley. This scenario demonstrates maximum vendor diversity, deep function collisions, and the contrast between a well-funded legacy county and four very different district architectures ranging from cloud-first to almost entirely in-house.

## Councils

| Council | Tier | Key Characteristics |
|---------|------|---------------------|
| Westshire County Council | County | Large legacy estate, SAP ERP, System C social care, 14 systems — disaggregated across both successors |
| Elmhurst District Council | District | Mixed stack, Idox and MRI for planning/housing, Civica financials, MHR iTrent HR |
| Fairford Borough Council | District | Civica-heavy — revenues, housing, finance, and HR all on Civica products |
| Grantham District Council | District | Smallest council, largely in-house systems with no vendor support or SLA |
| Hatherley District Council | District | NEC stack throughout — planning, housing, revenues, CRM all on NEC products |
| Ivybridge Borough Council | District | Cloud-first moderniser — Arcus Global, Workday, Jadu; highest portability scores |

## Transition Structure

Two successor unitaries formed from partial county dissolution and full district absorption.

- **Vesting Date**: 2027-04-01
- **Successors**:
  - **West Elmhurst Council**: Westshire County (partial), Elmhurst District (full), Fairford Borough (full), Grantham District (full)
  - **Ivy Hatherley Council**: Westshire County (partial), Hatherley District (full), Ivybridge Borough (full)

## What This Scenario Demonstrates

- **Maximum function collision depth**: CRM, waste, benefits, planning, housing, and environmental health all appear 5-6 times across district councils, requiring forced rationalisation decisions
- **County disaggregation complexity**: Westshire County's services must be split between two successors — social care, highways, libraries, and the SAP ERP all need assignment
- **Extreme vendor diversity**: No two councils share the same primary stack; CRM alone spans Microsoft Dynamics 365, GOSS iCM, Granicus, NEC Firmstep, In-House, and Jadu CXM
- **In-house system risk**: Grantham District's five in-house systems (waste, planning, housing, env health, CRM) have no vendor, no SLA, and no migration path — successor council inherits pure technical debt
- **Vendor concentration vs. cloud-first contrast**: Fairford is deeply locked into Civica; Ivybridge has high-portability cloud systems that could accelerate rationalisation
- **NEC stack concentration risk**: Hatherley runs NEC products across six functions — Ivy Hatherley Council will need to decide whether to standardise on NEC or rationalise
- **SAP ERP lock-in**: Westshire's SAP contract runs to 2030 with 18-month notice — this is the dominant Day 1 constraint for both successors
- **Successor asymmetry**: West Elmhurst inherits 4 predecessor estates (including the most complex districts); Ivy Hatherley inherits 3 (including the most modern)

## Files

| File | Contents |
|------|----------|
| `westshire-county.json` | Westshire County Council — 14 functions, 12 systems including SAP ERP, System C social care |
| `elmhurst-district.json` | Elmhurst District Council — 10 functions, 10 systems; mixed Idox/MRI/Civica/MHR stack |
| `fairford-borough.json` | Fairford Borough Council — 9 functions, 9 systems; Civica-dominated estate |
| `grantham-district.json` | Grantham District Council — 9 functions, 9 systems; largely in-house with minimal vendor contracts |
| `hatherley-district.json` | Hatherley District Council — 10 functions, 10 systems; NEC-dominant stack |
| `ivybridge-borough.json` | Ivybridge Borough Council — 9 functions, 9 systems; cloud-first with Arcus Global and Workday |
| `transition-config.json` | Successor configuration: West Elmhurst and Ivy Hatherley, vesting 2027-04-01 |

## How to Use

1. Open the LGR Rationalisation Engine in a browser
2. Upload all six council JSON files in Stage 1
3. Import `transition-config.json` or manually configure the two successors
4. Proceed through baselining to the dashboard
5. Use the perspective filter to compare West Elmhurst (4 predecessors) vs Ivy Hatherley (3 predecessors)
6. Check the Commercial persona view to assess vendor density and rationalisation targets — CRM alone has six competing products
7. Check the Architect persona view to identify the Grantham in-house system risk and the SAP lock-in timeline
