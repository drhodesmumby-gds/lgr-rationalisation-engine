# Scenario 4: Financially Distressed Council Emergency Merger

A financially distressed district council is merged under emergency direction into a neighbouring healthy district. Greyminster Borough Council — flagged for financial distress — runs an entirely legacy on-premises estate with multiple expired contracts and a chronic underinvestment pattern. Westhaven District Council operates a modern, cloud-first estate. The vesting date of October 2026 creates extreme urgency: less than six months from today.

## Councils

| Council | Tier | Key Characteristics |
|---------|------|-------------------|
| Greyminster Borough Council | District | Financially distressed; fully legacy on-prem estate; 7 of 8 contracts expired or expiring imminently |
| Westhaven District Council | District | Financially stable; fully cloud-based estate; modern vendors; contracts through 2028-2030 |

## Transition Structure

- **Vesting Date**: 2026-10-01
- **Successors**:
  - West Greyminster Council — full predecessor: Greyminster Borough Council + Westhaven District Council

## What This Scenario Demonstrates

- The contrast between a distressed legacy estate and a healthy cloud estate — every function row shows a stark technology divide
- Urgency created by the vesting date: October 2026 is fewer than 6 months away, meaning the notice period action zones on many Greyminster systems have already passed or are in the immediate action window
- Greyminster's Oracle Financials ERP (legacy, monolithic, low portability) with a 9-month notice period and a June 2025 expiry — the contract is already lapsed, creating commercial and legal risk
- Capita dominates the Greyminster estate with 4 systems — all legacy on-prem and low portability, meaning data extraction is a core workstream
- Westhaven's Workday HCM and MRI Housing represent the target architecture standard — the successor will almost certainly default to these
- The financial distress flag on Greyminster changes the framing: budget for migration and new licences must come from Westhaven's reserves or central intervention
- Every function has a two-way collision — simple to baseline but the risk divergence between the two councils is as extreme as any scenario in this portfolio
- Day 1 viability for Greyminster's systems is in question — several contracts have already lapsed and systems may be running without valid support agreements

## Files

- `greyminster-borough.json` — Greyminster Borough Council (8 systems, all legacy on-prem, financialDistress: true)
- `westhaven-district.json` — Westhaven District Council (8 systems, all cloud, modern vendors)
- `transition-config.json` — Transition configuration (vesting 2026-10-01, single successor)

## How to Use

1. Open the LGR Rationalisation Engine in a browser
2. Upload both council JSON files in Stage 1
3. Import `transition-config.json` or manually configure the transition structure
4. Proceed through baselining to the dashboard
5. Explore the analysis from different persona perspectives:
   - **Executive**: The October 2026 vesting is imminent — Greyminster has no viable Day 1 IT estate. The Oracle ERP contract lapsed in mid-2025 and the council is already in an exposed position. Immediate intervention required.
   - **Commercial**: Capita holds 4 systems, NEC holds 2, and Oracle holds 2 on the Greyminster side — all expired or near-expired. These are not renewal negotiations; they are emergency exits. Westhaven's contracts provide the target state but novation or new licences will be needed.
   - **Architect**: Every Greyminster system is monolithic and low portability. Data migration from legacy platforms (Capita Housing, Oracle Financials) into Westhaven equivalents (MRI Housing, Xero) is the critical path. None of the Greyminster systems are suitable as anchor systems for the successor authority.
