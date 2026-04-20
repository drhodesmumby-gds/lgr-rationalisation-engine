# Archived Kiro Specifications

## What these files are

These are the original Specification-Driven Development (SDD) artifacts produced during the project's Kiro IDE phase. They defined the transition planning feature set — requirements, design, and implementation tasks — using Kiro's structured specification workflow.

## Files

| File | Description |
|---|---|
| `requirements.md` | 11 formal requirements with acceptance criteria (SHALL-style) covering transition structure, vesting-anchored analysis, tiering, rationalisation patterns, TCoP, shared services, disaggregation, estate summary, financial distress, council tier metadata, and HTML export |
| `design.md` | Detailed technical design including architecture diagrams (Mermaid), state management, data models, component interfaces, signal system extensions, and 12 formal correctness properties for property-based testing |
| `tasks.md` | Implementation plan with ~50 tasks across 5 phases, all marked complete. Includes test file structure planning |
| `.config.kiro` | Kiro configuration metadata |

## Why they were archived

These specifications were **fully implemented** during Sprints 1–7 (April 2026) under Claude Code's multi-agent team workflow. Every requirement was built, every task was completed, and all 12 correctness properties were verified via property-based tests.

However, significant development continued after the specifications were frozen:

- **Architecture editor** (full-screen visual editor with 4 tabs for council data)
- **Critical path panel** (pre-vesting decision table for the Executive persona)
- **Persona-specific question generation** (`generatePersonaQuestions`)
- **Help system** (documentation modals, help icons, domain term tooltips)
- **Transition config file import/export** and auto-detection at ingest
- **"Detect from architecture" auto-discovery** for transition structures
- **Analysis detail modal** (drill-down per function)
- **Sort and filter controls** (tier, name, collision modes)
- **10 curated example scenarios** in `examples/`
- **GOV.UK Design System reference** (`GOVUK-DESIGN-SYSTEM-REFERENCE.md`, Sprint 8)
- **Expanded agent definitions** (UX auditor, persona tester, test writer)

Maintaining the Kiro specs alongside the evolving codebase would create a dual source-of-truth problem. The project's living references are now:

- **`CLAUDE.md`** — authoritative project reference for AI agents (architecture, state variables, key functions, data formats)
- **`TECHNICAL-ARCHITECTURE.md`** — detailed architecture documentation
- **`.claude/agents/`** — agent definitions for the multi-agent team
- **`.claude/team-protocol.md`** — team coordination protocol
- **`PROJECT-HISTORY.md`** — development history and design decision rationale

## Value as historical artifacts

These specs remain valuable as a record of:

1. **The formal requirements** — the SHALL-style acceptance criteria document the original intent precisely
2. **The correctness properties** — 12 formally stated properties that drove the property-based test design
3. **The design decisions** — signal emphasis rules, rationalisation pattern logic, tier promotion rules, and the dual-mode architecture were all first articulated here
4. **The implementation sequence** — the 5-phase plan (transition structure → tiering + patterns → signals → disaggregation + summary → metadata + export) explains why the code is structured the way it is

## Date archived

2026-04-20
