import { describe, it, expect } from 'vitest';
import { parseAllowlist, isManagerIdentity } from './roles.js';

describe('parseAllowlist', () => {
  it('splits, trims, lower-cases and drops blanks', () => {
    expect(parseAllowlist(' Jason Roberts , John Babb ,')).toEqual(['jason roberts', 'john babb']);
    expect(parseAllowlist('')).toEqual([]);
    expect(parseAllowlist(undefined)).toEqual([]);
  });
});

describe('isManagerIdentity', () => {
  const names = parseAllowlist('Jason Roberts, John Babb');
  const emails = parseAllowlist('jason@nexian.co.uk');

  it('matches by name, case-insensitively', () => {
    expect(isManagerIdentity({ name: 'jason roberts' }, { names })).toBe(true);
    expect(isManagerIdentity({ name: 'John Babb' }, { names })).toBe(true);
  });

  it('matches by email', () => {
    expect(isManagerIdentity({ email: 'JASON@nexian.co.uk' }, { emails })).toBe(true);
  });

  it('rejects non-managers and empty identities', () => {
    expect(isManagerIdentity({ name: 'Alice' }, { names, emails })).toBe(false);
    expect(isManagerIdentity({ name: '', email: '' }, { names, emails })).toBe(false);
    expect(isManagerIdentity({}, { names: [], emails: [] })).toBe(false);
  });
});
