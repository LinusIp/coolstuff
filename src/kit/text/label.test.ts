import { describe, expect, it } from 'vitest';
import { labelRuns } from './label';

describe('label runs', () => {
  it('keeps Greek letters out of small caps', () => {
    expect(labelRuns('Why det(A − λI) = 0')).toEqual([
      { text: 'Why det(A − ', math: false },
      { text: 'λ', math: true },
      { text: 'I) = 0', math: false },
    ]);
    expect(labelRuns('Why A² has eigenvalue λ²').filter((r) => r.math).map((r) => r.text)).toEqual(['λ']);
    expect(labelRuns('Definition')).toEqual([{ text: 'Definition', math: false }]);
  });
});
