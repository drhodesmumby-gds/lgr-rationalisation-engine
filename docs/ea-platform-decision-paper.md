# Decision Paper: GDS Local Architecture Tooling

**For:** Phil S, Emily, [Requestor]
**From:** Daniel, Phil
**Date:** April 2026
**Status:** Draft for discussion

---

## The question

GDS Local is preparing to tender for an Enterprise Architecture (EA) platform. Separately, an experimental prototype exists (the "LGR Rationalisation Engine") that provides decision-support for technology transition during Local Government Reorganisation. Should the rationalisation engine become part of our official offer, and if so, how? What is the relationship between these two things?

---

## Context

**The EA platform** is an active workstream with user research backing the need. We are preparing for possible tender. It would allow selected councils to map their technical architecture against the LGAM, creating a consistent view of applications, integrations, data, and dependencies.

**The rationalisation engine** is a personal experimental prototype built by Daniel in his own time. It takes structured IT estate data from multiple councils undergoing LGR, reconciles them against a national taxonomy, models transition structures, and presents analysis and simulation of rationalisation decisions. It works today but has had no user research, no accessibility audit, and no official standing.

**The LGAM** (Local Government Architecture Model) is our shared vocabulary — the conceptual model that both tools would use. It's in beta.

---

## How they fit together

We see these as steps in a journey:

```
1. LGAM                    2. EA Platform              3. Rationalisation Engine
(conceptual model)         (mapping tool)              (transition decision support)

Define a shared way     →  Help councils map their  →  Help councils reconcile
to describe council        estate against that          their models when
technology                 model                        reorganising, and model
                                                        the impacts of decisions
```

Each step has standalone value, but the value compounds. Specifically: the EA platform creates the structured data that the rationalisation engine consumes. Without the EA platform, councils must prepare this data manually (weeks of effort per council). With it, they export in minutes.

---

## What the EA platform does

A hosted platform where councils describe their applications, integrations, data, and dependencies in a structured way, using the LGAM vocabulary.

