# Scenario 1: Simple Two-District Merger

Two small, modern, cloud-first district councils merging into a single unitary authority. This is the "best case" scenario — both councils have invested in modern, portable systems, and every function has a clean two-way collision with a clear rationalisation decision to make.

## Councils

| Council | Tier | Key Characteristics |
|---------|------|-------------------|
| Thornbury District Council | District | Cloud-first, Civica and Bartec-heavy stack, Xero finance |
| Crestfield District Council | District | Cloud-first, mixed vendor stack including Arcus Global, Jadu, Workday |

## Transition Structure

Both councils merge fully into a single new successor authority.

- **Vesting Date**: 2027-04-01
- **Successors**: Thornbury and Crestfield Council (full predecessors: both councils)

## Features Demonstrated

- Clean two-way function collisions across all 7 shared functions — the engine flags every row as a collision
- Different vendors covering the same function (e.g. Bartec vs Whitespace for waste) — vendor rationalisation decisions
- No ERP complexity, no shared services — a straightforward "pick one" scenario for each function
- Mixed contract end dates between 2026 and 2029 — natural consolidation windows in the timeline
- All systems cloud-hosted with vendor support — no legacy risk or on-premise burden
- GOV.UK Notify integration — demonstrates capability system dependencies (CONSUMES_CAPABILITY edges)
- Electoral system urgency (Thornbury Electoral IQ expiring September 2026) — signals pre-vesting pressure
- Minimal baseline case: useful as an introductory example for training new users

## Files

- `thornbury-district.json` — Thornbury District Council architecture (7 systems, Bartec/Civica/Idox/MHR/Xero)
- `crestfield-district.json` — Crestfield District Council architecture (7 systems, Whitespace/NEC/Arcus Global/Jadu/Access Group/Workday)
- `transition-config.json` — Transition configuration (vesting 2027-04-01, single successor)

## How to Use

1. Open the LGR Rationalisation Engine in a browser
2. Upload `thornbury-district.json` and `crestfield-district.json` in Stage 1
3. Import `transition-config.json` or manually configure the transition structure
4. Proceed through baselining to the dashboard
5. Explore the analysis from different persona perspectives:
   - **Executive**: Review the Day 1 readiness — all contracts are active at vesting, no emergency decisions needed
   - **Commercial**: Compare vendor pairs for each colliding function — this is a clean vendor rationalisation exercise
   - **Architect**: Note the NEC Revenues system (Crestfield) is on-premises — the only legacy flag in an otherwise cloud estate
