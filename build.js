const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');

// ---------------------------------------------------------------------------
// JSON Schema generation helpers
// ---------------------------------------------------------------------------

function fieldToJsonSchema(field) {
    const prop = { description: field.description };

    if (field.const) {
        prop.const = field.const;
    } else if (field.type === 'array') {
        prop.type = 'array';
        if (field.items) prop.items = { type: field.items };
    } else if (field.type === 'object' && field.fields) {
        prop.type = 'object';
        prop.properties = {};
        for (const sub of field.fields) {
            prop.properties[sub.name] = fieldToJsonSchema(sub);
        }
    } else {
        prop.type = field.type;
    }

    if (field.enum) prop.enum = field.enum;
    if (field.format) prop.format = field.format;
    if (field.min !== undefined) prop.minimum = field.min;
    if (field.max !== undefined) prop.maximum = field.max;

    return prop;
}

function nodeTypeToSchema(nodeType) {
    const schema = {
        type: 'object',
        description: nodeType.description,
        required: nodeType.fields.filter(f => f.required).map(f => f.name),
        properties: {}
    };
    for (const field of nodeType.fields) {
        schema.properties[field.name] = fieldToJsonSchema(field);
    }
    return schema;
}

function edgeTypeToSchema(edgeType) {
    const schema = {
        type: 'object',
        description: edgeType.description,
        required: edgeType.fields.filter(f => f.required).map(f => f.name),
        properties: {}
    };
    for (const field of edgeType.fields) {
        schema.properties[field.name] = fieldToJsonSchema(field);
    }
    return schema;
}

function convertToJsonSchema(def) {
    const schema = {
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        title: def.title,
        description: def.description,
        type: 'object',
        required: def.topLevel.filter(f => f.required).map(f => f.name),
        properties: {}
    };

    for (const field of def.topLevel) {
        schema.properties[field.name] = fieldToJsonSchema(field);
    }

    // Override nodes and edges with proper array schemas
    schema.properties.nodes = {
        type: 'array',
        description: 'Array of Function and ITSystem nodes',
        items: {
            oneOf: [
                nodeTypeToSchema(def.nodeTypes.Function),
                nodeTypeToSchema(def.nodeTypes.ITSystem)
            ]
        }
    };

    schema.properties.edges = {
        type: 'array',
        description: 'Array of relationships between nodes',
        items: {
            oneOf: Object.values(def.edgeTypes).map(et => edgeTypeToSchema(et))
        }
    };

    return schema;
}

function convertToJsonSchemaConfig(def) {
    const schema = {
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        title: def.title,
        description: def.description,
        type: 'object',
        required: def.topLevel.filter(f => f.required).map(f => f.name),
        properties: {}
    };

    for (const field of def.topLevel) {
        if (field.name === 'successors') {
            schema.properties.successors = {
                type: 'array',
                description: field.description,
                items: {
                    type: 'object',
                    required: def.successorFields.filter(f => f.required).map(f => f.name),
                    properties: {}
                }
            };
            for (const sf of def.successorFields) {
                schema.properties.successors.items.properties[sf.name] = fieldToJsonSchema(sf);
            }
        } else {
            schema.properties[field.name] = fieldToJsonSchema(field);
        }
    }

    return schema;
}

async function generateJsonSchemas() {
    // Bundle schema-definitions into CJS so we can require() it in CommonJS context
    const result = await esbuild.build({
        entryPoints: [path.join(SRC, 'constants/schema-definitions.js')],
        bundle: true,
        format: 'cjs',
        write: false,
        platform: 'node'
    });

    // Evaluate to get the export
    const exports = {};
    const mod = { exports };
    vm.runInNewContext(result.outputFiles[0].text, { module: mod, exports, require });
    const { SCHEMA_DEFINITIONS } = mod.exports;

    // Generate architecture schema
    const archSchema = convertToJsonSchema(SCHEMA_DEFINITIONS.architecture);
    const archPath = path.join(DIST, 'lgr-architecture.schema.json');
    fs.writeFileSync(archPath, JSON.stringify(archSchema, null, 2));
    console.log(`Generated ${archPath}`);

    // Generate transition config schema
    const configSchema = convertToJsonSchemaConfig(SCHEMA_DEFINITIONS.transitionConfig);
    const configPath = path.join(DIST, 'lgr-transition-config.schema.json');
    fs.writeFileSync(configPath, JSON.stringify(configSchema, null, 2));
    console.log(`Generated ${configPath}`);
}

// ---------------------------------------------------------------------------

