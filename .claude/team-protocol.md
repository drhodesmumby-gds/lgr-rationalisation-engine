# Team Protocol — LGR Rationalisation Engine

## Architecture

Multi-agent team following a **hub-and-spoke model**: the team lead (parent Claude session) orchestrates all work, and agents communicate exclusively with the team lead — never with each other.

### Team Lead

The parent Claude session (Opus) acts as team lead:
- Receives user requests and decides scope
- Delegates complex design work to the Planner agent (to minimise context usage)
- Spawns Generator and Evaluator agents sequentially
- Reviews results and manages iteration
- Triggers quality testing after sprints ship
- **Does NOT write code directly** — delegates all implementation to agents

### Agent Inventory

| Agent | Role | Model | When to spawn |
|---|---|---|---|
| **Planner** | Designs implementation approaches | Opus | Complex features requiring codebase exploration |
| **Generator** | Writes code | Sonnet | Every sprint — implements the plan |
| **Evaluator** | Verifies quality via browser + tests | Sonnet | Every sprint — after Generator finishes |
| **Test Writer** | Expands property test suite | Sonnet | After sprints adding new pure functions |
| **UX Auditor** | GOV.UK compliance + UX quality | Sonnet | After UI-heavy sprints |
| **Persona Tester** | Tests utility for a specific role | Opus | After analysis/signal sprints |

## Sprint Workflow

```
1. DESIGN   → Spawn Planner for complex work (or team lead uses plan mode for simple tasks)
2. REVIEW   → Team lead reviews plan, approves or adjusts
3. BUILD    → TeamCreate → spawn Generator (isolation: "worktree", mode: "bypassPermissions")
4. TEST     → Spawn Evaluator (mode: "bypassPermissions") to verify in browser
5. ITERATE  → If issues: team lead relays bugs to Generator → re-test
6. SHIP     → Team lead commits, cleans up core team (TeamDelete)
7. QUALITY  → Team lead triggers quality agents (see below)
```

### Step 7: Quality Testing

After a sprint ships, the team lead assesses what changed and spawns the appropriate quality agents:

| What changed | Agent(s) to spawn |
|---|---|
| UI layout, components, modals, visual design | **UX Auditor** |
| Analysis logic, signals, persona views, dashboard | **Persona Testers** (up to 3 in parallel, one per persona) |
| New/modified pure functions in `src/` | **Test Writer** |
| Multiple of the above | Spawn applicable agents in parallel |

Quality agents run independently against the committed code on the main branch. Their output:
- UX Auditor → `.claude/audits/ux-audit.md`
- Persona Testers → `.claude/audits/persona-{name}-audit.md`
- Test Writer → new/updated files in `tests/properties/`

**The team lead should proactively trigger quality testing** after every sprint — not wait for the user to request it.

Findings from quality testing feed into the next sprint's planning. The Planner should read `.claude/audits/` before designing a new sprint.

## Communication Model

**Hub-and-spoke through the team lead.** Agents NEVER message each other.

```
                    ┌──────────┐
                    │ Team Lead│
                    └────┬─────┘
           ┌─────────┬──┴──┬─────────┐
           │         │     │         │
       ┌───┴───┐ ┌───┴──┐ ┌┴────┐ ┌──┴───┐
       │Planner│ │Gener.│ │Eval.│ │Quality│
       └───────┘ └──────┘ └─────┘ └──────┘
```

- Team lead provides **complete context** in spawn prompts — agents don't share conversation history
- Agents send completion summaries / reports back to the team lead
- The team lead relays bugs, follow-ups, or iteration requests between agents
- If an agent needs information from another agent's work, the team lead provides it in the spawn prompt

## Worktree Isolation

- **Generator** works in an isolated git worktree (`isolation: "worktree"`). Changes are committed in the worktree and merged to the main branch by the team lead.
- **Evaluator** tests against the main branch (after Generator's changes are merged or in the main worktree).
- **Quality agents** test against the committed main branch.

## Architecture

The project uses **modular ES modules** under `src/`, bundled by esbuild into a single HTML file.

- **Source**: `src/` — ES modules (main.js, state.js, features/, simulation/, analysis/, constants/)
- **Build**: `node build.js` → `lgr-rationalisation-engine.html`
- **Tests**: `npm test` — vitest + fast-check property tests in `tests/`
- **Serve for browser testing**: `python3 -m http.server 8765` from repo root, navigate to `http://localhost:8765/lgr-rationalisation-engine.html`

## Crash Recovery

If a session dies mid-sprint, the team lead reads:
1. Git status — what's committed, what's in progress
2. `.claude/sprints/sprint-{N}/status.md` — if the sprint used file-based status tracking
3. Team task list — via `TaskList`

Then re-spawns the appropriate agent with context about where things stand.

## Project Context

- **Sample data**: 10 curated scenarios in `examples/` (01–10) + 5 legacy samples in `examples/00-legacy-samples/`
- **Design reference**: `GOVUK-DESIGN-SYSTEM-REFERENCE.md`
- **Edge cases**: `red-team.md` (84KB)
- **Spec**: `.kiro/specs/lgr-transition-planning/`
- **Historical sprints**: `.claude/sprints/` (gitignored, local only)
- **Audit output**: `.claude/audits/`
