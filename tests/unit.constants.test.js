import { describe, it, expect } from 'vitest';
import { LGA_FUNCTIONS } from '../src/constants/lga-functions.js';
import { DEFAULT_TIER_MAP } from '../src/constants/tier-map.js';

describe('Constants Configuration', () => {
  it('should have shared-capabilities in taxonomy', () => {
    const sharedCap = LGA_FUNCTIONS.find(f => f.id === 'shared-capabilities');
    expect(sharedCap).toBeDefined();
    expect(sharedCap.label).toBe('Shared Technical Capabilities');
    expect(sharedCap.parentId).toBeNull();
  });

  it('should treat shared-capabilities as Tier 1', () => {
    expect(DEFAULT_TIER_MAP.get('shared-capabilities')).toBe(1);
  });
});
