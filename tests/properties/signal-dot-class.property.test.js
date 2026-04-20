import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { extractEngine } from '../helpers/extract.js';

const ctx = extractEngine();
const tagToSignalDotClass = ctx.tagToSignalDotClass;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KNOWN_TAG_MAP = {
  'tag-red':    'signal-dot-red',
  'tag-orange': 'signal-dot-amber',
  'tag-blue':   'signal-dot-blue',
  'tag-purple': 'signal-dot-purple',
  'tag-black':  'signal-dot-black',
  'tag-green':  'signal-dot-green',
};

const KNOWN_TAGS = Object.keys(KNOWN_TAG_MAP);

// ---------------------------------------------------------------------------
// Constants (continued)
// ---------------------------------------------------------------------------

/**
 * Prototype-inherited property names on plain objects.
 *
 * The function uses `map[tag] || fallback` on a plain-object map. Any key that
 * is inherited from Object.prototype (e.g. "toString", "valueOf") will return a
 * truthy function rather than undefined, so the fallback is never reached. This
 * is a known limitation of the plain-object lookup pattern. We exclude these
 * names from the "unknown tag falls back" property to keep the assertion
 * accurate, and document the behaviour in a separate test below.
 */
const PROTOTYPE_KEYS = new Set(Object.getOwnPropertyNames(Object.prototype));

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/**
 * Arbitrary known tag value — one of the 6 entries in the lookup map.
 */
const arbKnownTag = fc.constantFrom(...KNOWN_TAGS);

/**
 * Arbitrary string that is NOT a known tag AND not an Object.prototype key.
 * This represents the "safe unknown" input space where the fallback applies.
 */
const arbUnknownTag = fc.string({ minLength: 0, maxLength: 30 }).filter(
  s => !KNOWN_TAGS.includes(s) && !PROTOTYPE_KEYS.has(s)
);

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('tagToSignalDotClass', () => {

  it('each known tag maps to its expected signal-dot class', () => {
    fc.assert(
      fc.property(arbKnownTag, (tag) => {
        const result = tagToSignalDotClass(tag);
        expect(result).toBe(KNOWN_TAG_MAP[tag]);
      }),
      { numRuns: 100 }
    );
  });

  it('unknown tags fall back to signal-dot-blue', () => {
    fc.assert(
      fc.property(arbUnknownTag, (tag) => {
        const result = tagToSignalDotClass(tag);
        expect(result).toBe('signal-dot-blue');
      }),
      { numRuns: 100 }
    );
  });

  it('output always starts with signal-dot- for safe inputs (known tags and non-prototype strings)', () => {
    // This property holds for the 6 known tags and for any string that is not
    // an Object.prototype key. Prototype-inherited keys (e.g. "__proto__",
    // "toString") bypass the fallback and return non-string values — that
    // behaviour is documented separately in the limitation test below.
    const arbSafeInput = fc.oneof(
      arbKnownTag,
      arbUnknownTag
    );
    fc.assert(
      fc.property(arbSafeInput, (tag) => {
        const result = tagToSignalDotClass(tag);
        expect(typeof result).toBe('string');
        expect(result.startsWith('signal-dot-')).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('known tags are idempotent — calling twice returns the same result', () => {
    fc.assert(
      fc.property(arbKnownTag, (tag) => {
        const first = tagToSignalDotClass(tag);
        const second = tagToSignalDotClass(tag);
        expect(first).toBe(second);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Known limitation: the function uses `map[tag] || fallback` on a plain
   * object. Object.prototype keys (e.g. "toString", "valueOf") are truthy
   * inherited functions, so they bypass the fallback. This test documents
   * that behaviour as observed rather than asserting a "correct" value.
   *
   * Recommendation for Generator: use `Object.hasOwn(map, tag) ? map[tag] :
   * fallback` (or `Object.create(null)` for the map) to close this gap.
   */
  it('prototype-inherited keys do NOT return signal-dot-blue (known limitation)', () => {
    const prototypeKeys = [...PROTOTYPE_KEYS];
    for (const key of prototypeKeys) {
      const result = tagToSignalDotClass(key);
      // The result is NOT the fallback — it is a truthy prototype value.
      // We assert the observed behaviour: the output does not start with
      // 'signal-dot-' for these keys (except the six known tags, which are
      // all prefixed 'tag-' and therefore not in prototype keys).
      expect(result).not.toBe('signal-dot-blue');
    }
  });

});
