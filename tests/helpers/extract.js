import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

/**
 * Reads lgr-rationalisation-engine.html, extracts the inline <script> block
 * (skipping external script tags like the Tailwind CDN), and executes it in
 * a sandboxed context so that module-level variables and functions are
 * available for testing.
 *
 * Returns an object whose keys are every top-level `let`, `const`,
 * `function`, and `var` declaration from the script block.
 */
export function extractEngine() {
  const htmlPath = resolve(import.meta.dirname, '..', '..', 'lgr-rationalisation-engine.html');
  const html = readFileSync(htmlPath, 'utf-8');

  // Match the inline script block (no src attribute)
  const scriptRegex = /<script>(?<body>[\s\S]*?)<\/script>/g;
  let scriptContent = null;

  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    // Skip trivially small matches (e.g. empty or whitespace-only)
    const body = match.groups.body.trim();
    if (body.length > 100) {
      scriptContent = body;
      break;
    }
  }

  if (!scriptContent) {
    throw new Error('Could not extract inline <script> block from lgr-rationalisation-engine.html');
  }

  // Build a minimal DOM stub so the script doesn't throw on document.getElementById etc.
  const domStub = {
    getElementById: () => ({
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      addEventListener() {},
      appendChild() {},
      removeChild() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      innerHTML: '',
      textContent: '',
      value: '',
      style: {},
      children: [],
      parentElement: null,
    }),
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      addEventListener() {},
      appendChild() {},
      removeChild() {},
      setAttribute() {},
      getAttribute() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      innerHTML: '',
      textContent: '',
      value: '',
      style: {},
      children: [],
      parentElement: null,
    }),
  };

  const sandbox = {
    document: domStub,
    window: { open() {} },
    console,
    Map,
    Set,
    Array,
    Object,
    JSON,
    Math,
    Date,
    Number,
    String,
    Boolean,
    RegExp,
    Error,
    TypeError,
    RangeError,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    undefined,
    NaN,
    Infinity,
    setTimeout: () => {},
    setInterval: () => {},
    clearTimeout: () => {},
    clearInterval: () => {},
    alert: () => {},
    prompt: () => null,
    confirm: () => false,
    FileReader: class {
      readAsText() {}
      addEventListener() {}
    },
  };

  // In V8's vm module, `const` and `let` declarations do not become properties
  // of the sandbox object — only `var` and `function` do. To expose everything,
  // we wrap the script in a function that returns an object of all top-level
  // declarations, then merge those into the context.
  //
  // Strategy: rewrite `const ` / `let ` at the top level to `var ` so they
  // land on the sandbox. This is safe because we only run the code once in an
  // isolated context — scoping semantics don't matter here.
  const rewritten = scriptContent
    .replace(/^(\s*)const /gm, '$1var ')
    .replace(/^(\s*)let /gm, '$1var ');

  const context = vm.createContext(sandbox);

  vm.runInContext(rewritten, context, {
    filename: 'lgr-rationalisation-engine.html',
  });

  return context;
}
