---
title: Build System
order: 4
section: technical
---

# Build System

The build system bundles the modular source into deployable outputs. The key constraint is that the primary output is a **single self-contained HTML file** that works without a server, build tools, or network access (except for Tailwind CDN).

## Build Pipeline Stages

`build.js` (Node.js, CommonJS) executes these stages sequentially:

```
1. BUNDLE JS          esbuild: src/main.js -> single IIFE
2. READ CSS           Read src/styles.css
3. INJECT INTO HTML   Replace {{STYLES}} and {{BUNDLE}} in src/index.html
4. WRITE OUTPUT       -> dist/lgr-rationalisation-engine.html

5. GENERATE SCHEMAS   Bundle schema-definitions.js -> evaluate -> JSON Schema files
                      -> dist/lgr-architecture.schema.json
                      -> dist/lgr-transition-config.schema.json

6. BUILD SCHEMA PAGE  esbuild: src/schema-page-entry.js -> inject into schema-page.html
                      -> dist/schema.html

7. BUILD DOCS         Scan src/docs/ for .md files -> render to HTML via template
                      -> dist/docs/*.html
```

## Commands

| Command | What it does |
|---|---|
| `npm run build` | Single build: bundles everything, writes to `dist/` |
| `npm run dev` | Watch mode: rebuilds on any `src/` file change (requires chokidar) |
| `npm test` | Run property tests via vitest + fast-check |
| `npm run test:watch` | Vitest in watch mode |
| `node build.js` | Direct invocation (same as `npm run build`) |
| `node build.js --watch` | Direct watch mode invocation |

## esbuild Configuration

```javascript
const jsResult = await esbuild.build({
    entryPoints: [path.join(SRC, 'main.js')],
    bundle: true,       // Resolve all imports into one file
    format: 'iife',     // Immediately-invoked function expression (no module system needed)
    target: 'es2020',   // Browser compatibility target
    minify: false,      // Keep readable for debugging
    write: false,       // Don't write to disk - we inject into HTML template
});
```

The IIFE format means the bundled code executes immediately when the browser parses the `<script>` tag. No module loader required.

## Template Injection

`src/index.html` contains two placeholders:

```html
<style>{{STYLES}}</style>
<script>{{BUNDLE}}</script>
```

The build reads `src/styles.css` and the bundled JS, then replaces these placeholders:

```javascript
let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf-8');
html = html.replace('{{STYLES}}', css);
html = html.replace('{{BUNDLE}}', jsBundle);
fs.writeFileSync(outPath, html);
```

## JSON Schema Generation

The build evaluates `src/constants/schema-definitions.js` to extract the schema structure, then converts it to JSON Schema (draft 2020-12):

```javascript
async function generateJsonSchemas() {
    // Bundle schema-definitions into CJS format
    const result = await esbuild.build({
        entryPoints: [path.join(SRC, 'constants/schema-definitions.js')],
        bundle: true, format: 'cjs', write: false, platform: 'node'
    });
    // Evaluate in sandbox to get exports
    vm.runInNewContext(result.outputFiles[0].text, { module: mod, exports, require });
    const { SCHEMA_DEFINITIONS } = mod.exports;
    // Convert and write
    const archSchema = convertToJsonSchema(SCHEMA_DEFINITIONS.architecture);
    fs.writeFileSync(path.join(DIST, 'lgr-architecture.schema.json'), ...);
}
```

This generates two schema files:
- `dist/lgr-architecture.schema.json` - validates council architecture files
- `dist/lgr-transition-config.schema.json` - validates transition config files

## Documentation Site Build

The `buildDocs()` function:

1. Scans `src/docs/` for `.md` files (root, `user-guide/`, `technical/`)
2. Parses YAML frontmatter for `title`, `order`, `section`
3. Converts markdown to HTML using a built-in converter (no external dependency)
4. Injects content into `src/docs/template.html`
5. Generates sidebar navigation, breadcrumbs, and prev/next pagination
6. Writes to `dist/docs/`

The markdown converter handles: headings, code blocks, tables, lists, links, images, bold/italic, blockquotes. It does NOT support nested lists or complex markdown extensions.

### Frontmatter Format

```yaml
---
title: Page Title
order: 1
section: technical
---
```

- `title` - displayed in sidebar and page header
- `order` - sort position within its section (lower = earlier)
- `section` - one of: `` (root/overview), `user-guide`, `technical`

## Adding New Modules

Adding a new source module requires zero build configuration:

1. Create your file anywhere under `src/`
2. Use ES module syntax (`export`, `import`)
3. Import it from `main.js` or from a module that `main.js` already imports
4. esbuild's tree of imports resolves everything automatically

