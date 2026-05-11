import { describe, it, expect } from 'vitest';

// Mirrors the FSM defined in all three server variants
const ALLOWED: Record<string, string[]> = {
  submitted: ['in_review'],
  in_review: ['resolved', 'rejected'],
  resolved: [],
  rejected: [],
};

function canTransition(from: string, to: string): boolean {
  return (ALLOWED[from] ?? []).includes(to);
}

describe('status FSM — valid transitions', () => {
  it('submitted → in_review', () => {
    expect(canTransition('submitted', 'in_review')).toBe(true);
  });

  it('in_review → resolved', () => {
    expect(canTransition('in_review', 'resolved')).toBe(true);
  });

  it('in_review → rejected', () => {
    expect(canTransition('in_review', 'rejected')).toBe(true);
  });
});

describe('status FSM — invalid transitions', () => {
  it('submitted cannot go directly to resolved', () => {
    expect(canTransition('submitted', 'resolved')).toBe(false);
  });

  it('submitted cannot go directly to rejected', () => {
    expect(canTransition('submitted', 'rejected')).toBe(false);
  });

  it('resolved is a terminal state', () => {
    expect(canTransition('resolved', 'in_review')).toBe(false);
    expect(canTransition('resolved', 'rejected')).toBe(false);
    expect(canTransition('resolved', 'submitted')).toBe(false);
  });

  it('rejected is a terminal state', () => {
    expect(canTransition('rejected', 'in_review')).toBe(false);
    expect(canTransition('rejected', 'resolved')).toBe(false);
    expect(canTransition('rejected', 'submitted')).toBe(false);
  });

  it('unknown status returns false', () => {
    expect(canTransition('unknown', 'in_review')).toBe(false);
  });

  it('cannot self-loop', () => {
    expect(canTransition('submitted', 'submitted')).toBe(false);
    expect(canTransition('in_review', 'in_review')).toBe(false);
  });
});
