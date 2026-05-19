import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { detectSameVendorConsolidation } from '../../src/analysis/signals.js';

describe('detectSameVendorConsolidation', () => {
    it('returns null for arrays with fewer than 2 systems', () => {
        expect(detectSameVendorConsolidation(null)).toBeNull();
        expect(detectSameVendorConsolidation([])).toBeNull();
        expect(detectSameVendorConsolidation([{ vendor: 'SAP' }])).toBeNull();
    });

    it('returns null when all systems are In-House', () => {
        const systems = [
            { vendor: 'In-House' },
            { vendor: 'In-House' },
            { vendor: 'In-House' }
        ];
        expect(detectSameVendorConsolidation(systems)).toBeNull();
    });

    it('returns non-null when all commercial systems share a vendor', () => {
        fc.assert(fc.property(
            fc.stringMatching(/^[A-Za-z]{2,15}$/).filter(v => v !== 'InHouse'),
            fc.integer({ min: 2, max: 8 }),
            (vendor, count) => {
                const systems = Array.from({ length: count }, () => ({ vendor }));
                const result = detectSameVendorConsolidation(systems);
                expect(result).not.toBeNull();
                expect(result.vendor).toBe(vendor);
                expect(result.count).toBe(count);
                expect(result.total).toBe(count);
                expect(result.isUnanimous).toBe(true);
            }
        ));
    });

    it('returns null when 3 distinct vendors with no supermajority', () => {
        const systems = [
            { vendor: 'SAP' },
            { vendor: 'Oracle' },
            { vendor: 'Civica' }
        ];
        expect(detectSameVendorConsolidation(systems)).toBeNull();
    });

    it('ignores In-House systems when computing vendor unanimity', () => {
        const systems = [
            { vendor: 'Civica' },
            { vendor: 'Civica' },
            { vendor: 'In-House' }
        ];
        const result = detectSameVendorConsolidation(systems);
        expect(result).not.toBeNull();
        expect(result.vendor).toBe('Civica');
        expect(result.total).toBe(2);
        expect(result.isUnanimous).toBe(true);
    });

    it('detects supermajority (>=75%) with 4+ systems', () => {
        const systems = [
            { vendor: 'NEC' },
            { vendor: 'NEC' },
            { vendor: 'NEC' },
            { vendor: 'Capita' }
        ];
        const result = detectSameVendorConsolidation(systems);
        expect(result).not.toBeNull();
        expect(result.vendor).toBe('NEC');
        expect(result.isUnanimous).toBe(false);
        expect(result.count).toBe(3);
        expect(result.total).toBe(4);
    });

    it('does not fire supermajority with fewer than 4 systems', () => {
        const systems = [
            { vendor: 'NEC' },
            { vendor: 'NEC' },
            { vendor: 'Capita' }
        ];
        expect(detectSameVendorConsolidation(systems)).toBeNull();
    });

    it('insight string always contains the vendor name', () => {
        fc.assert(fc.property(
            fc.stringMatching(/^[A-Za-z]{2,15}$/).filter(v => v !== 'InHouse'),
            fc.integer({ min: 2, max: 6 }),
            (vendor, count) => {
                const systems = Array.from({ length: count }, () => ({ vendor }));
                const result = detectSameVendorConsolidation(systems);
                if (result) {
                    expect(result.insight).toContain(vendor);
                    expect(result.insight.length).toBeGreaterThan(0);
                }
            }
        ));
    });

    it('isUnanimous implies count equals total', () => {
        fc.assert(fc.property(
            fc.stringMatching(/^[A-Za-z]{3,10}$/),
            fc.integer({ min: 2, max: 10 }),
            (vendor, count) => {
                const systems = Array.from({ length: count }, () => ({ vendor }));
                const result = detectSameVendorConsolidation(systems);
                if (result && result.isUnanimous) {
                    expect(result.count).toBe(result.total);
                }
            }
        ));
    });
});
