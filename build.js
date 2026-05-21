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
