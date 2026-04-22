export function wrapWithTooltip(text, tooltipContent) {
    const safe = tooltipContent.replace(/"/g, '&quot;');
    return `<span class="tooltip-wrapper tooltip-label" tabindex="0" aria-label="${safe}">${text}<span class="tooltip-content">${tooltipContent}</span></span>`;
}

export function helpIcon(docKey) {
    return `<span class="inline-flex items-center justify-center w-4 h-4 text-xs rounded-full border border-[#505a5f] text-[#505a5f] hover:text-[#1d70b8] hover:border-[#1d70b8] cursor-pointer ml-1 align-middle" onclick="openDocModal('${docKey}')" title="Learn more">?</span>`;
}

export function escHtml(str) {
    if (str == null) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
