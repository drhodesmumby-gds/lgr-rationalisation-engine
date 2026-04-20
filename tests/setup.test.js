import { describe, it, expect } from 'vitest';
import { extractEngine } from './helpers/extract.js';

describe('test infrastructure', () => {
  it('vitest runs a trivial test', () => {
    expect(1 + 1).toBe(2);
  });

  it('extractEngine() loads the HTML script block', () => {
    const ctx = extractEngine();
    // The engine defines LGA_FUNCTIONS as a const array with 176 entries
    expect(ctx.LGA_FUNCTIONS).toBeDefined();
    expect(Array.isArray(ctx.LGA_FUNCTIONS)).toBe(true);
    expect(ctx.LGA_FUNCTIONS.length).toBe(176);
  });

  it('extractEngine() exposes top-level functions', () => {
    const ctx = extractEngine();
    // getLgaFunction is defined as a top-level function in the script block
    expect(typeof ctx.getLgaFunction).toBe('function');
    expect(typeof ctx.getLgaBreadcrumb).toBe('function');
  });

  it('extractEngine() exposes signal definitions and persona weights', () => {
    const ctx = extractEngine();
    expect(ctx.SIGNAL_DEFS).toBeDefined();
    expect(Array.isArray(ctx.SIGNAL_DEFS)).toBe(true);
    expect(ctx.PERSONA_DEFAULT_WEIGHTS).toBeDefined();
    expect(ctx.PERSONA_DEFAULT_WEIGHTS.executive).toBeDefined();
  });
});
