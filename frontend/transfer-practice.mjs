import { canonical } from './evidence-tools.mjs';

export const transferPractices = [
  {
    id: 'seat-capacity', title: 'New context: reserving the final seat', concept: 'Inclusive boundaries',
    intent: 'Return True when requested seats is positive and does not exceed capacity. Otherwise return False. Inputs are non-negative integers. Reserving exactly the full capacity is allowed.',
    functionName: 'can_reserve',
    code: 'def can_reserve(capacity, requested):\n    return requested > 0 and requested < capacity\n',
    cases: [{ args: [8,8], expected: true }, { args: [8,7], expected: true }, { args: [8,9], expected: false }, { args: [8,0], expected: false }],
  },
  {
    id: 'last-positive', title: 'New context: checking every measurement', concept: 'Loop coverage',
    intent: 'Return True if any integer measurement is positive, otherwise return False. Inspect every list position. An empty list returns False.',
    functionName: 'has_positive',
    code: 'def has_positive(measurements):\n    for i in range(len(measurements) - 1):\n        if measurements[i] > 0:\n            return True\n    return False\n',
    cases: [{ args: [[-2,0,5]], expected: true }, { args: [[5,-2,0]], expected: true }, { args: [[-2,0]], expected: false }, { args: [[]], expected: false }],
  },
];

export function matchedPractice(id, submission) {
  const practice = transferPractices.find(item => item.id === id);
  return practice && practice.functionName === submission.functionName && practice.intent === submission.intent && canonical(practice.cases) === canonical(submission.cases) ? practice : null;
}
