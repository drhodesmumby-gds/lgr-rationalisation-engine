---
title: Transition Planning
order: 3
section: user-guide
---

# Transition Planning

Transition planning defines *how* predecessor councils will reorganise into successor authorities. This configuration determines what the analysis shows you: which systems are allocated to which new authority, where disaggregation is needed, and what the rationalisation patterns look like.

## What transition structure means

A transition structure captures three things:

1. **Successor authorities** - the new unitary authorities that will come into existence on vesting day
2. **Predecessor assignments** - which existing councils feed into which successor
3. **Vesting date** - the legal date the new authorities come into being

Without a transition structure, the engine operates in Discovery mode (a flat comparison across councils). With one, it operates in Transition mode (successor-oriented analysis with rationalisation patterns).

## Full vs partial predecessors

Each predecessor council is assigned to a successor as either **full** or **partial**:

### Full predecessor

The council's entire IT estate transfers to one successor authority. All systems, contracts, and data from that council are allocated to that single successor.

**Example:** Braintree District Council is a full predecessor of North Essex Unitary - every Braintree system goes to North Essex.

### Partial predecessor

The council's estate must be split across multiple successor authorities. This triggers **disaggregation** analysis - the engine identifies which systems must be partitioned and flags the data extraction complexity.

**Example:** Essex County Council is a partial predecessor of both North Essex Unitary and South Essex Unitary. County-wide systems (like the social care platform) need data to be split between the two new authorities.

> **Note:** Partial predecessors create the most complex rationalisation scenarios. A system from a partial predecessor that serves a function also served by systems from full predecessors results in the "Extract, partition and consolidate" pattern - requiring both data disaggregation and system consolidation.

## Discovery mode vs Transition mode

| Aspect | Discovery mode | Transition mode |
|--------|---------------|-----------------|
| **Purpose** | Cross-council estate comparison | Successor-oriented rationalisation planning |
| **Matrix columns** | One per predecessor council | One per successor authority |
| **Rationalisation patterns** | Not shown | Shown (inherit, consolidate, extract, etc.) |
| **Contract timeline** | Fixed date range | Centred on vesting date with notice zones |
| **Perspective filtering** | By predecessor council | By successor authority |
| **Simulation** | Not available | Full decision modelling |

**Discovery mode** is useful for:
- Early-stage exploration before successor boundaries are decided
- Cross-council comparison to understand the combined estate
- Identifying potential shared service overlaps

**Transition mode** is useful for:
- Active transition planning with defined successor authorities
- Rationalisation decision-making per function per successor
- Contract urgency assessment relative to vesting day
- Simulation of consolidation and decommissioning decisions

## How to configure the transition structure

### Manual entry

At Stage 1.5, the Transition Structure panel lets you:

1. **Set the vesting date** using the date picker
2. **Add successor authorities** by clicking "Add Successor" and entering a name
3. **Assign predecessors** - for each successor, select which uploaded councils are full predecessors and which are partial
4. **Validate** - the engine checks that every council is assigned to at least one successor and that partial predecessors appear in multiple successors

### Upload a transition configuration file

If you have a transition configuration JSON file, you can:

- **Upload it alongside architecture files at Stage 1** - the engine auto-detects it (files with a `successors` array but no `nodes` array are classified as transition configs)
- **Import it at Stage 1.5** using the "Import Configuration" button

### Auto-detect from architecture data

Click **"Detect from architecture"** to have the engine scan your uploaded files for `targetAuthorities` fields on systems. If systems have been pre-allocated to named successor authorities, the engine infers the full transition structure automatically.

### Export for sharing

Click **"Export Configuration"** to download your transition structure as a JSON file. Share this with colleagues so they can load the same structure without re-entering it.

## Estate Discovery mode

If you skip Stage 1.5 (by clicking "Skip to baselining"), the engine enters **Estate Discovery mode**. This is not a lesser mode - it serves a different purpose:

- See which functions overlap across councils
- Identify where the same vendor appears in multiple councils
- Spot shared services and potential consolidation candidates
- Review contract timelines across the combined estate

Discovery mode gives you the analytical foundation to *inform* transition structure decisions before committing to specific successor boundaries.

## Tips for transition configuration

- **Start with the official structural proposal** - use the successor names and predecessor assignments from your LGR implementation plan
- **Full vs partial is a modelling choice** - consider which councils' estates transfer entirely to one successor (full) versus those whose services split across multiple successors (partial)
- **Review partial predecessors carefully** - every system from a partial predecessor triggers disaggregation analysis, even if some systems are clearly single-successor in practice (use `targetAuthorities` to override)