**Value proposition (with or without LGR):**
- Councils gain clarity on what they actually have (many genuinely don't know)
- GDS/MHCLG gains sector-wide visibility ("how do councils do payments?")
- Enables shared service identification and collaboration
- Supports TCoP compliance conversations with evidence
- Creates a lasting, maintained asset

**Value for LGR specifically:**
- Councils entering LGR already have their estate mapped — no scramble
- Structured data feeds directly into rationalisation analysis
- Quality is higher because it's been maintained over time, not assembled under deadline pressure

**Status:** User research done. Preparing for tender. Active workstream.

---

## What the rationalisation engine does

A browser-based tool that takes structured estate data from multiple merging councils, reconciles it against the LGA national ESD function taxonomy, and provides:

- A unified baseline view of the combined estate
- Rationalisation pattern classification per function (inherit / consolidate / extract / extract-and-consolidate)
- 8 configurable analysis signals (contract urgency, data complexity, vendor density, etc.)
- Critical path identification (contracts requiring action before vesting day)
- Disaggregation modelling (when a county must split across successors)
- Simulation engine (make decisions, see projected impact on cost, obligations, timeline)
- Cross-cutting capability platform analysis (payments, identity, forms — blast radius of replacement)
- Three persona views (Executive, Commercial, Architect) with tailored reports

It runs entirely in-browser — zero infrastructure, no server, no hosting. A single HTML file.

**Status:** Working prototype. Built experimentally in personal time. Not user-researched or accessibility-audited. No official standing.

---

## The rationalisation engine: options for its future

### Option 1: GDS Local adopts it officially

We take it on as part of our "Sourcing the Stack" or LGR support offer.

| For | Against |
|---|---|
| Demonstrates we're actively helping councils with LGR technology decisions | Resource to develop and support it properly (not clear we have this) |
| Complements the EA platform — creates demand for structured architecture data | Needs user research, accessibility work, and iteration to be "production" quality |
| Aligns with our playbook guidance (we wrote the advice, now we provide a tool) | Creates an ongoing support expectation |
| Zero infrastructure cost | Risk of taking on a commitment we can't sustain |
| Could position as an extremely lightweight offer: "here's a tool, no warranty, we'd love feedback" | |

**Resource implication:** Could range from "light touch" (publish it, link from the playbook, accept feedback) to "full product" (dedicate developer time, user research, iterate with councils). The light-touch version costs almost nothing beyond Daniel's existing effort.

---

### Option 2: Digital Backbone takes it on

Hand it to the Digital Backbone team to develop further.

| For | Against |
|---|---|
| They have relevant technical expertise | We believe they may be lacking capacity currently |
| Logical home given their infrastructure/platform focus | Handover effort — someone needs to understand the codebase |
| Keeps it in government | Separation from GDS Local's LGAM/EA platform work may create misalignment |

---

### Option 3: Local Digital's LGR team takes it on

Give it to the team directly supporting LGR councils.

| For | Against |
|---|---|
| They're closest to the users who need it | Potential political sensitivities |
| Natural distribution channel (they're already advising councils) | They may not have development capacity |
| Aligns with playbook authorship | Could complicate the EA platform relationship |

---

### Option 4: External body (LGA, Socitm, etc.)

Hand it to an external sector body.

| For | Against |
|---|---|
| Removes maintenance burden from GDS | Scepticism about whether they'd do much with it |
| Could reach councils via existing networks | Risk of commercialisation (conflicts with open/free ethos) |
| | Loss of control over direction and quality |
| | May not invest in further development |

---

### Option 5: Unofficial personal publication

Daniel publishes on his personal GitHub and LinkedIn as "here's an experiment I built in my spare time, no warranty, no government endorsement."

| For | Against |
|---|---|
| Zero cost to GDS Local | No government backing reduces credibility with councils |
| No resource commitment | Cannot be part of the EA platform story |
| Avoids any political or organisational complexity | Relies entirely on one person's continued interest |
| Still useful to councils who find it | No support, no iteration based on user feedback |
| Preserves optionality (can always adopt later) | Missed opportunity to strengthen GDS Local's LGR offer |

---

### Option 6: Do nothing / let it fade

Decide it's not worth pursuing in any form.

| For | Against |
|---|---|
| Zero cost | Councils continue using spreadsheets for LGR technology analysis |
| Avoids overcommitment | Waste of working prototype that addresses a real gap |
| | Playbook recommends structured baselining — we'd have no tool to support it |

---

## Our view

**The most interesting option is a hybrid of 1 and 5** — depending on appetite for risk and commitment:

**Minimum viable approach (low risk, low cost):** Publish it openly (Option 5) but with a light GDS Local acknowledgement: "This experimental tool was developed during GDS Local's research into LGR technology transitions. It is not a supported product. Feedback welcome." This costs nothing, creates no support obligation, but signals we're actively thinking about this space and creates a path toward adoption if demand materialises.

**If there's appetite for more:** Position it as the "analysis layer" that sits downstream of the EA platform (Option 1, light-touch). Councils map their estate in the EA platform → export → load into the rationalisation engine for transition analysis. This makes the EA platform's value proposition stronger ("not only can you map your estate, but when LGR arrives, you can immediately analyse transition options"). The rationalisation engine becomes the EA platform's LGR use case.

---

## The relationship to the EA platform

Regardless of which option we choose for the rationalisation engine, the EA platform decision is independent. The EA platform has its own justification (sector-wide architecture visibility, TCoP support, vendor engagement). The rationalisation engine is one downstream use case, not the primary driver.

However, if we pursue both:

```
EA Platform                         Rationalisation Engine
(lasting asset)                     (LGR-specific tool)

Council maps estate             →   Export to rationalisation engine
using LGAM vocabulary               when LGR announced

Maintained over time            →   Data is ready immediately
(not assembled under                (no weeks of preparation)
deadline pressure)

Value continues after           →   Tool serves its purpose
LGR completes                       during transition, then
                                    data returns to EA platform
                                    as the "new authority" view
```

The EA platform creates the *supply* of structured data. The rationalisation engine creates *demand* for it ("if you'd mapped your estate properly, this analysis would have taken days not months"). LGR is the forcing function that makes adoption of the EA platform urgent and tangible.

---

## Questions for discussion

1. **How much resource are we willing to commit to the rationalisation engine?** The spectrum runs from "none — publish it and move on" to "dedicate a developer for 3 months to make it production-ready." The answer shapes which option is viable.

2. **Does the EA platform tender benefit from having the rationalisation engine as a use case?** If we can say "here's what downstream analysis looks like when councils have structured architecture data," does that strengthen the case?

3. **What's our risk tolerance for publishing an un-researched tool?** The "no warranty, experimental" framing mitigates this, but there may be reputational considerations. Would a brief show-and-tell with 2-3 willing councils count as sufficient validation?

4. **Is the timing right?** Current LGR cohorts (Devon, Norfolk, Suffolk, etc.) need this support now. The EA platform won't be ready for months/years. Is there value in offering something imperfect today while the proper platform is built?

5. **Does this strengthen or complicate the EA platform pitch?** Showing a working prototype of downstream analysis might help justify the platform investment. Or it might confuse the narrative ("wait, are you building two things?").

---

## Appendix: Technical details

**Zero infrastructure:** The rationalisation engine is a single HTML file with no server, database, or hosting requirement. Open the file in a browser and it works. This means:
- No ongoing hosting cost
- No data governance concern (all data stays on the user's machine)
- No authentication or multi-tenancy complexity
- No security surface to maintain
- Can be distributed as easily as emailing a file

**Open source:** Currently on Daniel's personal GitHub. Could be moved to a government organisation if adopted.

**Data model compatibility:** The engine already uses ESD function taxonomy (the same vocabulary the EA platform would likely adopt). It also uses the LGAM capability vocabulary for cross-cutting platform analysis. This means EA platform → rationalisation engine data flow would require minimal transformation.

**What it needs to be "production-ready":**
- User research with actual LGR councils (validated problem, validated approach)
- Accessibility audit and remediation (some WCAG AA issues known)
- Documentation for council users (stakeholder intro exists but needs iteration)
- Decision on support model (even if "no support" — that needs to be explicit)
