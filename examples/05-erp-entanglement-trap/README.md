# Scenario 5: ERP Entanglement Trap

Dual ERP Monolith Collision — three councils merging into a single unitary authority, each running a different enterprise ERP system. All three ERPs cover Finance and HR, creating a three-way monolith collision that represents the worst-case corporate systems consolidation challenge.

## Councils

| Council | Tier | Key Characteristics |
|---------|------|-------------------|
| Oakham County Council | County | SAP S/4HANA (anchor ERP, 6000 users, £2.1m/yr), covers Finance, HR, Procurement, Legal. On-prem, monolithic, contract to 2030. |
| Brackley District Council | District | Oracle E-Business Suite (1200 users, £600k/yr), covers Finance and HR. On-prem, monolithic, contract to 2029. |
| Winsford District Council | District | Unit4 Business World (900 users, £450k/yr), covers Finance and HR. On-prem, monolithic, contract to 2028. |

## Transition Structure

All three councils merge into a single successor authority.

- **Vesting Date**: 2027-04-01
- **Successors**: Oakham Council (full merger of all three predecessor councils)

## What This Scenario Demonstrates

- Three incompatible ERPs (SAP, Oracle, Unit4) all colliding on Finance (116) and HR (119) — maximum ERP conflict density
- SAP as the natural anchor by user count (6000 vs 1200 vs 900) but Unit4 contract expires soonest (2028), creating a sequencing window
- All three ERPs are monolithic data layers — no clean extract path without significant data migration
- SAP's 18-month notice period and 2030 expiry locks in £2.1m/yr spend for the full transition period
- Brackley and Winsford's district-level systems (waste, benefits, planning, housing) are mostly modern and cloud-ready — the ERP pain is concentrated in corporate back-office
- Illustrates the distinction between the corporate ERP problem (complex, expensive, slow) and the district operational systems problem (tractable, faster, cheaper)
- Commercial persona should surface three-ERP vendor consolidation opportunity and £3.15m/yr combined ERP spend
- Architect persona should flag SAP monolith as the primary anchor system and data disaggregation risk

## Files

- `oakham-county.json` — Oakham County Council: SAP S/4HANA covering 4 corporate functions, plus social care, highways, CRM, and parking systems
- `brackley-district.json` — Brackley District Council: Oracle E-Business Suite plus 7 operational district systems
- `winsford-district.json` — Winsford District Council: Unit4 Business World plus 8 operational district systems including ServiceNow ITSM
- `transition-config.json` — Transition configuration: single successor (Oakham Council), vesting 2027-04-01

## How to Use

1. Open the LGR Rationalisation Engine in a browser
2. Upload all three council JSON files in Stage 1
3. Import the transition config or manually configure the successor as "Oakham Council"
4. Proceed through baselining to the dashboard
5. Use the Commercial persona to review vendor density — look for the three-ERP collision on Finance and HR
6. Use the Architect persona to assess the SAP monolith as anchor system and review data layer risks
7. Use the Executive persona to understand the Day 1 lock-in implications of three long-running ERP contracts
