# Flagship Demo Scenario

This is the default demo scenario loaded by the "Load Demo" button. It demonstrates a realistic mid-complexity local government reorganisation with multiple decision patterns and signal triggers.

## Scenario Structure

**Predecessors:** 1 county council + 3 district councils (1 county partial, 3 districts full)  
**Successor:** New Unitary Authority  
**Vesting date:** 2027-04-01

The county council's estate spans broader geographic area (7 districts total) but only 3 are included in this new unitary. This creates a realistic **disaggregation scenario** where county enterprise systems must be partitioned to serve both the new unitary and the remaining 4 districts.

## Key Features Demonstrated

### Contract Urgency Signals
- **Overdue notices:** County NEC Revenues (ended 2026-06), District Council 3 Sage Finance (ended 2026-03)
- **Pre-vesting triggers:** District 1 NEC Revenues & Benefits (notice 2026-06), District 3 Planning Register (notice 2027-03)
- **Year-1 successor windows:** Liquidlogic LAS, NEC Housing systems
- **Long-tail strategic decisions:** SAP S/4HANA (notice 2028-09)

### Data Architecture Complexity
- **Monolithic ERP core:** SAP S/4HANA (Finance, HR, Procurement) creates tier-1 consolidation risk
- **Vendor density:** NEC dominance across 4 systems (Revenues, Housing, Planning)
- **Data portability spread:** Mix of Low (monolithic systems), Medium (district mix), and High (cloud platforms)
- **Shared services across programme boundary:** County Confirm Highways shared with District 1, creating cross-successor impact decisions

### Support Model Diversity
- **Vendor-supported:** ERP, commercial platforms (Civica, Microsoft, Capita, Idox, Bartec)
- **Community-supported:** Public Health Intelligence, Koha Library (shared across programme boundary)
- **Unsupported/EOL:** District 3 in-house systems, Sage 50 Finance (motivates lift-and-shift or replacement)
- **In-house cloud:** Public Health Intelligence, Koha (low cost, shared governance)

### Operating Model Patterns

| Pattern | System | Reason |
|---|---|---|
| **Inherit-as-is** | Civica Financials (District 1) | Single cloud system, no competing systems, clean migration |
| **Choose-and-consolidate** | Revenues & Benefits (Districts 1 & 2 vs County absent) | Two competing NEC instances → select one, decommission other, migrate data |
| **Extract-partition-consolidate** | SAP S/4HANA | Core ERP serves multiple functions; county instance must continue serving other 4 districts outside programme; new unitary requires separate Finance/HR/Procurement |
| **Replace unsupported** | District 3 in-house systems | EOL Sage Finance, unsupported in-house planning/waste → lift-and-shift window before vesting |

## Council Profiles

### County Council
- **Tier:** County
- **Financial distress:** No
- **Scale:** 5000 users, £3.9M/yr IT spend
- **Characteristics:** Large enterprise systems, deep vendor relationships, monolithic shared services
- **Key decision:** SAP S/4HANA disaggregation (28-month notice, £2.1M/yr cost)

### District Council 1 (Medium)
- **Tier:** District
- **Financial distress:** No
- **Scale:** 1190 users, £560k/yr IT spend
- **Characteristics:** Modern cloud-first approach, some shared services (Confirm, NEC Revenues)
- **Key decision:** Shared Confirm Highways with county (coordination needed)

### District Council 2 (Smaller)
- **Tier:** District
- **Financial distress:** No
- **Scale:** 538 users, £520k/yr IT spend
- **Characteristics:** NEC-heavy vendor lock-in (Revenues, Housing, Planning)
- **Key decision:** Consolidate NEC estate post-vesting vs. escape proprietary platform

### District Council 3 (Smallest, Distressed)
- **Tier:** District
- **Financial distress:** Yes
- **Scale:** 250 users, £183k/yr IT spend
- **Characteristics:** In-house development, unsupported systems, extreme cost pressure
- **Key decisions:** (1) Sage Finance EOL before vesting, (2) In-house systems lift-and-shift or outsource, (3) Koha library open-source shared service

## Capabilities Modelling

The scenario includes CONSUMES_CAPABILITY edges to demonstrate the capability decision system:

- **SAP S/4HANA provides:** Payments, Workflow (core capabilities)
- **Liquidlogic LAS consumes:** Payments from SAP (dependency)
- **Microsoft Dynamics 365 provides:** Forms (CRM capability)

These model real dependencies: discommissioning SAP breaks Liquidlogic's payment integration, so decisions must consider cross-system blast radius.

## Shared Services Across Programme Boundary

| System | Predecessor 1 | Predecessor 2+ (outside programme) | Impact |
|---|---|---|---|
| Confirm Highways | County | District 1 | Shared vendor instance (tight coupling) |
| Confirm Highways | District 1 | County | Same relationship, both directions |
| Public Health Intelligence | County | 2 other county district programmes | Low-cost open-source, loose coupling |
| Koha Library | District 3 | 2 neighbouring councils | Community open-source, low cost |

## Testing Checklist

**Import & Baseline:**
- [ ] All 4 JSON files import successfully (7 unique functions, 26 systems)
- [ ] Transition config auto-detects and populates successor/predecessor assignments
- [ ] Baseline report shows function distribution, vendor concentration (NEC=4), tier map hits

**Signals & Analysis:**
- [ ] Contract urgency detects OVERDUE (Sage, NEC Revenues county), PRE-VESTING (NEC Revenues districts, Planning), and natural expiries
- [ ] User volume detects anchor systems (SAP=5000 users county)
- [ ] Vendor density highlights NEC (4 systems) and Confirm (shared across boundary)
- [ ] Monolithic data flags SAP, NEC Housing, NEC Planning, NEC Revenues, Sage
- [ ] Tech debt highlights on-prem systems (Confirm, SAP, NEC*, Sage, in-house)
- [ ] Shared service boundary shows Confirm split between county and District 1

**Decision Workflow:**
- [ ] Liquidlogic's dependency on SAP payments is visible in CONSUMES_CAPABILITY graph
- [ ] Deciding to "Decommission SAP" shows cross-successor blast radius if District 3 had SAP (they don't, but Liquidlogic would be affected)
- [ ] "Extract-partition-consolidate" pattern applies to SAP (ERP consolidation, partial predecessor)

**Persona Perspectives:**
- [ ] **Executive:** Sees contract urgency, user volume, shared services, critical path pre-vesting
- [ ] **Commercial:** Sees vendor density (NEC escape?), contract calendar, consolidation cost estimates
- [ ] **CTO:** Sees monolithic data risk, portability constraints, TCoP alignment gaps, on-premise infrastructure burden
