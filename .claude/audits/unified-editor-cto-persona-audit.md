# Unified Architecture Editor — CTO/Enterprise Architect Persona Audit

**Score: 3.5/5**

## What Works Well
- Domain-grouped system list maps to how CTOs think about estates
- Completeness indicators with specific field names are genuinely useful
- Progressive disclosure of relationships (consumers only shown when capabilities defined)
- ESD function assignment via autocomplete is practical
- Contract/cost fields directly feed rationalisation signals
- Bulk mode three-tab grouping maps to real data collection workflows
- Dependency matrix gives useful blast-radius insight
- Provider-consumer capability model is conceptually correct

## What's Confusing or Broken
- Hosting model too binary (Cloud/On-Prem) — missing Shared Service, Hybrid, Vendor-hosted
- No sorting in bulk mode — can't find most expensive or soonest-expiring systems
- No filtering in bulk mode — can't focus on incomplete systems
- Nine capabilities too few — real estates need 20+ (auth, GIS, case management, etc.)
- Right panel cramped at 280px for systems with many consumers
- No undo/redo mechanism
- Dependency matrix is read-only (can't create relationships from it)

## What's Missing (Critical for CTO)
1. **Business criticality / RTO / RPO** — CTO's primary prioritisation dimension
2. **Free-text notes** — tacit knowledge that doesn't fit structured fields
3. **System version / technology stack** — determines migration path
4. **Data volume** — 500GB vs 5TB changes migration timeline radically
5. **Internal owner/contact** — CTOs delegate data collection
6. **Integration count/type** — point-to-point integrations missed by capability model
7. **Migration readiness assessment** — CTO's own "ready/needs-work/blocked" rating

## Recommendations (Prioritised)
1. Add Risk & Priority section (criticality, RTO, RPO, readiness, notes) — **Critical**
2. Add sorting to bulk mode columns — **Major**
3. Add Technical Detail section (version, stack, data volume) — **Major**
4. Add Owner/Contact field — **Major**
5. Add free-text Notes field — **Major**
6. Expand hosting to 4+ options — **Enhancement**
7. Add bulk mode filtering (by completeness, domain) — **Enhancement**
8. Expand capability vocabulary to 20-25 items — **Enhancement**
9. Add auto-save to localStorage — **Enhancement**
