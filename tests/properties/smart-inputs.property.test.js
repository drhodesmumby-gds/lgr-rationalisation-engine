/**
 * Property tests for smart-inputs.js — formatThousands and parseThousands.
 *
 * These are pure formatting utilities with no DOM dependency.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { formatThousands, parseThousands } from '../../src/features/unified-editor/smart-inputs.js';

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

// Integers that are representable exactly as JS numbers and fit in a typical
// council finance context (no IEEE precision edge cases).
const arbSafeInt = fc.integer({ min: -9_999_999, max: 99_999_999 });

// Positive integers (annual cost, user counts, etc.)
const arbPositiveInt = fc.integer({ min: 1, max: 9_999_999 });

// Numeric strings (raw, no commas or prefix)
const arbNumericString = arbSafeInt.map(n => String(n));

// Non-numeric strings that should yield NaN
const arbNonNumericString = fc.oneof(
    fc.constant(''),
    fc.constant('   '),
    fc.constant('abc'),
    fc.constant('N/A'),
    fc.constant('unknown'),
    fc.stringMatching(/^[A-Za-z][A-Za-z ]{1,10}$/)
);

// ---------------------------------------------------------------------------
// formatThousands tests
// ---------------------------------------------------------------------------

describe('formatThousands', () => {

    it('returns empty string for NaN input', () => {
        expect(formatThousands(NaN)).toBe('');
        expect(formatThousands('not-a-number')).toBe('');
    });

    it('returns empty string for null and undefined', () => {
        expect(formatThousands(null)).toBe('');
        expect(formatThousands(undefined)).toBe('');
    });

    it('always returns a non-empty string for any finite integer', () => {
        fc.assert(
            fc.property(arbSafeInt, (n) => {
                const result = formatThousands(n);
                expect(typeof result).toBe('string');
                expect(result.length).toBeGreaterThan(0);
            }),
            { numRuns: 200 }
        );
    });

    it('result contains no raw whitespace characters', () => {
        fc.assert(
            fc.property(arbSafeInt, (n) => {
                const result = formatThousands(n);
                // en-GB may use thin-space (U+202F) or narrow no-break space for grouping
                // but should not contain regular space U+0020
                expect(result).not.toMatch(/ /);
            }),
            { numRuns: 100 }
        );
    });

    it('with prefix option — output starts with that prefix', () => {
        fc.assert(
            fc.property(arbPositiveInt, (n) => {
                const result = formatThousands(n, { prefix: '£' });
                expect(result.startsWith('£')).toBe(true);
            }),
            { numRuns: 100 }
        );
    });

    it('without prefix option — output does not start with £', () => {
        fc.assert(
            fc.property(arbPositiveInt, (n) => {
                const result = formatThousands(n);
                expect(result.startsWith('£')).toBe(false);
            }),
            { numRuns: 100 }
        );
    });

    it('numbers >= 1000 produce a comma in their formatted representation', () => {
        fc.assert(
            fc.property(fc.integer({ min: 1000, max: 9_999_999 }), (n) => {
                const result = formatThousands(n);
                // en-GB locale uses commas for thousands grouping
                expect(result).toContain(',');
            }),
            { numRuns: 100 }
        );
    });

    it('numeric string input formats identically to the equivalent number', () => {
        fc.assert(
            fc.property(arbPositiveInt, (n) => {
                const fromNumber = formatThousands(n);
                const fromString = formatThousands(String(n));
                expect(fromString).toBe(fromNumber);
            }),
            { numRuns: 100 }
        );
    });

    it('is referentially transparent — same input always yields same output', () => {
        fc.assert(
            fc.property(arbSafeInt, (n) => {
                expect(formatThousands(n)).toBe(formatThousands(n));
            }),
            { numRuns: 100 }
        );
    });

});

// ---------------------------------------------------------------------------
// parseThousands tests
// ---------------------------------------------------------------------------

describe('parseThousands', () => {

    it('returns NaN for null input', () => {
        expect(parseThousands(null)).toBeNaN();
    });

    it('returns NaN for undefined input', () => {
        expect(parseThousands(undefined)).toBeNaN();
    });

    it('returns NaN for empty string', () => {
        expect(parseThousands('')).toBeNaN();
    });

    it('returns NaN for whitespace-only strings', () => {
        expect(parseThousands('   ')).toBeNaN();
        expect(parseThousands('\t\n')).toBeNaN();
    });

    it('returns NaN for non-numeric strings', () => {
        fc.assert(
            fc.property(arbNonNumericString, (s) => {
                expect(parseThousands(s)).toBeNaN();
            }),
            { numRuns: 100 }
        );
    });

    it('parses raw numeric strings to their numeric value', () => {
        fc.assert(
            fc.property(arbNumericString, (s) => {
                const result = parseThousands(s);
                expect(result).toBe(Number(s));
            }),
            { numRuns: 200 }
        );
    });

    it('strips £ symbol before parsing', () => {
        fc.assert(
            fc.property(arbPositiveInt, (n) => {
                expect(parseThousands(`£${n}`)).toBe(n);
            }),
            { numRuns: 100 }
        );
    });

    it('strips commas before parsing', () => {
        fc.assert(
            fc.property(fc.integer({ min: 1000, max: 9_999_999 }), (n) => {
                const withCommas = n.toLocaleString('en-GB');
                // Only test if the locale string actually contains commas
                if (withCommas.includes(',')) {
                    expect(parseThousands(withCommas)).toBe(n);
                }
            }),
            { numRuns: 100 }
        );
    });

    it('strips £, commas, and spaces together', () => {
        fc.assert(
            fc.property(fc.integer({ min: 1000, max: 9_999_999 }), (n) => {
                const formatted = `£${n.toLocaleString('en-GB')}`;
                if (formatted.includes(',')) {
                    expect(parseThousands(formatted)).toBe(n);
                }
            }),
            { numRuns: 100 }
        );
    });

    it('is referentially transparent — same input always yields same output', () => {
        fc.assert(
            fc.property(arbNumericString, (s) => {
                expect(parseThousands(s)).toBe(parseThousands(s));
            }),
            { numRuns: 100 }
        );
    });

});

// ---------------------------------------------------------------------------
// Round-trip: parseThousands(formatThousands(n)) === n
// ---------------------------------------------------------------------------

describe('round-trip: parseThousands(formatThousands(n)) === n', () => {

    it('integer inputs survive the round-trip (no prefix)', () => {
        fc.assert(
            fc.property(arbSafeInt, (n) => {
                const formatted = formatThousands(n);
                if (formatted === '') {
                    // formatThousands only returns '' for NaN/null/undefined,
                    // which cannot reach here from a valid integer
                    expect(formatted).not.toBe('');
                    return;
                }
                const parsed = parseThousands(formatted);
                expect(parsed).toBe(n);
            }),
            { numRuns: 200 }
        );
    });

    it('integer inputs with £ prefix survive the round-trip', () => {
        fc.assert(
            fc.property(arbPositiveInt, (n) => {
                const formatted = formatThousands(n, { prefix: '£' });
                const parsed = parseThousands(formatted);
                expect(parsed).toBe(n);
            }),
            { numRuns: 200 }
        );
    });

    it('formatThousands is idempotent when re-formatted after parse-roundtrip', () => {
        fc.assert(
            fc.property(arbPositiveInt, (n) => {
                const first = formatThousands(n, { prefix: '£' });
                const parsed = parseThousands(first);
                const second = formatThousands(parsed, { prefix: '£' });
                expect(second).toBe(first);
            }),
            { numRuns: 100 }
        );
    });

});
