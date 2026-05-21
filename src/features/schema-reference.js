// ===================================================================
// SCHEMA REFERENCE COMPONENT
// ===================================================================
//
// Renders an in-app schema reference section for Stage 1 (Ingest).
// Shows the two accepted file types — Council Architecture File and
// Transition Configuration File — with structure summaries, links, and
// an expandable ITSystem field reference table.
//
// Usage: call renderSchemaReference() and inject the returned HTML
// string into the DOM.

import { SCHEMA_DEFINITIONS } from '../constants/schema-definitions.js';

// ===================================================================
// PUBLIC ENTRY POINT
// ===================================================================

export function renderSchemaReference() {
    const arch = SCHEMA_DEFINITIONS.architecture;
    const config = SCHEMA_DEFINITIONS.transitionConfig;

    let html = '<div class="border-t-4 border-[#0b0c0c] pt-6 mt-10">';
    html += '<h3 class="text-xl font-bold mb-2">Schema Reference</h3>';
    html += '<p class="text-sm text-gray-600 mb-6">Two file types are accepted. Each council uploads one architecture file; the transition config is shared across the programme.</p>';

    html += '<div class="grid grid-cols-1 md:grid-cols-2 gap-6">';
    html += renderSchemaCard(arch, 'lgr-architecture.schema.json', 'schema.html');
    html += renderSchemaCard(config, 'lgr-transition-config.schema.json', 'schema.html#transition-config');
    html += '</div>';

    html += '</div>';

    return html;
}

// ===================================================================
// SCHEMA CARD
// ===================================================================

function renderSchemaCard(schema, schemaFile, refLink) {
    const isArch = 'nodeTypes' in schema;
    const accentColour = isArch ? '#1d70b8' : '#00703c';
    const exampleJson = JSON.stringify(schema.example, null, 2);

    let html = `<div class="border border-[#b1b4b6] border-t-4 p-5 bg-white" style="border-top-color:${accentColour};">`;

    html += `<h4 class="text-base font-bold mb-1">${schema.title}</h4>`;
    html += `<p class="text-sm text-gray-600 mb-4">${schema.description}</p>`;

    html += '<div class="flex flex-wrap items-center gap-3 pt-3 border-t border-[#b1b4b6]">';
    html += `<a href="${refLink}" target="_blank" rel="noopener" class="text-sm text-[#1d70b8] underline font-bold hover:text-[#0b0c0c]">Full reference &#x2197;</a>`;
    html += `<a href="${schemaFile}" download class="text-sm text-[#1d70b8] underline hover:text-[#0b0c0c]">Download .schema.json</a>`;
    html += `<button class="gds-btn-secondary px-3 py-1 text-xs font-bold" type="button" data-copy-example="${encodeForAttr(exampleJson)}">Copy example</button>`;
    html += '</div>';

    html += '</div>';
    return html;
}

// ===================================================================
// ITSYSTEM FIELD REFERENCE TABLE
// ===================================================================

function renderFieldReference(nodeType) {
    const fields = nodeType.fields;
    const fieldCount = fields.length;

    let html = '<details class="border border-[#b1b4b6] bg-white">';
    html += `<summary class="cursor-pointer px-4 py-3 font-bold text-sm select-none hover:bg-[#f3f2f1] list-none flex items-center justify-between">`;
    html += `<span>ITSystem Field Reference <span class="text-gray-500 font-normal">(${fieldCount} fields)</span></span>`;
    html += '<span class="text-gray-400 text-xs font-normal" aria-hidden="true">Show / Hide</span>';
    html += '</summary>';

    html += '<div class="overflow-x-auto">';
    html += '<table class="w-full text-sm border-t border-[#b1b4b6]">';
    html += '<thead>';
    html += '<tr class="bg-[#f3f2f1] border-b-2 border-[#0b0c0c]">';
    html += '<th class="text-left py-2 px-3 font-bold whitespace-nowrap">Field</th>';
    html += '<th class="text-left py-2 px-3 font-bold whitespace-nowrap">Type</th>';
    html += '<th class="text-center py-2 px-3 font-bold whitespace-nowrap">Required</th>';
    html += '<th class="text-left py-2 px-3 font-bold">Valid Values</th>';
    html += '<th class="text-left py-2 px-3 font-bold">Description</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';

    for (const field of fields) {
        const isRequired = field.required === true;
        const rowClass = isRequired ? '' : '';

        html += `<tr class="border-b border-[#b1b4b6] ${rowClass}">`;

        // Field name
        if (isRequired) {
            html += `<td class="py-2 px-3 font-mono font-bold text-[#0b0c0c]">${field.name} <span class="text-[#d4351c]" aria-label="required">*</span></td>`;
        } else {
            html += `<td class="py-2 px-3 font-mono text-gray-600">${field.name}</td>`;
        }

        // Type
        let typeStr = field.type;
        if (field.items) typeStr += `&lt;${field.items}&gt;`;
        if (field.min !== undefined || field.max !== undefined) {
            const constraints = [];
            if (field.min !== undefined) constraints.push(`min ${field.min}`);
            if (field.max !== undefined) constraints.push(`max ${field.max}`);
            typeStr += ` <span class="text-gray-400 text-xs">(${constraints.join(', ')})</span>`;
        }
        html += `<td class="py-2 px-3 text-gray-700">${typeStr}</td>`;

        // Required
        if (isRequired) {
            html += '<td class="py-2 px-3 text-center"><span class="text-[#00703c] font-bold" aria-label="yes">&#10003;</span></td>';
        } else {
            html += '<td class="py-2 px-3 text-center text-gray-400" aria-label="no">&#8212;</td>';
        }

        // Valid values (enum)
        if (field.const) {
            html += `<td class="py-2 px-3"><span class="inline-block text-xs border border-[#b1b4b6] px-1.5 py-0.5 font-mono bg-[#f3f2f1]">"${field.const}"</span></td>`;
        } else if (field.enum && field.enum.length > 0) {
            const tags = field.enum.map(v =>
                `<span class="inline-block text-xs border border-[#b1b4b6] px-1.5 py-0.5 font-mono bg-[#f3f2f1] mr-1 mb-1">${v}</span>`
            ).join('');
            html += `<td class="py-2 px-3">${tags}</td>`;
        } else if (field.format) {
            html += `<td class="py-2 px-3 text-xs text-gray-500 italic">${field.format} format</td>`;
        } else {
            html += '<td class="py-2 px-3 text-gray-400">—</td>';
        }

        // Description
        html += `<td class="py-2 px-3 text-gray-700">${field.description}</td>`;

        html += '</tr>';
    }

    html += '</tbody>';
    html += '</table>';
    html += '</div>';
    html += '</details>';

    return html;
}

// ===================================================================
// HELPERS
// ===================================================================

/**
 * Encodes a string for use as an HTML attribute value.
 * Escapes double-quotes and angle brackets so the JSON string
 * can safely sit inside data-copy-example="...".
 */
function encodeForAttr(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
