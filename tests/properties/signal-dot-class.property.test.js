import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { tagToSignalDotClass } from '../../src/ui-helpers.js';

const KNOWN_TAG_MAP = {
  'tag-red':    'signal-dot-red',
  'tag-orange': 'signal-dot-amber',
  'tag-blue':   'signal-dot-blue',
  'tag-purple': 'signal-dot-purple',
  'tag-black':  'signal-dot-black',
  'tag-green':  'signal-dot-green',
};

const KNOWN_TAGS = Object.keys(KNOWN_TAG_MAP);

const arbKnownTag = fc.constantFrom(...KNOWN_TAGS);

const arbUnknownTag = fc.string({ minLength: 0, maxLength: 30 }).filter(
  s => !KNOWN_TAGS.includes(s)
);

describe('tagToSignalDotClass', () => {

  it('each known tag maps to its expected signal-dot class', () => {
    fc.assert(
      fc.property(arbKnownTag, (tag) => {
        expect(tagToSignalDotClass(tag)).toBe(KNOWN_TAG_MAP[tag]);
      }),
      { numRuns: 100 }
    );
  });

  it('unknown tags fall back to signal-dot-blue', () => {
    fc.assert(
      fc.property(arbUnknownTag, (tag) => {
        expect(tagToSignalDotClass(tag)).toBe('signal-dot-blue');
      }),
      { numRuns: 100 }
    );
  });

  it('output always starts with signal-dot-', () => {
    const arbAnyInput = fc.oneof(arbKnownTag, arbUnknownTag);
    fc.assert(
      fc.property(arbAnyInput, (tag) => {
        const result = tagToSignalDotClass(tag);
        expect(typeof result).toBe('string');
        expect(result.startsWith('signal-dot-')).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(arbKnownTag, (tag) => {
        expect(tagToSignalDotClass(tag)).toBe(tagToSignalDotClass(tag));
      }),
      { numRuns: 100 }
    );
  });

  it('prototype-inherited keys correctly fall back (Object.create(null) map)', () => {
    const protoKeys = ['toString', 'valueOf', 'constructor', '__proto__'];
    for (const key of protoKeys) {
      expect(tagToSignalDotClass(key)).toBe('signal-dot-blue');
    }
  });
});
