import { LGA_FUNCTIONS } from './constants/lga-functions.js';

export function getLgaFunction(id) {
    return LGA_FUNCTIONS.find(f => f.id === id);
}

export function getLgaBreadcrumb(id) {
    const fn = getLgaFunction(id);
    if (!fn || !fn.parentId) return null;
    const parent = getLgaFunction(fn.parentId);
    if (!parent || !parent.parentId) return null; // direct child of root — label is self-explanatory
    return parent.label + ' › ' + fn.label;
}

export function getRootCategoryId(id) {
    let fn = LGA_FUNCTIONS.find(f => f.id === id);
    if (!fn) return null;
    while (fn.parentId !== null) {
        const parent = LGA_FUNCTIONS.find(f => f.id === fn.parentId);
        if (!parent) break;
        fn = parent;
    }
    return fn.id;
}

export function getDescendantIds(rootId) {
    const descendants = new Set();
    function collect(parentId) {
        LGA_FUNCTIONS.filter(f => f.parentId === parentId).forEach(f => {
            descendants.add(f.id);
            collect(f.id);
        });
    }
    collect(rootId);
    return descendants;
}

export function getRootCategories() {
    return LGA_FUNCTIONS.filter(f => f.parentId === null);
}
