---
title: Overview
order: 1
section:
---

# LGR Rationalisation Engine

The LGR Rationalisation Engine helps UK local government teams plan IT system consolidation during Local Government Reorganisation (LGR) - when multiple councils merge into new unitary authorities.

## What this tool does

When councils merge, their IT estates must be rationalised. Each predecessor council brings its own systems for finance, planning, waste, benefits, social care, and more. The successor unitary authority cannot run all of them indefinitely - decisions must be made about which systems to keep, consolidate, decommission, or replace.

This tool provides a structured analytical framework for those decisions. It takes architecture data from multiple councils, aligns it to a standard function taxonomy, and surfaces the signals that drive rationalisation decisions - contract urgency, data complexity, vendor density, shared services, and more.

## Who it's for

The tool serves three personas, each with different information needs:

- **Executive / Transition Board** - High-level estate overview, critical path decisions, cost exposure, Day 1 readiness
- **Commercial / Transition Director** - Contract timelines, notice periods, vendor relationships, procurement strategy
- **Enterprise Architect / CTO** - Technical debt, data portability, system dependencies, TCoP alignment, migration complexity

## How it works

The tool operates as a four-stage pipeline:

1. **Ingest** - Upload council architecture data (JSON files or Excel templates). Edit and enrich using the built-in architecture editor.
2. **Transition Structure** - Define which councils merge into which successor authorities, with vesting date.
3. **Baselining** - The engine aligns all systems to the ESD function taxonomy and identifies cross-council collisions.
4. **Dashboard** - An analytical matrix surfaces signals, rationalisation patterns, and decision points per function.

Beyond the dashboard, a **simulation mode** lets teams make and track decisions - choosing systems, decommissioning others, deferring complex decisions - with automatic generation of obligations (migrations, governance actions, capability gaps).

## Documentation structure

This documentation is split into two tracks:

### User Guide

For teams using the tool to plan their LGR transition:

- [Getting Started](user-guide/getting-started.html) - Preparing data and uploading
- [Architecture Editor](user-guide/architecture-editor.html) - Editing system data in Focus and Bulk modes
- [Transition Planning](user-guide/transition-planning.html) - Configuring successors and modes
- [Signals & Analysis](user-guide/signals-analysis.html) - Understanding the dashboard
- [Simulation](user-guide/simulation.html) - Making and tracking decisions
- [Data Format](user-guide/data-format.html) - JSON schema reference with examples

### Technical Reference

For developers extending or maintaining the tool:

- [Architecture](technical/architecture.html) - Module structure and data flow
- [Signals System](technical/signals-system.html) - How signals are computed
- [Simulation Engine](technical/simulation-engine.html) - Decision pipeline and obligations
- [Build System](technical/build-system.html) - Building, testing, extending
- [Editor Internals](technical/editor-internals.html) - Unified editor architecture
