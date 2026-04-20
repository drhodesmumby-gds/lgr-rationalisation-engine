# Scenario 7: Cloud-First Modernisation vs Legacy Entrenchment

Two-Council Merger with Maximum Technology Contrast — a cloud-native district merges with a legacy on-premises borough. Every function maps to a direct cloud vs legacy collision, making this the most analytically stark scenario in the portfolio for surfacing portability risk, vendor lock-in, and data layer friction.

## Councils

| Council | Tier | Key Characteristics |
|---------|------|-------------------|
| Brightwell District Council | District | Fully cloud, all systems segmented data, all high portability, contracts 2028-2030, modern vendor portfolio (Arcus Global, Access Group, Workday, Jadu, Granicus, MRI Cloud, Xero, Open Objects) |
| Oldcastle Borough Council | District | Fully on-premises, all systems monolithic data, all low portability, long contracts 2030-2032, legacy vendor portfolio (Capita, NEC, Idox, Civica, In-House) |

## Transition Structure

Two districts merge into a single successor unitary authority. Both are full predecessors of the successor — a straightforward two-into-one merger. The complexity comes entirely from the technology contrast, not the structural topology.

- **Vesting Date**: 2027-04-01
- **Successor**: Brightwell and Oldcastle Council (full predecessors: both councils)

## What This Scenario Demonstrates

- Maximum portability contrast: every function has a Brightwell cloud/segmented system versus an Oldcastle on-prem/monolithic system
- Brightwell's systems are natural consolidation targets — high portability, segmented data, open APIs — but Oldcastle's long contracts (2030-2032) create procurement barriers
- Oldcastle's Capita contracts (waste, housing, finance) run to 2031 with 12-month notice periods: commercial lock-in across three functions simultaneously
- NEC HR contract runs to 2032 — the longest-running liability in the portfolio, 5+ years post-vesting
- Executive persona should surface the scale of Oldcastle legacy commitment as a Day 1 and horizon 2 risk
- Commercial persona should flag the Capita triple-contract exposure and the NEC 2032 cliff
- Architect persona should contrast Brightwell's segmented/cloud stack as the target architecture blueprint against Oldcastle's monolithic estate requiring data migration planning before any consolidation
- The In-House Parks system (Oldcastle) is the most exposed: no vendor, low portability, monolithic, contract expiring 2027 — immediately before vesting

## Files

- `brightwell-district.json` — Brightwell District Council: cloud-first portfolio, all high portability, all segmented data
- `oldcastle-borough.json` — Oldcastle Borough Council: legacy on-prem portfolio, all low portability, all monolithic data
- `transition-config.json` — Transition configuration: single successor, both councils as full predecessors

## How to Use

1. Open the LGR Rationalisation Engine in a browser
2. Upload both council JSON files in Stage 1
3. Proceed through baselining to the dashboard
4. Switch to the Architect persona — every row in the matrix should show a green cloud/segmented system alongside a red on-prem/monolithic system
5. Switch to the Commercial persona and review contract end dates — Oldcastle's Capita and NEC contracts represent multi-year post-vesting lock-ins
6. Switch to the Executive persona and note the Oldcastle In-House Parks system as the most urgent pre-vesting procurement action
