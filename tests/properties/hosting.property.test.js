import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getHostingType, isNonCloud, isCloud, detectHostingRisk } from '../../src/analysis/hosting.js';

describe('getHostingType', () => {
    it('returns hosting field when present', () => {
        expect(getHostingType({ hosting: 'cloud' })).toBe('cloud');
        expect(getHostingType({ hosting: 'on-premise' })).toBe('on-premise');
        expect(getHostingType({ hosting: 'partner-hosted' })).toBe('partner-hosted');
    });

    it('returns null when hosting not set', () => {
        expect(getHostingType({})).toBe(null);
        expect(getHostingType({ vendor: 'SAP' })).toBe(null);
    });
});

describe('isNonCloud', () => {
    it('true for on-premise', () => {
        expect(isNonCloud({ hosting: 'on-premise' })).toBe(true);
    });

    it('true for partner-hosted', () => {
        expect(isNonCloud({ hosting: 'partner-hosted' })).toBe(true);
    });

    it('false for cloud', () => {
        expect(isNonCloud({ hosting: 'cloud' })).toBe(false);
    });

    it('false for null hosting', () => {
        expect(isNonCloud({})).toBe(false);
    });

});

describe('isCloud', () => {
    it('true only for cloud hosting', () => {
        expect(isCloud({ hosting: 'cloud' })).toBe(true);
        expect(isCloud({ hosting: 'on-premise' })).toBe(false);
        expect(isCloud({ hosting: 'partner-hosted' })).toBe(false);
        expect(isCloud({})).toBe(false);
    });
});

describe('detectHostingRisk', () => {
    const makeMap = (entries) => new Map(entries);

    it('returns null for non-partner-hosted systems', () => {
        expect(detectHostingRisk({ hosting: 'cloud' }, makeMap([]))).toBe(null);
        expect(detectHostingRisk({ hosting: 'on-premise' }, makeMap([]))).toBe(null);
    });

    it('returns null when hostingPartner is not set', () => {
        expect(detectHostingRisk({ hosting: 'partner-hosted' }, makeMap([]))).toBe(null);
    });

    it('returns governance risk for external partner (not in merger)', () => {
        const system = { hosting: 'partner-hosted', hostingPartner: 'External Council', _sourceCouncil: 'My Council' };
        const map = makeMap([['My Council', ['North Unitary']]]);
        const result = detectHostingRisk(system, map);
        expect(result.risk).toBe('governance');
        expect(result.detail).toContain('External Council');
        expect(result.detail).toContain('external to this merger');
    });

    it('returns continuity risk when partner maps to different successor', () => {
        const system = { hosting: 'partner-hosted', hostingPartner: 'Partner County', _sourceCouncil: 'My District' };
        const map = makeMap([
            ['My District', ['South Unitary']],
            ['Partner County', ['North Unitary']]
        ]);
        const result = detectHostingRisk(system, map);
        expect(result.risk).toBe('continuity');
        expect(result.detail).toContain('different successor');
        expect(result.detail).toContain('Day 1');
    });

    it('returns none when partner maps to same successor', () => {
        const system = { hosting: 'partner-hosted', hostingPartner: 'Partner County', _sourceCouncil: 'My District' };
        const map = makeMap([
            ['My District', ['North Unitary']],
            ['Partner County', ['North Unitary']]
        ]);
        const result = detectHostingRisk(system, map);
        expect(result.risk).toBe('none');
    });

    it('property: risk is always one of none/continuity/governance for partner-hosted with partner set', () => {
        const arbCouncilName = fc.string({ minLength: 3, maxLength: 15 });
        fc.assert(fc.property(
            arbCouncilName, arbCouncilName, fc.array(arbCouncilName, { minLength: 0, maxLength: 3 }),
            (source, partner, successorNames) => {
                const system = { hosting: 'partner-hosted', hostingPartner: partner, _sourceCouncil: source };
                const map = new Map();
                if (successorNames.length > 0) {
                    map.set(source, [successorNames[0]]);
                    if (successorNames.length > 1) {
                        map.set(partner, [successorNames[1]]);
                    }
                }
                const result = detectHostingRisk(system, map);
                expect(result).not.toBe(null);
                expect(['none', 'continuity', 'governance']).toContain(result.risk);
            }
        ), { numRuns: 100 });
    });
});