```javascript
// src/features/my-new-feature.js
export function renderMyFeature() { return '<div>Hello</div>'; }

// src/main.js (add the import)
import { renderMyFeature } from './features/my-new-feature.js';
```

That's it. No config file to update, no manifest to edit.

## Testing Approach

### Property Tests (vitest + fast-check)

Test files: `tests/properties/*.property.test.js`
Generators: `tests/generators/`

Property tests verify pure functions with randomised inputs. They catch edge cases that unit tests miss.

```javascript
import { describe, it } from 'vitest';
import { fc } from '@fast-check/vitest';
import { arbITSystem } from '../generators/arbITSystem.js';

describe('computeTcopAssessment', () => {
    it('cloud systems always align with Point 5', () => {
        fc.assert(fc.property(
            arbITSystem({ hosting: 'cloud' }),
            (system) => {
                const result = computeTcopAssessment(system);
                return result.alignments.some(a => a.point === 5);
            }
        ));
    });
});
```

### Test Generators

| Generator | File | Produces |
|---|---|---|
| `arbITSystem` | `tests/generators/arbITSystem.js` | Randomised ITSystem node objects |
| `arbCouncil` | `tests/generators/arbCouncil.js` | Full council architecture payloads |
| `arbEstate` | `tests/generators/arbEstate.js` | Multi-council estates with edges |
| `arbTransitionStructure` | `tests/generators/arbTransitionStructure.js` | Valid transition configs |
| `arbEditorState` / `arbBulkState` | `tests/generators/unified-editor-generators.js` | Editor state objects |

### Running Tests

```bash
npm test                    # Run all property tests
npm run test:watch          # Watch mode
npx vitest run tests/properties/signals.property.test.js  # Single file
```

### Browser Testing

The app must be served over HTTP (not `file:///`):

```bash
python3 -m http.server 8765
# Then navigate to http://localhost:8765/dist/lgr-rationalisation-engine.html
```

Browser testing uses Playwright MCP tools (not custom scripts):

```
mcp__playwright__browser_navigate -> http://localhost:8765/dist/lgr-rationalisation-engine.html
mcp__playwright__browser_snapshot -> accessibility tree
mcp__playwright__browser_click    -> interact with elements
```

## How the Single-File Output Works

The output `dist/lgr-rationalisation-engine.html` is completely self-contained:

- All JavaScript is inlined in a `<script>` tag (no external `.js` files)
- All CSS is inlined in a `<style>` tag
- The only network dependency is Tailwind CSS CDN (loaded in `<head>`)
- External libraries (PapaParse, SheetJS, D3) are lazy-loaded from CDN only when their features are used

This means the file can be:
- Served from any static host
- Opened directly from disk (with Tailwind CDN limitation)
- Emailed as an attachment
- Stored in SharePoint/Teams

## Watch Mode

```bash
node build.js --watch
```

Uses chokidar to watch all files under `src/`. On any change:
1. Triggers a full rebuild
2. Reports build size on success
3. Reports error message on failure (does not exit)

Note: chokidar is an optional dev dependency. If not installed, watch mode falls back to a single build with a warning message.

## dist/ Outputs

| File | Size (typical) | Description |
|---|---|---|
| `lgr-rationalisation-engine.html` | ~450 KB | Main application (self-contained) |
| `lgr-architecture.schema.json` | ~8 KB | JSON Schema for architecture files |
| `lgr-transition-config.schema.json` | ~3 KB | JSON Schema for transition configs |
| `schema.html` | ~120 KB | Schema documentation page |
| `docs/` | ~15 files | Documentation site (HTML pages) |

## How to Add a Documentation Page

1. Create a `.md` file in the appropriate `src/docs/` subdirectory
2. Add YAML frontmatter:
   ```yaml
   ---
   title: My New Page
   order: 6
   section: technical
   ---
   ```
3. Write your content in markdown
4. Run `node build.js` - the page appears in `dist/docs/`
5. Update `src/docs/index.md` to link to the new page

## Build Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `Cannot resolve './my-module.js'` | Missing file or wrong path | Check the import path matches the actual file location |
| Bundle size spike | Large constant or duplicated import | Check for accidental data duplication in constants |
| Schema generation fails | Invalid schema-definitions.js export | Ensure `SCHEMA_DEFINITIONS` exports correctly after `vm.runInNewContext` |
| Watch mode not working | chokidar not installed | `npm install --save-dev chokidar` |
| Build passes but app blank | JS error at runtime | Serve over HTTP, check browser console |
