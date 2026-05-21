# Stage 1 Phase 1: Schema Definitions, Landing Page & Documentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Stage 1 with three clear sections (Upload, Schema Reference, Tools), powered by a semantic schema source that generates in-app docs, a standalone page, and JSON Schema files.

**Architecture:** A new `src/constants/schema-definitions.js` is the single source of truth for both schemas. `src/features/schema-reference.js` renders it inline on Stage 1. `build.js` generates `dist/schema.html` and two `.schema.json` files from the same source. Stage 1 HTML is reorganised into Upload / Schema Reference / Tools sections.

**Tech Stack:** ES modules, esbuild bundler, JSON Schema Draft 2020-12

---

### Task 1: Schema Definitions (Semantic Source)

**Files:**
- Create: `src/constants/schema-definitions.js`
- Test: `tests/properties/schema-definitions.property.test.js`

The single source of truth for both architecture and transition config schemas. Every field, type, enum, and description lives here.

- [ ] **Step 1: Create `src/constants/schema-definitions.js`**

Export a `SCHEMA_DEFINITIONS` object with two top-level keys: `architecture` and `transitionConfig`. Each contains:
- `title` (string)
- `description` (string)
- `topLevel` — array of field definitions for top-level properties
- `nodeTypes` (architecture only) — object with `Function` and `ITSystem` keys, each having `description` and `fields` array
- `edgeTypes` (architecture only) — object with `REALIZES` and `CONSUMES_CAPABILITY` keys
- `successorFields` (transitionConfig only) — field definitions for successor objects
- `example` — a complete minimal valid JSON example

Each field definition:
```js
{ name: 'portability', type: 'string', required: false,
  enum: ['High', 'Medium', 'Low'],
  description: 'Ease of bulk data extraction',
  enumDescriptions: { High: '...', Medium: '...', Low: '...' } }
```

Include ALL fields from the current schema (match CLAUDE.md Input Data Format section exactly): id, label, type, lgaFunctionId (Function); id, label, type, vendor, users, annualCost, cost, endYear, endMonth, noticePeriod, portability, dataPartitioning, isCloud, isERP, sharedWith, targetAuthorities, capabilityType, supportModel (ITSystem).

