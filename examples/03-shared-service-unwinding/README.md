# Scenario 3: Shared Service Partnership Dissolution

Three councils in a shared service arrangement are being split across two different successor authorities. Riverdale and Kingsway currently share three systems (NEC Revenues, MHR iTrent, Civica Elections) — but Riverdale goes to Riverside Council while Kingsway becomes Greater Wolds Council. These shared systems must be unwound, creating procurement complexity and potential service disruption risk.

## Councils

| Council | Tier | Key Characteristics |
|---------|------|-------------------|
| Riverdale Borough Council | District | Part of shared service with Kingsway; merging into Riverside Council |
| Kingsway District Council | District | Part of shared service with Riverdale; forming Greater Wolds Council |
| Stonebridge Borough Council | District | Fully independent systems; also merging into Riverside Council |

## Transition Structure

Two successor authorities are formed from this dissolution:

- **Vesting Date**: 2027-04-01
- **Successors**:
  - Riverside Council — full predecessor: Riverdale Borough Council + Stonebridge Borough Council
  - Greater Wolds Council — full predecessor: Kingsway District Council

## Features Demonstrated

- **Shared service boundary detection**: NEC Revenues, MHR iTrent, and Civica Elections are shared between Riverdale and Kingsway — sharedWith fields highlight the dependency chain
- **Monolithic data risk**: NEC Revenues (monolithic, low portability, on-prem, vendor-supported) splits to different successors — critical separation complexity
- **HR system splitting**: MHR iTrent (monolithic, vendor-supported) is also shared — both councils depend on a single database that must be unwound
- **Vendor support model**: Shared systems are vendor-supported but locked into shared contracts — procurement must decouple agreements post-vesting
- **Contract urgency in split**: Civica Elections (shared, June 2027 end) has tight timeline for separation; NEC notice period is 9 months (action required by June 2026)
- **Clean integration scenario**: Stonebridge brings an independent, cloud-first, entirely vendor-supported estate to Riverside Council — no shared service complications
- **Three-way collisions**: Benefits, waste, planning, housing, elections show 3-council scenarios — simulates real disaggregation complexity
- **Capability chain**: Capita Pay360 and GOV.UK Notify integrate across shared systems — dependencies persist through the transition
- **Asymmetric outcomes**: Riverside gains 2 councils with different support needs; Greater Wolds Council starts isolated post-vesting

## Files

- `riverdale-borough.json` — Riverdale Borough Council (9 systems, includes 3 shared systems with Kingsway)
- `kingsway-district.json` — Kingsway District Council (9 systems, includes 3 shared systems with Riverdale)
- `stonebridge-borough.json` — Stonebridge Borough Council (9 systems, fully independent cloud estate)
- `transition-config.json` — Transition configuration (vesting 2027-04-01, two successors)

## How to Use

1. Open the LGR Rationalisation Engine in a browser
2. Upload all three council JSON files in Stage 1
3. Import `transition-config.json` or manually configure the transition structure
4. Proceed through baselining to the dashboard
5. Explore the analysis from different persona perspectives:
   - **Executive**: The NEC Revenues system (shared, monolithic, low portability, on-prem) going to separate successors is the top Day 1 risk — it needs a separation plan urgently
   - **Commercial**: Three shared contracts must be split or duplicated. NEC Revenues (£300k + £240k combined) and MHR iTrent need separate procurements — significant cost implications
   - **Architect**: Monolithic data partitioning on the shared NEC and MHR systems means data extraction and migration are required before separation — not just a contract split
