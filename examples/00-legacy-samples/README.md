# Legacy Sample Data

These are the original development sample files created during the initial build of the LGR Rationalisation Engine. They predate the 10 curated example scenarios (01–10) and were used for testing during Sprints 1–4.

## Files

| File | Description |
|---|---|
| `northshire-county.json` | County council with Oracle ERP |
| `easton-district.json` | District council with Unit4 ERP, shared NEC Revenues |
| `southby-borough.json` | Borough with long-term waste contract, shared NEC Revenues |
| `westampton-district.json` | Cloud-native modular stack |
| `test-complex-lgr.json` | Complex disaggregation scenario with targetAuthorities |

## Relationship to Curated Scenarios

The curated scenarios in `examples/01-*` through `examples/10-*` provide more comprehensive and realistic test coverage. Each includes multiple council files, a transition config, and a README documenting expected analytical outcomes per persona.

These legacy samples remain useful for quick smoke testing and are referenced in historical sprint artifacts (`.claude/sprints/sprint-1/`, `.claude/sprints/sprint-2/`).
