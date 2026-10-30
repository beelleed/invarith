import { canonical, compareRuns } from './evidence-tools.mjs';

export const deliveryDemo = {
  intent: 'Return a delivery fee of 0 for an order total of 500 or more; otherwise return 60. Inputs are non-negative integer order totals.',
  functionName: 'delivery_fee',
  code: 'def delivery_fee(order_total):\n    if order_total > 500:\n        return 0\n    return 60\n',
  cases: [499, 500, 501].map(total => ({ args: [total], expected: total >= 500 ? 0 : 60 })),
};

export function matchesDeliverySuite(submission) {
  return submission.functionName === deliveryDemo.functionName && submission.intent === deliveryDemo.intent && canonical(submission.cases) === canonical(deliveryDemo.cases);
}

export function repairOutcome(before, after) {
  if (!before || !after || !matchesDeliverySuite(before.submission) || !matchesDeliverySuite(after.submission)) return null;
  const comparison = compareRuns(before, after);
  return { fixed: comparison.fixed, complete: comparison.fixed > 0 && after.evidence.results.every(row => row.status === 'passed') };
}
