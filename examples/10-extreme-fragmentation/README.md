# Scenario 10: Extreme Fragmentation — Maximum Chaos

## Overview

Seven councils merging into three successor authorities. Every rationalisation challenge present simultaneously. Designed to stress-test the engine at scale and surface every type of collision, risk flag, and planning gap.

## Councils

| Council | Tier | Notable Characteristics |
|---|---|---|
| Greater Blackwood County Council | County | 15 systems; Unit4 ERP; Liquidlogic LAS monolithic disaggregation risk; disaggregated 3 ways |
| Ashford Borough Council | District | 10 systems; shares NEC Revenues with Birchwood |
| Birchwood District Council | District | 8 systems; **financial distress**; all contracts EXPIRED (2025); legacy Capita/NEC estate |
| Copperfield District Council | District | 10 systems; modern cloud-first; **split between two successors** |
| Drayton Borough Council | District | 9 systems; SAP S/4HANA ERP — creates triple ERP collision |
| Eastbury District Council | District | 10 systems; **all-NEC vendor estate** — extreme vendor concentration risk |
| Foxhall District Council | District | 9 systems; Oracle Fusion ERP; long legacy contracts to 2031-2032 |

## Successor Authorities

- **Blackwood North Council** — inherits Ashford and Birchwood in full; receives partial county and partial Copperfield
- **Blackwood South Council** — inherits Drayton and Eastbury in full; receives partial county
- **Copperfield Vale Council** — inherits Foxhall in full; receives partial Copperfield

## Rationalisation Challenges

### Triple ERP Collision
Three ERPs competing for rationalisation across the merged estate:
- Unit4 Business World (county, 8,500 users, £2.6m/yr, contract 2031)
- SAP S/4HANA (Drayton, 1,500 users, £700k/yr, contract 2030)
- Oracle Fusion (Foxhall, 1,100 users, £550k/yr, contract 2031 with 18-month notice)

No successor inherits all three — but any two successors may face internal ERP conflicts.

### County Disaggregation — 3 Ways
Greater Blackwood County is split three ways. Critical systems including:
- Liquidlogic LAS (Adult Social Care): monolithic, low portability — cannot be cleanly divided
- Liquidlogic EHM (Children's Services): monolithic — same problem
- Capita One SEN: monolithic, low portability
- Unit4 ERP: monolithic, 8,500 users across all three successor areas

### Financial Distress + Expired Contracts
Birchwood District is in financial distress with all 8 contracts expired in 2025. Immediate procurement risk for the successor. No functioning technology roadmap — the incoming authority inherits a council running on month-to-month or lapsed agreements.

### Shared Services Crossing Boundaries
NEC Revenues is shared between Ashford Borough and Birchwood District. Both go to Blackwood North — but the shared contract must be renegotiated as a single-authority contract at vesting.

### All-NEC Estate (Eastbury)
Eastbury District's entire 10-system estate is NEC. This creates extreme vendor concentration in Blackwood South and exposes the successor to NEC's full leverage in any renegotiation.

### Copperfield Split
Copperfield District's modern, cloud-first estate is divided between Blackwood North and Copperfield Vale. Its Arcus Global systems (waste, planning, env health), Access Group housing, and Workday HR must be allocated across two successors — the clean cloud estate risks being fragmented by the split.

## Scale

- 7 source councils
- 3 successor authorities
- ~75 total systems
- 4 ERP instances (Unit4, SAP, Oracle — plus Oracle also at county level)
- Contracts ranging from expired (2025) to 2032
- Mix of cloud, on-prem, shared, and legacy systems

## Loading Instructions

Load all seven council JSON files. The transition config defines the three successor authorities. Review the Architect persona view first to identify ERP collisions and monolithic disaggregation risks, then the Commercial view for vendor concentration and notice period exposure.
