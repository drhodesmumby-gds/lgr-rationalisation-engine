# Team Protocol — LGR Rationalisation Engine

## Architecture

Multi-agent team following the Planner → Generator → Evaluator model from
[Anthropic's harness design for long-running apps](https://www.anthropic.com/engineering/harness-design-long-running-apps), extended with a Test Writer for property test maintenance and quality testing agents for UX and persona utility audits.

### Agent Roles

| Agent | Responsibility | Model | Key Tools |
|---|---|---|---|
| **Planner** | Gap analysis, sprint planning, acceptance criteria | Opus | Read, Grep, Write (sprint contracts) |
| **Generator** | Feature implementation, self-testing | Sonnet/Opus | Edit, Bash (npm test), Write |
| **Evaluator** | Quality verification, browser testing, grading | Sonnet | Bash (npm test), Playwright MCP |
| **Test Writer** | Property test expansion and maintenance | Sonnet | Read, Grep, Bash (npm test), Write |
| **UX Auditor** | GOV.UK Design System compliance, UX quality, accessibility | Sonnet | Read, Playwright MCP, Write |
| **Persona Tester** | Utility testing from a specific persona perspective | Opus | Read, Playwright MCP, Write |

### Team Lead (You)

The human operator (or the parent Claude session) acts as team lead:
- Approves sprint contracts before implementation begins
- Reviews evaluation reports
- Resolves disputes between agents
- Decides when to proceed to the next sprint

## Coordination Protocol

### Sprint Lifecycle

```
1. PLAN    → Planner writes sprint contract
2. REVIEW  → Team lead approves contract (or requests changes)
3. BUILD   → Generator implements the feature
4. TEST    → Evaluator verifies against acceptance criteria
5. ITERATE → If NEEDS REVISION, Generator fixes bugs and Evaluator re-tests
6. SHIP    → Evaluation PASS → sprint complete
7. TESTS   → Test Writer adds/updates property tests for new/modified pure functions
```

**Step 7 (TESTS)** runs after the sprint ships. The Test Writer reads the sprint contract to understand what changed, identifies new/modified pure functions, and writes property tests. This can run in parallel with the next sprint's PLAN phase since it only touches `tests/` files, not `lgr-rationalisation-engine.html`.

### File-Based Communication

All artifacts live in `.claude/sprints/sprint-{N}/`:

| File | Written by | Purpose |
|---|---|---|
| `contract.md` | Planner | Sprint scope, acceptance criteria, test plan |
| `status.md` | Any agent | **Persistent state tracker** — survives session crashes |
| `evaluation.md` | Evaluator | Test results, grades, bug reports |
| `notes.md` | Any agent | Observations, decisions, context for future sprints |

### Sprint Status File (Crash Recovery)

Each sprint has a `status.md` that agents update as they work. This is the **primary resumption mechanism** — if a session times out or crashes, a new session reads this file to understand exactly where things stand.

Agents MUST update `status.md` at every phase transition and before/after significant edits.

Format:

```markdown
# Sprint {N} Status

## Current Phase
BUILD | TEST | ITERATE | COMPLETE

## Last Updated
{ISO timestamp}

## Agent
{Which agent was working: planner / generator / evaluator}

## Progress
- [x] {Completed step}
- [x] {Completed step}
- [ ] {Next step — where to resume}
- [ ] {Remaining step}

## State of lgr-rationalisation-engine.html
{Brief description: clean / mid-edit / known broken state}
{If mid-edit: what was being changed and what remains}

## Test Baseline
{Last known `npm test` result: X passed, Y failed}

## Resumption Instructions
{What a freshly-spawned agent should do first to pick up this sprint}
```

### Sprint Contract Negotiation

Before implementation begins, the Evaluator reviews the Planner's contract:
- Are acceptance criteria testable?
- Is test coverage adequate?
- Are edge cases from red-team.md considered?

If the Evaluator flags issues, the Planner revises before the Generator starts.

## Quality Gates

A sprint passes when:
1. All existing property tests pass (`npm test`)
2. All acceptance criteria verified PASS by Evaluator
3. No Critical or Major bugs open
4. Grades average >= 3/5 across all dimensions
5. No regressions in existing functionality

## Context Management

The key advantage of this model over single-agent sessions:
- Each agent has a **focused context window** — no bloat from irrelevant history
- Sprint contracts serve as **compressed context** — the Generator doesn't need the full spec, just the contract
- File-based handoffs survive session boundaries — work can resume after interruptions
- The Evaluator catches drift that a self-evaluating agent would miss

## Starting a Sprint

To launch a sprint, the team lead runs:

```
1. Spawn planner agent → produces sprint contract + initial status.md
2. Review and approve the contract
3. Spawn generator agent → implements the feature (updates status.md throughout)
4. Spawn evaluator agent → tests the implementation (updates status.md throughout)
5. If NEEDS REVISION → message generator with bugs → repeat 3-4
6. If PASS → sprint complete
```

## Resuming After a Crash / Timeout

If a session dies mid-sprint:

```
1. Read .claude/sprints/sprint-{N}/status.md to understand current state
2. Check the phase:
   - PLAN   → re-spawn planner to finish the contract
   - BUILD  → re-spawn generator; it reads status.md and resumes from last checkpoint
   - TEST   → re-spawn evaluator; it reads status.md and resumes from last tested criterion
   - ITERATE → re-spawn generator with the evaluator's bug report
3. The agent reads status.md FIRST, not the full conversation history
4. No context is lost — the sprint contract + status file contain everything needed
```

The status file is the single source of truth for sprint progress. Agents treat it like a transaction log — write before acting, update after completing.

## Testing Teams

Beyond the core development lifecycle (Plan → Build → Test), two additional agent types exist for qualitative testing:

### UX Audit Team

| Agent | Responsibility | Model |
|---|---|---|
| **UX Auditor** | GOV.UK Design System compliance, general UX quality, accessibility, responsive behaviour | Sonnet |

The UX Auditor operates independently. It reads `GOVUK-DESIGN-SYSTEM-REFERENCE.md` as its compliance baseline and tests the application through Playwright. Output goes to `.claude/audits/ux-audit.md`.

**When to run**: After significant UI changes (new views, layout modifications, new components). Can run in parallel with a development sprint's Evaluator phase.

### Persona Utility Testing Team

| Agent | Responsibility | Model |
|---|---|---|
| **Persona Tester (Architect)** | Tests utility from CTO/Enterprise Architect perspective | Opus |
| **Persona Tester (Commercial)** | Tests utility from Commercial/Transition Director perspective | Opus |
| **Persona Tester (Executive)** | Tests utility from Executive/Transition Board perspective | Opus |

All three use the same agent definition (`persona-tester.md`) but are spawned with different persona assignments and agent names. They load example scenarios, switch to their assigned persona, and evaluate whether the tool delivers genuinely actionable insights.

Output goes to `.claude/audits/persona-{name}-audit.md`.

**When to run**: After significant analysis/signal changes, new persona features, or dashboard modifications. All three can run in parallel since they test different personas. Can also run in parallel with a development sprint if the sprint doesn't touch analysis logic.

### Coordination Between Testing and Development

```
Development Sprint                 Testing (parallel if no conflicts)
──────────────────                 ──────────────────────────────────
PLAN  → sprint contract
REVIEW → approve contract
BUILD  → implement feature    ──→  UX Auditor (if UI sprint)
TEST   → evaluator verifies   ──→  Persona Testers (if analysis sprint)
SHIP   → sprint complete
                               ──→  Testing reports inform next sprint's Planner
```

Testing outputs (gap reports, recommendations) feed back into the Planner's gap analysis for subsequent sprints. The Planner should read `.claude/audits/` before planning a new sprint.

### Running Testing Teams

To run a UX audit:
```
1. Spawn ux-auditor agent
2. It operates autonomously — no input needed beyond the task assignment
3. Review the audit report at .claude/audits/ux-audit.md
```

To run persona testing (all three in parallel):
```
1. Create a team with TaskCreate for the testing scope
2. Spawn 3 persona-tester agents with names: persona-architect, persona-commercial, persona-executive
3. Assign each their persona via SendMessage
4. They operate autonomously, testing scenarios and documenting findings
5. Review audit reports at .claude/audits/persona-{name}-audit.md
6. Clean up team when all three complete
```

## Project-Specific Notes

- **Single-file constraint**: `lgr-rationalisation-engine.html` is the only implementation file
- **Existing test suite**: 12+ property tests in `tests/` — these must never regress
- **Sample data**: 10 curated scenarios in `examples/` (01–10), each with council files, transition config, and README. Plus 5 legacy sample files at the repo root.
- **Red team document**: `red-team.md` contains edge cases from real LGR announcements
- **Kiro spec**: `.kiro/specs/lgr-transition-planning/` has authoritative requirements
- **GOV.UK Design System reference**: `GOVUK-DESIGN-SYSTEM-REFERENCE.md` — authoritative reference for visual standards, component usage, and documented deviations
- **Audit output**: `.claude/audits/` directory for UX and persona testing reports
