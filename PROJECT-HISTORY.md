# Project History — LGR Rationalisation Engine

This document records the development history of the LGR Rationalisation Engine: the tools used, the transitions between them, the design decisions made, and the rationale behind choices that might otherwise appear inconsistent in the codebase. It is intended to provide context for future contributors (human or AI) who encounter the project and wonder why things are the way they are.

---

## Phase 1: Gemini Canvas — Concept Discovery (April 2026)

### Context

The project originated from work on the Local Government Architecture Model (LGAM), exploring how architecture data could be defined as a JSON schema and interrogated semantically — understanding how layers and nodes interact across organisational boundaries.

This led to a broader exploration using Google Gemini Canvas, generating single-page application prototypes for various architecture frameworks: Wardley mapping, TOGAF templating, ArchiMate modelling with plateau views across multiple local authorities. Most of these were generic and unconvincing — they demonstrated standard architecture visualisation without addressing the specific operational problem that LGR creates.

### The Breakthrough Prompt

The concept crystallised when the framing shifted from general architecture tooling to the specific LGR problem:

> "No, I still can't see how this could be turned into any universal or scalable tooling to assist in LGR. Even if two councils have already completed their internal architecture mapping, they would then have to load the data in and do a lot of manual mapping, all to not tell them much new — they already *know* SaaS or cloud is generally superior to on-prem for example; the question is how do they best handle the restructure and rearchitecture when they are likely splitting and merging the same functions across various new and existing bodies and doing so in the context of inconsistent data portability and contractual obligations with existing vendors."

This reframing — from "what does the architecture look like?" to "what decisions need to be made when councils merge?" — produced the first version of the rationalisation engine.

### Output

A basic single-page HTML application demonstrating the core concept: upload council architecture data as JSON, render a matrix view showing function-level collisions across councils. The schema was simple, the analysis was limited, but the concept — reconciling multiple councils' IT estates against a shared function taxonomy to surface rationalisation decisions — was validated.

### Why it's a single HTML file

Gemini Canvas produces single-file applications by design. This constraint carried forward through every subsequent phase and became a deliberate architectural choice: zero dependencies, no build step, opens in any browser. For a tool targeting local government programme teams who may not have development environments, this is a feature, not a limitation.

---

## Phase 2: Kiro — Specification-Driven Development (April 2026)

### Context

Following the AI Engineering Lab hackathon, where a Kiro licence was provided, the project moved to Amazon's Kiro IDE to explore its Specification-Driven Development (SDD) approach. The appeal was structural: formal requirements with acceptance criteria, a design document with correctness properties, and a task list with implementation phases. This addressed a genuine concern about AI hallucination and misinterpretation — the structured specification would serve as a contract between the human and the AI agent.

### What Kiro produced

Kiro generated comprehensive technical specifications (now archived in `.kiro/archive/`):

- **11 formal requirements** with SHALL-style acceptance criteria covering the full transition planning feature set
- **A detailed design document** with Mermaid architecture diagrams, data models, component interfaces, and 12 formally stated correctness properties
- **An implementation plan** with ~50 tasks across 5 phases

The specifications were technically rigorous. The correctness properties in particular proved valuable — they directly informed the property-based test suite that was later built under Claude Code.

### Limitations

The requirements were well-structured from a technical perspective but did not describe user value. They specified *what the system shall do* without grounding it in *why that matters to the person using it* — the difference between "THE Engine SHALL classify each function cell into one of four Rationalisation Patterns" and "a CTO looking at this screen needs to immediately understand whether they're dealing with a clean inheritance, a consolidation decision, or a data extraction problem."

This gap between technical completeness and user-centred framing became a recurring theme — the tool needed to reduce cognitive load and surface actionable decisions, not just present classified data.

### Legacy in the codebase

- The `.kiro/` directory structure remains (with specs archived to `.kiro/archive/`)
- The project folder name (`rationalisation-engine-kiro`) reflects this phase
- The correctness properties from `design.md` directly map to the 12 property-based tests in `tests/properties/`
- The 5-phase implementation sequence from `tasks.md` explains the ordering of functions in the codebase

---

## Phase 3: Claude Code — Multi-Agent Development (April 2026–present)

### Context

A Claude Code licence was obtained the day before the Kiro phase, and after experiencing Kiro's limitations, the project moved to Claude Code to continue development.

### Early work: Single-agent sessions

The initial Claude Code work involved single-agent sessions implementing features from the Kiro specification. This approach hit scaling problems:

- **Context window bloat**: The single HTML file (~4,500 lines) consumed significant context, leaving insufficient room for the specification, test results, and iterative debugging
- **Session timeouts**: Complex features couldn't be completed in a single session, and resumption lost context
- **Self-evaluation drift**: A single agent implementing and evaluating its own work missed regressions

### The multi-agent shift

The project adopted a three-agent team model (inspired by [Anthropic's harness design for long-running apps](https://www.anthropic.com/engineering/harness-design-long-running-apps)):

| Agent | Model | Role |
|---|---|---|
| **Planner** | Opus | Gap analysis, sprint planning, acceptance criteria |
| **Generator** | Sonnet/Opus | Feature implementation within the single-file constraint |
| **Evaluator** | Sonnet | Quality verification via property tests and browser testing |

This separation addressed all three problems: each agent has a focused context window, sprint contracts survive session boundaries via file-based handoffs, and the Evaluator catches drift that a self-evaluating agent would miss.

Sprint artifacts live in `.claude/sprints/sprint-{N}/` with crash-recoverable status files — if a session dies mid-sprint, a new agent reads `status.md` and resumes from the last checkpoint.

### Sprint history

| Sprint | Focus | Key outcome |
|---|---|---|
| 1 | Transition structure + successor allocation | Stage 1.5 UI, `buildSuccessorAllocation()`, vesting zone classification |
| 2 | Playbook tiering + rationalisation patterns | `DEFAULT_TIER_MAP`, tier promotion, 4-pattern classification |
| 3 | TCoP signal + shared service detection | `computeTcopAssessment()`, `detectSharedServiceBoundary()`, signal emphasis rules |
| 4 | Disaggregation flags + estate summary | `computeEstateSummaryMetrics()`, financial distress, council tier metadata |
| 5 | Architecture editor | Full-screen visual editor with 4 tabs (Council Info, Functions, IT Systems, Edges) |
| 6 | Enhanced dashboard rendering | Critical path panel, analysis detail modal, persona questions, help system |
| 7 | Example scenarios + documentation | 10 curated scenarios, README/TECHNICAL-ARCHITECTURE/STAKEHOLDER-INTRODUCTION/ROADMAP |
| 8 | GOV.UK Design System reference | 4,054-line comprehensive reference document, 3 independent verification passes |

### Evolution of the agent team

The initial three-agent team proved insufficient as the project matured. After Sprint 8, three new agent types were defined:

| Agent | Model | Role |
|---|---|---|
| **Test Writer** | Sonnet | Expands the property test suite for new/modified pure functions |
| **UX Auditor** | Sonnet | Tests GOV.UK Design System compliance, accessibility, responsive behaviour |
| **Persona Tester** | Opus | Evaluates whether the tool provides genuinely actionable insights per persona |

The Test Writer was motivated by test debt: 12 property tests covered the functions from the original Kiro specification, but functions added in later sprints (particularly `computeSignals`, `computeVendorDensityMetrics`, `generatePersonaQuestions`) had no coverage. The Generator's job was already demanding enough without also writing good property tests.

The UX Auditor and Persona Testers address a different gap: the tool had been functionally tested (does the code work?) but never qualitatively tested (does it look right? does it actually help someone make decisions?).

---

## Design Decisions and Their Rationale

### Why Tailwind CSS instead of GOV.UK Frontend

The application uses Tailwind CSS via CDN with custom CSS properties approximating the GOV.UK colour palette. This is a documented deviation from the GOV.UK Design System. The rationale:

- GOV.UK Frontend requires a Node.js build pipeline (Sass compilation, asset pipeline) — incompatible with the single-file, zero-dependency constraint
- The application is an internal analytical tool, not a public-facing government service — strict GDS compliance is aspirational, not mandatory
- Tailwind's utility classes map reasonably well to GDS spacing and layout patterns
- The `GOVUK-DESIGN-SYSTEM-REFERENCE.md` now documents the full Design System as a target standard, with a deviation log tracking where and why the application diverges

### Why property-based tests instead of unit tests

The Kiro design document defined 12 formal correctness properties (e.g., "for any estate with a transition structure, a full predecessor's systems appear in exactly one successor"). These naturally map to property-based tests with fast-check, which generates random inputs and verifies invariants hold universally — a stronger guarantee than example-based tests.

The test harness (`tests/helpers/extract.js`) extracts functions from the HTML file's `<script>` block into a V8 sandbox, allowing pure functions to be tested in isolation without a browser environment.

### Why personas instead of a single view

The tool serves three distinct roles with different information needs:

- **Executive/Transition Board**: "What decisions do I need to make before vesting day?" — needs urgency, critical path, headline risk
- **Commercial/Transition Director**: "What's my contract exposure and procurement strategy?" — needs notice periods, vendor density, spend
- **Enterprise Architect/CTO**: "What are the technical risks and migration dependencies?" — needs data architecture, TCoP compliance, system quality

A single view either overwhelms with information or omits what a specific role needs. The persona system adjusts signal weights, visibility of panels (e.g., critical path is Executive-only, timeline is hidden for Architect), and the framing of generated questions.

### Why neutral posture (no prescriptive recommendations)

The tool surfaces signals and observations but never tells users which system to choose. This is deliberate:

- LGR decisions involve political, financial, operational, and human factors that no tool can fully model
- Prescriptive recommendations create liability and false confidence
- The value is in reducing cognitive load (synthesising 75 systems into a prioritised view) and framing decisions (what needs to happen before vesting?), not in making the decision itself

### Why the ESD Function Taxonomy

The 176-entry LGA/ESD Standard Function Taxonomy provides a shared vocabulary for reconciling services across councils. Without it, "Adult Social Care" in one council and "Adult Services" in another appear as different functions. The `lgaFunctionId` field on Function nodes is the join key that enables cross-council collision detection.

---

## Known Inconsistencies

These are artifacts of the multi-tool development history:

| Inconsistency | Explanation |
|---|---|
| Project folder named `rationalisation-engine-kiro` | Named during the Kiro phase. Renaming would break local paths and references. |
| `.kiro/` directory with archived specs | Historical artifacts from the Kiro SDD phase, preserved for reference. Living documentation is in `CLAUDE.md` and `TECHNICAL-ARCHITECTURE.md`. |
| Incorrect GOV.UK colour values in some CSS custom properties | All development occurred post-v6.1.0 (April 2026), but AI coding tools consistently hallucinate older Design System colour values (pre-brand-refresh v5.x hex codes). This was caught and corrected in the `GOVUK-DESIGN-SYSTEM-REFERENCE.md` verification passes; the application's Tailwind approximations may still carry some stale values. The deviation log in the reference document tracks the correct v6.1.0 palette. |
| `PLAN.md` alongside sprint contracts | `PLAN.md` was the original implementation plan from the red-team analysis. Sprint contracts in `.claude/sprints/` superseded it for execution, but `PLAN.md` retains value as the strategic rationale. |
| Mixed test coverage | The 12 original property tests cover functions specified in the Kiro design document. Functions added in later sprints (computeSignals, generatePersonaQuestions, etc.) lack tests — a debt paydown is planned. |
| `red-team.md` (84KB) | A comprehensive red-team analysis testing the tool concept against real announced reorganisations (Essex, Surrey, Norfolk, Hampshire). Written before implementation; some of its recommendations are now built, others remain on the roadmap. |

---

## Personal Reflections

*[This section is reserved for the author's personal reflections on the development journey — learnings about AI-assisted development, the role of domain expertise alongside AI tooling, when AI helps versus hinders, and observations from working across three different AI development environments in rapid succession.]*

---

## Timeline Summary

```
April 2026 (early)    Gemini Canvas — concept prototyping
                      ├── LGAM graph exploration
                      ├── Architecture framework canvases (Wardley, TOGAF, ArchiMate)
                      └── LGR rationalisation concept validated

April 2026 (mid)      Kiro — specification-driven development
                      ├── AI Engineering Lab hackathon
                      ├── 11 requirements, design document, 12 correctness properties
                      └── Technical specs strong, user-value framing weak

April 2026 (mid-late) Claude Code — multi-agent development
                      ├── Single-agent sessions → context bloat, timeouts
                      ├── Multi-agent team (Planner/Generator/Evaluator)
                      ├── 8 sprints: transition planning → tiering → signals →
                      │   disaggregation → editor → dashboard → scenarios → design ref
                      ├── GOV.UK Design System reference (4,054 lines, 3 verification passes)
                      └── Agent team expanded: Test Writer, UX Auditor, Persona Tester

April 2026 (current)  Consolidation
                      ├── Kiro specs archived with rationale
                      ├── Test debt paydown planned
                      ├── Git repository initialisation pending
                      └── UX audit and persona utility testing defined
```