Include `enumDescriptions` for: portability, dataPartitioning, supportModel (same text as the template generator's input messages).

Include a minimal valid example for each schema:
- Architecture: one council, one function, one system, one REALIZES edge
- Transition config: one vesting date, one successor with one full predecessor

- [ ] **Step 2: Write property tests**

Create `tests/properties/schema-definitions.property.test.js`:
- Every field in `SCHEMA_DEFINITIONS.architecture.nodeTypes.ITSystem.fields` has name, type, and description
- Every field with `enum` also has `enumDescriptions` with matching keys
- `example` is a valid object (has councilName, nodes, edges for architecture; has vestingDate, successors for config)
- No duplicate field names within a node type

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add src/constants/schema-definitions.js tests/properties/schema-definitions.property.test.js
git commit -m "feat: add schema-definitions.js as single semantic source for both schemas"
```

---

### Task 2: JSON Schema Generation in Build

**Files:**
- Modify: `build.js`
- Create: (generates `dist/lgr-architecture.schema.json` and `dist/lgr-transition-config.schema.json` at build time)

The build script reads schema-definitions.js and converts to JSON Schema Draft 2020-12 format.

- [ ] **Step 1: Add JSON Schema generation to `build.js`**

After the existing HTML build, add a function `generateJsonSchemas()` that:
1. Dynamically imports `src/constants/schema-definitions.js` (using esbuild to bundle it into a temp CJS file, then require it — since build.js is CJS)
2. Converts architecture schema definition to JSON Schema format
3. Converts transition config schema definition to JSON Schema format
4. Writes both to `dist/`

The conversion logic (for architecture):
```js
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": def.title,
  "description": def.description,
  "type": "object",
  "required": def.topLevel.filter(f => f.required).map(f => f.name),
  "properties": {
    // For each topLevel field, generate a JSON Schema property
    // For nodes: { "type": "array", "items": { "oneOf": [Function schema, ITSystem schema] } }
    // For edges: { "type": "array", "items": { "oneOf": [REALIZES schema, CONSUMES_CAPABILITY schema] } }
  }
}
```

For node type schemas, map each field definition to JSON Schema properties, including `enum` arrays where defined.

Since build.js uses CommonJS and schema-definitions.js uses ES modules, use esbuild to bundle the schema-definitions into a temp file:
```js
const schemaBundle = await esbuild.build({
    entryPoints: [path.join(SRC, 'constants/schema-definitions.js')],
    bundle: true, format: 'cjs', write: false, platform: 'node'
});
const schemaModule = requireFromString(schemaBundle.outputFiles[0].text);
```

Where `requireFromString` writes to a temp file and requires it (or uses `vm.runInNewContext`).

- [ ] **Step 2: Run build and verify schema files are generated**

Run: `node build.js`
Expected: Builds main HTML + generates `dist/lgr-architecture.schema.json` and `dist/lgr-transition-config.schema.json`

Verify: `cat dist/lgr-architecture.schema.json | python3 -m json.tool | head -20` shows valid JSON Schema

- [ ] **Step 3: Commit**

```bash
git add build.js dist/lgr-architecture.schema.json dist/lgr-transition-config.schema.json
git commit -m "feat: generate JSON Schema files from schema-definitions at build time"
```

---

### Task 3: In-App Schema Reference Component

**Files:**
- Create: `src/features/schema-reference.js`

A module that renders the schema reference section for Stage 1, reading from SCHEMA_DEFINITIONS.

- [ ] **Step 1: Create `src/features/schema-reference.js`**

Export `renderSchemaReference()` — returns an HTML string for the Schema Reference section.

Layout: two side-by-side cards (architecture and transition config). Each card shows:
- Title and one-line description
- Top-level structure (bulleted list of required/optional fields)
- "Full reference ↗" link (opens standalone schema page in new tab — `schema.html`)
- "Download .schema.json" button (downloads the generated JSON Schema file)
- "Copy example" button (copies the minimal example to clipboard)

The full reference link points to `schema.html` (relative — works on GitHub Pages). The .schema.json download uses an `<a download>` link to the generated file.

Also render a collapsible "Field Reference" table below the cards — all ITSystem fields in a sortable table with Name, Type, Required, Valid Values, Description columns. Initially collapsed with a "Show all fields" toggle.

- [ ] **Step 2: Run build to verify no import errors**

Run: `node build.js`
Expected: Success (module not yet wired into main.js but syntax valid)

- [ ] **Step 3: Commit**

```bash
git add src/features/schema-reference.js
git commit -m "feat: add schema-reference component rendering from schema-definitions"
```

---

### Task 4: Stage 1 HTML Redesign

**Files:**
- Modify: `src/index.html` (Stage 1 section)
- Modify: `src/main.js` (wire schema reference rendering + tool navigation)

Restructure Stage 1 into three sections: Upload, Schema Reference, Data Preparation Tools.

- [ ] **Step 1: Rewrite Stage 1 HTML in `src/index.html`**

Replace the current Stage 1 content (from `<div id="stageUpload"...>` to its closing `</div>`) with the three-section layout:

**Section 1: Upload**
- Upload area (existing, with clear format labels)
- Staged files list (existing `#fileList`)
- Proceed button (existing)

**Section 2: Schema Reference**
- Container div: `<div id="schemaReferenceSection"></div>` — populated by JS
- Placed AFTER the upload area but BEFORE tools

**Section 3: Data Preparation Tools**
- Grid of tool cards (Download Template, Validate File [Phase 2 — disabled], Import from CSV, Build from Scratch)
- Each card: icon/title + one-line description + button
- Demo scenario link at bottom (de-emphasised)

Key IDs to preserve (existing JS depends on them): `uploadArea`, `fileInput`, `fileList`, `uploadedFilesUl`, `btnProceedBaseline`, `btnDownloadTemplate`, `btnOpenImportWizard`, `btnOpenManualEntry`, `btnLoadDemo`

- [ ] **Step 2: Wire schema reference rendering in `src/main.js`**

Import `renderSchemaReference` from `./features/schema-reference.js`. On page load (or after DOM ready), render it into `#schemaReferenceSection`:
```js
import { renderSchemaReference } from './features/schema-reference.js';
document.getElementById('schemaReferenceSection').innerHTML = renderSchemaReference();
```

