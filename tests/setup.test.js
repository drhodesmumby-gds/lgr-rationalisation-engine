import { describe, it, expect } from 'vitest';
import { LGA_FUNCTIONS } from '../src/constants/lga-functions.js';
import { getLgaFunction, getLgaBreadcrumb } from '../src/taxonomy.js';
import { SIGNAL_DEFS, PERSONA_DEFAULT_WEIGHTS } from '../src/constants/signals.js';

describe('test infrastructure', () => {
  it('vitest runs a trivial test', () => {
    expect(1 + 1).toBe(2);
  });

  it('LGA_FUNCTIONS has 176 entries', () => {
    expect(LGA_FUNCTIONS).toBeDefined();
    expect(Array.isArray(LGA_FUNCTIONS)).toBe(true);
    expect(LGA_FUNCTIONS.length).toBe(176);
  });

  it('getLgaFunction and getLgaBreadcrumb are functions', () => {
    expect(typeof getLgaFunction).toBe('function');
    expect(typeof getLgaBreadcrumb).toBe('function');
  });

  it('SIGNAL_DEFS and PERSONA_DEFAULT_WEIGHTS exist and have expected shape', () => {
    expect(SIGNAL_DEFS).toBeDefined();
    expect(Array.isArray(SIGNAL_DEFS)).toBe(true);
    expect(PERSONA_DEFAULT_WEIGHTS).toBeDefined();
    expect(PERSONA_DEFAULT_WEIGHTS.executive).toBeDefined();
  });
});
