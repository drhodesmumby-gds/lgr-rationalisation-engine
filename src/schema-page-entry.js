import { SCHEMA_DEFINITIONS } from './constants/schema-definitions.js';

function renderPage() {
    const arch = SCHEMA_DEFINITIONS.architecture;
    const config = SCHEMA_DEFINITIONS.transitionConfig;
    const container = document.getElementById('schemaContent');
    if (!container) return;

    let html = '';

    // Architecture Schema section
    html += renderSchemaSection(arch, 'architecture');

    // Transition Config section
    html += renderSchemaSection(config, 'transition-config');

    // Downloads section
    html += '<section id="downloads" class="mt-12 pt-8 border-t border-gray-300">';
    html += '<h2 class="text-2xl font-bold mb-4">Downloads</h2>';
    html += '<div class="space-y-3">';
    html += '<a href="lgr-architecture.schema.json" download class="block text-[#1d70b8] underline font-bold">lgr-architecture.schema.json</a>';
    html += '<a href="lgr-transition-config.schema.json" download class="block text-[#1d70b8] underline font-bold">lgr-transition-config.schema.json</a>';
    html += '</div></section>';

    container.innerHTML = html;
}

function renderSchemaSection(schema, anchorId) {
    let html = `<section id="${anchorId}" class="mb-12">`;
    html += `<h2 class="text-2xl font-bold mb-2">${schema.title}</h2>`;
    html += `<p class="text-gray-600 mb-6">${schema.description}</p>`;

    // Top-level fields
    html += '<h3 class="text-lg font-bold mb-3 mt-6">Top-Level Structure</h3>';
    html += '<table class="w-full text-sm border-collapse mb-6">';
    html += '<thead><tr class="border-b-2 border-black"><th class="text-left py-2 pr-4">Field</th><th class="text-left py-2 pr-4">Type</th><th class="text-left py-2 pr-4">Required</th><th class="text-left py-2">Description</th></tr></thead>';
    html += '<tbody>';
    for (const field of schema.topLevel) {
        const req = field.required ? '<span class="text-[#d4351c] font-bold">Yes</span>' : 'No';
        html += `<tr class="border-b border-gray-200"><td class="py-2 pr-4 font-mono text-xs font-bold">${field.name}</td><td class="py-2 pr-4 text-xs">${field.type}</td><td class="py-2 pr-4 text-xs">${req}</td><td class="py-2 text-xs">${field.description}</td></tr>`;
    }
    html += '</tbody></table>';

    // Node types (architecture only)
    if (schema.nodeTypes) {
        for (const [typeName, nodeType] of Object.entries(schema.nodeTypes)) {
            html += `<h3 class="text-lg font-bold mb-3 mt-8">Node Type: ${typeName}</h3>`;
            if (nodeType.description) {
                html += `<p class="text-sm text-gray-600 mb-3">${nodeType.description}</p>`;
            }
            html += renderFieldTable(nodeType.fields);
        }
    }

    // Successor fields (transitionConfig only)
    if (schema.successorFields) {
        html += '<h3 class="text-lg font-bold mb-3 mt-8">Successor Object Fields</h3>';
        html += renderFieldTable(schema.successorFields);
    }

    // Edge types (architecture only)
    if (schema.edgeTypes) {
        html += '<h3 class="text-lg font-bold mb-3 mt-8">Edge Types</h3>';
        for (const [typeName, edgeType] of Object.entries(schema.edgeTypes)) {
            html += `<h4 class="font-bold text-sm mb-2 mt-4">${typeName}</h4>`;
            html += `<p class="text-xs text-gray-600 mb-2">${edgeType.description}</p>`;
            html += renderFieldTable(edgeType.fields);
        }
    }

    // Example
    html += '<h3 class="text-lg font-bold mb-3 mt-8">Minimal Example</h3>';
    html += `<pre class="bg-gray-100 p-4 text-xs overflow-x-auto border border-gray-300"><code>${escapeHtml(JSON.stringify(schema.example, null, 2))}</code></pre>`;
    html += '<button class="mt-2 text-xs text-[#1d70b8] underline font-bold cursor-pointer" onclick="navigator.clipboard.writeText(JSON.stringify(' + escapeHtml(JSON.stringify(schema.example)) + ', null, 2)).then(()=>{this.textContent=\'Copied!\';setTimeout(()=>this.textContent=\'Copy to clipboard\',2000)})">Copy to clipboard</button>';

    html += '</section>';
    return html;
}

function renderFieldTable(fields) {
    let html = '<div class="overflow-x-auto"><table class="w-full text-sm border-collapse mb-4">';
    html += '<thead><tr class="border-b-2 border-black"><th class="text-left py-2 pr-3">Field</th><th class="text-left py-2 pr-3">Type</th><th class="text-left py-2 pr-3">Required</th><th class="text-left py-2 pr-3">Valid Values</th><th class="text-left py-2">Description</th></tr></thead>';
    html += '<tbody>';
    for (const field of fields) {
        const req = field.required ? '<span class="text-[#d4351c] font-bold">Yes</span>' : 'No';
        let values = '—';
        if (field.const) values = `<code>"${field.const}"</code>`;
        else if (field.enum) values = field.enum.map(v => `<span class="inline-block bg-gray-200 px-1.5 py-0.5 text-xs mr-1 mb-1">${v}</span>`).join('');

        let desc = field.description || '';
        if (field.enumDescriptions) {
            desc += '<dl class="mt-1 ml-2 text-xs text-gray-600">';
            for (const [val, explanation] of Object.entries(field.enumDescriptions)) {
                desc += `<dt class="font-bold mt-1">${val}</dt><dd class="ml-2">${explanation}</dd>`;
            }
            desc += '</dl>';
        }

        html += `<tr class="border-b border-gray-200 align-top"><td class="py-2 pr-3 font-mono text-xs font-bold whitespace-nowrap">${field.name}</td><td class="py-2 pr-3 text-xs">${field.type}${field.items ? `[${field.items}]` : ''}</td><td class="py-2 pr-3 text-xs">${req}</td><td class="py-2 pr-3 text-xs">${values}</td><td class="py-2 text-xs">${desc}</td></tr>`;
    }
    html += '</tbody></table></div>';
    return html;
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', renderPage);
