import { LGA_FUNCTIONS } from './constants/lga-functions.js';

export function getLgaFunction(id) {
    return LGA_FUNCTIONS.find(f => f.id === id);
}

export function getLgaBreadcrumb(id) {
    const fn = getLgaFunction(id);
    if (!fn || !fn.parentId) return null;
    const parent = getLgaFunction(fn.parentId);
    if (!parent || !parent.parentId) return null; // direct child of root — label is self-explanatory
    return parent.label + ' \u203a ' + fn.label;
}
