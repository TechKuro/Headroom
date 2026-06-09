import { describe, it, expect } from 'vitest';
import { safeJson } from './anthropic.js';

describe('safeJson', () => {
  it('parses a clean JSON object', () => {
    expect(safeJson('{"score":7,"ragStatus":"green"}')).toEqual({ score: 7, ragStatus: 'green' });
  });
  it('strips code fences', () => {
    expect(safeJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it('extracts the object from surrounding prose', () => {
    expect(safeJson('Here you go: {"a":1, "b":"x"} — hope that helps')).toEqual({ a: 1, b: 'x' });
  });
  it('returns null on unparseable input', () => {
    expect(safeJson('not json at all')).toBeNull();
    expect(safeJson('')).toBeNull();
    expect(safeJson(null)).toBeNull();
  });
});
