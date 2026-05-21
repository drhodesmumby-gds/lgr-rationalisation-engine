# Scenario 5: ERP Entanglement Trap

Three-way ERP Capability Entanglement — three councils merging into a single unitary authority, each running a different enterprise ERP system. All three ERPs cover Finance and HR and expose downstream systems through CONSUMES_CAPABILITY edges that reveal hidden dependencies. This demonstrates the blast radius impact when choosing which ERP to retain means migrating all dependent systems off the rejected ERPs.

## Councils

| Council | Tier | Key Characteristics |
|---------|------|-------------------|
| Oakham County Council | County | SAP S/4HANA (anchor ERP, 6000 users, £2.1m/yr, vendor-supported), covers Finance, HR, Procurement, Legal. On-prem, monolithic. Provides payments and workflow capabilities to 3 downstream systems. Contract to 2030. |
| Brackley District Council | District | Oracle E-Business Suite (1200 users, £600k/yr, vendor-supported), covers Finance and HR. On-prem, monolithic. Provides payments to 3 downstream systems. Contract to 2029. |
| Winsford District Council | District | Unit4 Business World (900 users, £450k/yr, vendor-supported), covers Finance and HR. On-prem, monolithic. Provides payments to 3 downstream systems. Contract to 2028. |

## Transition Structure

All three councils merge into a single successor authority.

- **Vesting Date**: 2027-04-01
- **Successors**: Oakham Council (full merger of all three predecessor councils)

## What This Scenario Demonstrates

- **Capability Dependency Chains**: Each ERP exposes `capabilityType: ["payments", "workflow"]`. Multiple downstream systems (waste, benefits, housing, procurement) depend on these capabilities via CONSUMES_CAPABILITY edges. Choosing ERP-A over ERP-B means migrating all downstream systems consuming from the rejected ERP.
- **Support Model Visibility**: All three ERPs marked `vendor-supported` (active SLA, commercial contract). All dependent systems also vendor-supported. This contrasts with scenarios where unsupported legacy systems create tighter coupling.
- Three incompatible ERPs (SAP, Oracle, Unit4, all vendor-supported) all colliding on Finance (116) and HR (119) — maximum ERP conflict density
- SAP as the natural anchor by user count (6000 vs 1200 vs 900) but Unit4 contract expires soonest (2028), creating a sequencing window
- All three ERPs are monolithic data layers — no clean extract path without significant data migration
- SAP's 18-month notice period and 2030 expiry locks in £2.1m/yr spend for the full transition period
- Brackley and Winsford's district-level systems (waste, benefits, planning, housing) are mostly modern and cloud-ready — the ERP pain is concentrated in corporate back-office
- Illustrates the distinction between the corporate ERP problem (complex, expensive, slow) and the district operational systems problem (tractable, faster, cheaper)
- Commercial persona should surface three-ERP vendor consolidation opportunity and £3.15m/yr combined ERP spend — and the hidden cost of re-wiring payment flows
- Architect persona should flag SAP monolith as the primary anchor system, data disaggregation risk, and use the capability blast radius to model rework scope

## Files

- `oakham-county.json` — Oakham County Council: SAP S/4HANA (vendor-supported, payments+workflow capabilities) covering 4 corporate functions, plus Liquidlogic LAS, Confirm highways, Dynamics CRM (with forms), Civica Parking (all consuming from SAP)
- `brackley-district.json` — Brackley District Council: Oracle E-Business Suite (vendor-supported, payments+workflow) plus 7 operational district systems, 3 of which consume Oracle payments capabilities
- `winsford-district.json` — Winsford District Council: Unit4 Business World (vendor-supported, payments+workflow) plus 8 operational district systems including ServiceNow ITSM, 3 of which consume Unit4 payments
- `transition-config.json` — Transition configuration: single successor (Oakham Council), vesting 2027-04-01

## How to Use

1. Open the LGR Rationalisation Engine in a browser
2. Upload all three council JSON files in Stage 1
3. Import the transition config or manually configure the successor as "Oakham Council"
4. Proceed through baselining to the dashboard
5. Use the Commercial persona to review vendor density and capability entanglement — identify the three-ERP collision on Finance and HR, and trace the hidden cost of re-wiring payment flows across dependent systems
6. Use the Architect persona to assess the SAP monolith as anchor system, review data layer risks, and use the CONSUMES_CAPABILITY edges to model the blast radius of each ERP choice
7. Use the Executive persona to understand the Day 1 lock-in implications of three long-running ERP contracts and the cascade migration burden if the "wrong" ERP is chosen
8. Experiment with the Critical Path panel to see how choosing Winsford's Unit4 (expiring 2028) cascades to rework of Winsford's waste, benefits, and housing systems
