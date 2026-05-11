import { describe, it, expect } from 'vitest';
import { isValidTransition } from '../src/schemas/reports.js';
import type { ReportStatus } from '@fieldfix/shared';

describe('isValidTransition', () => {
  const cases: [ReportStatus, ReportStatus, boolean][] = [
    ['submitted', 'in_review', true],
    ['in_review', 'resolved', true],
    ['in_review', 'rejected', true],
    // Invalid transitions
    ['submitted', 'resolved', false],
    ['submitted', 'rejected', false],
    ['resolved', 'in_review', false],
    ['resolved', 'submitted', false],
    ['rejected', 'in_review', false],
    ['rejected', 'submitted', false],
    ['in_review', 'submitted', false],
  ];

  it.each(cases)('%s → %s is %s', (from, to, expected) => {
    expect(isValidTransition(from, to)).toBe(expected);
  });
});