Wire the "Copy example" buttons with clipboard API:
```js
document.querySelectorAll('[data-copy-example]').forEach(btn => {
    btn.addEventListener('click', () => {
        navigator.clipboard.writeText(btn.dataset.copyExample);
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy example'; }, 2000);
    });
});
```

- [ ] **Step 3: Run tests and build**

Run: `npm test && node build.js`
Expected: All tests pass, build succeeds, Stage 1 renders with schema reference

- [ ] **Step 4: Commit**

```bash
git add src/index.html src/main.js src/features/schema-reference.js dist/lgr-rationalisation-engine.html
git commit -m "feat: redesign Stage 1 with three-section layout and inline schema reference"
```

---

### Task 5: Standalone Schema Page

**Files:**
- Create: `src/schema-page.html`
- Modify: `build.js` (add second HTML build output)

A separate self-contained HTML page for schema documentation, deployed alongside the main app.

- [ ] **Step 1: Create `src/schema-page.html`**

A full HTML page (standalone, Tailwind from CDN like the main app) with:
- Header: "LGR Architecture Schema Reference" + link back to main app
- Navigation sidebar (sticky): Architecture Schema | Transition Config | Downloads
- Main content: Full field reference tables for both schemas, generated from SCHEMA_DEFINITIONS
- Example JSON blocks with syntax highlighting (use `<pre><code>` with Tailwind typography)
- Download section: links to both .schema.json files
- Footer: "Part of the LGR Workspace Engine"

Uses `{{SCHEMA_CONTENT}}` placeholder injected by build.js.

The JS bundle for this page is minimal — just renders the schema content from SCHEMA_DEFINITIONS (same import, smaller bundle since it doesn't need the full app).

- [ ] **Step 2: Add schema page build to `build.js`**

After the main HTML build and JSON Schema generation:
```js
// Build schema page
const schemaPageBundle = await esbuild.build({
    entryPoints: [path.join(SRC, 'schema-page-entry.js')],
    bundle: true, format: 'iife', target: 'es2020', minify: false, write: false
});
let schemaPageHtml = fs.readFileSync(path.join(SRC, 'schema-page.html'), 'utf-8');
schemaPageHtml = schemaPageHtml.replace('{{BUNDLE}}', schemaPageBundle.outputFiles[0].text);
fs.writeFileSync(path.join(DIST, 'schema.html'), schemaPageHtml);
```

Create `src/schema-page-entry.js` as the minimal entry point that imports SCHEMA_DEFINITIONS and renders the page content.

- [ ] **Step 3: Run build and verify**

Run: `node build.js`
Expected: Generates `dist/schema.html` alongside the main app. Open it in browser to verify.

- [ ] **Step 4: Commit**

```bash
git add src/schema-page.html src/schema-page-entry.js build.js dist/schema.html
git commit -m "feat: add standalone schema documentation page (dist/schema.html)"
```

---

### Task 6: Browser Verification

**Files:** None (testing only)

- [ ] **Step 1: Verify main app Stage 1**

Serve: `python3 -m http.server 8765`
Navigate to: `http://localhost:8765/dist/lgr-rationalisation-engine.html`

Check:
- Three sections visible: Upload, Schema Reference, Tools
- Schema reference shows two cards (architecture + transition config)
- "Copy example" buttons work (clipboard)
- "Download .schema.json" buttons trigger downloads
- "Full reference" links open schema.html in new tab
- Upload area still accepts JSON and xlsx files
- Template download still works
- Import wizard and manual builder buttons still work
- Demo scenario button works
- Proceed button appears after upload

- [ ] **Step 2: Verify standalone schema page**

Navigate to: `http://localhost:8765/dist/schema.html`

Check:
- Full field reference tables render
- Navigation links work (scroll to sections)
- Download links for .schema.json files work
- Link back to main app works
- Page is self-contained (works without the main app loaded)

- [ ] **Step 3: Verify JSON Schema files**

Run: `node -e "const s = require('./dist/lgr-architecture.schema.json'); console.log(s.title, Object.keys(s.properties))"`
Expected: Prints title and property names

- [ ] **Step 4: Final build + commit dist**

```bash
node build.js
git add dist/
git commit -m "build: include all Phase 1 outputs in dist"
```