async function build() {
    // Bundle JS modules into a single IIFE
    const jsResult = await esbuild.build({
        entryPoints: [path.join(SRC, 'main.js')],
        bundle: true,
        format: 'iife',
        target: 'es2020',
        minify: false,
        write: false,
    });
    const jsBundle = jsResult.outputFiles[0].text;

    // Read CSS
    const css = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf-8');

    // Read HTML template and inject
    let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf-8');
    html = html.replace('{{STYLES}}', css);
    html = html.replace('{{BUNDLE}}', jsBundle);

    // Write output
    fs.mkdirSync(DIST, { recursive: true });
    const outPath = path.join(DIST, 'lgr-rationalisation-engine.html');
    fs.writeFileSync(outPath, html);

    const sizeKB = Math.round(fs.statSync(outPath).size / 1024);
    console.log(`Built ${outPath} (${sizeKB} KB)`);

    // Generate JSON Schema files
    await generateJsonSchemas();

    // Build schema documentation page
    const schemaPageJs = await esbuild.build({
        entryPoints: [path.join(SRC, 'schema-page-entry.js')],
        bundle: true,
        format: 'iife',
        target: 'es2020',
        minify: false,
        write: false,
    });
    let schemaPageHtml = fs.readFileSync(path.join(SRC, 'schema-page.html'), 'utf-8');
    schemaPageHtml = schemaPageHtml.replace('{{BUNDLE}}', schemaPageJs.outputFiles[0].text);
    const schemaPagePath = path.join(DIST, 'schema.html');
    fs.writeFileSync(schemaPagePath, schemaPageHtml);
    const schemaPageSize = Math.round(fs.statSync(schemaPagePath).size / 1024);
    console.log(`Built ${schemaPagePath} (${schemaPageSize} KB)`);

    // Build documentation site
    buildDocs();
}

// ---------------------------------------------------------------------------
// Documentation site build
// ---------------------------------------------------------------------------

function buildDocs() {
    const DOCS_SRC = path.join(SRC, 'docs');
    const DOCS_DIST = path.join(DIST, 'docs');
    if (!fs.existsSync(DOCS_SRC)) return;

    const templatePath = path.join(DOCS_SRC, 'template.html');
    if (!fs.existsSync(templatePath)) return;
    const template = fs.readFileSync(templatePath, 'utf-8');

    // Ensure output dirs
    fs.mkdirSync(DOCS_DIST, { recursive: true });
    fs.mkdirSync(path.join(DOCS_DIST, 'user-guide'), { recursive: true });
    fs.mkdirSync(path.join(DOCS_DIST, 'technical'), { recursive: true });
    fs.mkdirSync(path.join(DOCS_DIST, 'assets'), { recursive: true });

    // Copy assets
    const assetsDir = path.join(DOCS_SRC, 'assets');
    if (fs.existsSync(assetsDir)) {
        for (const file of fs.readdirSync(assetsDir)) {
            fs.copyFileSync(path.join(assetsDir, file), path.join(DOCS_DIST, 'assets', file));
        }
    }

    // Discover all markdown files
    const pages = [];
    function scanDir(dir, prefix) {
        if (!fs.existsSync(dir)) return;
        for (const file of fs.readdirSync(dir)) {
            if (file.endsWith('.md')) {
                const fullPath = path.join(dir, file);
                const content = fs.readFileSync(fullPath, 'utf-8');
                const { frontmatter, body } = parseFrontmatter(content);
                const slug = prefix ? `${prefix}/${file.replace('.md', '')}` : file.replace('.md', '');
                const outFile = slug + '.html';
                pages.push({ slug, outFile, title: frontmatter.title || slug, order: frontmatter.order || 99, section: frontmatter.section || prefix || '', body, frontmatter });
            }
        }
    }

    scanDir(DOCS_SRC, '');
    scanDir(path.join(DOCS_SRC, 'user-guide'), 'user-guide');
    scanDir(path.join(DOCS_SRC, 'technical'), 'technical');

    // Sort pages within sections
    pages.sort((a, b) => {
        if (a.section !== b.section) return a.section.localeCompare(b.section);
        return a.order - b.order;
    });

    // Build sidebar HTML
    const sidebarHtml = buildSidebar(pages);

    // Build each page
    let builtCount = 0;
    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const contentHtml = markdownToHtml(page.body);
        const breadcrumb = buildBreadcrumb(page);
        const pagination = buildPagination(pages, i);

        let html = template
            .replace('{{TITLE}}', escHtmlAttr(page.title))
            .replace('{{BREADCRUMB}}', breadcrumb)
            .replace('{{SIDEBAR}}', sidebarHtml.replace(`href="${page.outFile}"`, `href="${page.outFile}" class="nav-link active"`).replace(new RegExp(`<a class="nav-link" href="${escRegex(page.outFile)}"`), `<a class="nav-link active" href="${page.outFile}"`))
            .replace('{{CONTENT}}', contentHtml)
            .replace('{{PAGINATION}}', pagination);

        // Fix relative sidebar links based on page depth
        if (page.section) {
            html = html.replace(/href="((?!http|\/|#)[^"]+\.html)"/g, (match, href) => {
                if (href.startsWith(page.section + '/')) return `href="${href.replace(page.section + '/', '')}"`;
                return `href="../${href}"`;
            });
        }

        const outPath = path.join(DOCS_DIST, page.outFile);
        fs.writeFileSync(outPath, html);
        builtCount++;
    }

    if (builtCount > 0) {
        console.log(`Built ${builtCount} documentation pages in ${DOCS_DIST}`);
    }
}

function parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { frontmatter: {}, body: content };
    const fm = {};
    match[1].split('\n').forEach(line => {
        const [key, ...rest] = line.split(':');
        if (key && rest.length) fm[key.trim()] = rest.join(':').trim();
    });
    return { frontmatter: fm, body: match[2] };
}

function markdownToHtml(md) {
    let html = md;
    // Code blocks (``` fenced) — extract to placeholders to prevent paragraph wrapping
    const codeBlocks = [];
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
        let block;
        if (lang === 'mermaid') {
            block = `<pre class="mermaid">\n${code.trimEnd()}\n</pre>`;
        } else {
            const cls = lang ? ` class="language-${lang}"` : '';
            block = `<pre><code${cls}>${escHtmlContent(code.trimEnd())}</code></pre>`;
        }
        const placeholder = `<!--CODEBLOCK_${codeBlocks.length}-->`;
        codeBlocks.push(block);
        return placeholder;
    });
    // Inline code (escape HTML inside backticks)
    html = html.replace(/`([^`]+)`/g, (_, code) => `<code>${escHtmlContent(code)}</code>`);
    // Headings
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>');
    // Bold and italic
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Images with alt text
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" role="img" />');
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    // Tables
    html = html.replace(/^\|(.+)\|\s*\n\|[-| :]+\|\s*\n((?:\|.+\|\s*\n?)*)/gm, (_, headerRow, bodyRows) => {
        const headers = headerRow.split('|').map(h => h.trim()).filter(Boolean);
        const rows = bodyRows.trim().split('\n').map(r => r.split('|').map(c => c.trim()).filter(Boolean));
        let t = '<table><thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';
        rows.forEach(r => { t += '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>'; });
        t += '</tbody></table>';
        return t;
    });
    // Unordered lists
    html = html.replace(/(?:^- .+\n?)+/gm, match => {
        const items = match.trim().split('\n').map(l => `<li>${l.replace(/^- /, '')}</li>`).join('');
        return `<ul>${items}</ul>`;
    });
    // Ordered lists
    html = html.replace(/(?:^\d+\. .+\n?)+/gm, match => {
        const items = match.trim().split('\n').map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('');
        return `<ol>${items}</ol>`;
    });
    // Paragraphs (lines not already wrapped)
    html = html.replace(/^(?!<[houpblit!]|$)(.+)$/gm, '<p>$1</p>');
    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');
    // Restore code block placeholders
    html = html.replace(/<!--CODEBLOCK_(\d+)-->/g, (_, idx) => codeBlocks[parseInt(idx)]);
    return html;
}

function buildSidebar(pages) {
    let html = '';
    let currentSection = '';
    const sectionLabels = { '': 'Overview', 'user-guide': 'User Guide', 'technical': 'Technical Reference' };
    for (const page of pages) {
        if (page.section !== currentSection) {
            currentSection = page.section;
            html += `<div class="nav-section">${sectionLabels[currentSection] || currentSection}</div>`;
        }
        html += `<a class="nav-link" href="${page.outFile}">${escHtmlContent(page.title)}</a>`;
    }
    return html;
}

function buildBreadcrumb(page) {
    const crumbs = [`<a href="index.html" class="text-[#1d70b8] hover:underline">Docs</a>`];
    if (page.section === 'user-guide') crumbs.push(`<span class="text-[#505a5f]">User Guide</span>`);
    if (page.section === 'technical') crumbs.push(`<span class="text-[#505a5f]">Technical</span>`);
    if (page.slug !== 'index') crumbs.push(`<span class="text-[#0b0c0c] font-bold">${escHtmlContent(page.title)}</span>`);
    return crumbs.join(' <span class="text-[#b1b4b6] mx-1">/</span> ');
}

function buildPagination(pages, currentIdx) {
    let html = '';
    if (currentIdx > 0) {
        const prev = pages[currentIdx - 1];
        html += `<a href="${prev.outFile}" class="text-[#1d70b8] hover:underline font-bold">&larr; ${escHtmlContent(prev.title)}</a>`;
    } else {
        html += '<span></span>';
    }
    if (currentIdx < pages.length - 1) {
        const next = pages[currentIdx + 1];
        html += `<a href="${next.outFile}" class="text-[#1d70b8] hover:underline font-bold">${escHtmlContent(next.title)} &rarr;</a>`;
    } else {
        html += '<span></span>';
    }
    return html;
}

function escHtmlContent(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escHtmlAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
function escRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Watch mode
if (process.argv.includes('--watch')) {
    const chokidar = (() => {
        try { return require('chokidar'); } catch { return null; }
    })();
    if (chokidar) {
        build();
        chokidar.watch(SRC, { ignoreInitial: true }).on('all', () => {
            build().catch(e => console.error('Build error:', e.message));
        });
        console.log('Watching src/ for changes...');
    } else {
        console.log('Watch mode requires chokidar (npm install --save-dev chokidar). Running single build.');
        build().catch(e => { console.error(e); process.exit(1); });
    }
} else {
    build().catch(e => { console.error(e); process.exit(1); });
}
