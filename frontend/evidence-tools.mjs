export const challengePacks = {
  search: {
    contract: 'Return the first index of the target in a sorted array of integers, or -1 if absent.',
    cases: [
      { args: [[1, 3, 5], 5], expected: 2, reason: 'The final remaining candidate must be checked.' },
      { args: [[5], 5], expected: 0, reason: 'A single-element array can contain the target.' },
      { args: [[1, 1, 1], 1], expected: 0, reason: 'Duplicate matches must return the first index.' },
      { args: [[], 1], expected: -1, reason: 'An empty array has no match.' },
    ],
  },
  average: {
    contract: 'Return the arithmetic mean of a numeric list. Return 0 for an empty list.',
    cases: [
      { args: [[]], expected: 0, reason: 'Empty input must follow the explicit zero-value contract.' },
      { args: [[-6, -2]], expected: -4, reason: 'Negative numbers must retain their sign.' },
      { args: [[0, 0]], expected: 0, reason: 'A non-empty zero list is a valid input.' },
    ],
  },
  first_even: {
    contract: 'Return the first even integer in list order, or None when there is none.',
    cases: [
      { args: [[1, 3, 8]], expected: 8, reason: 'The last position must be inspected.' },
      { args: [[4]], expected: 4, reason: 'A single-item list still has one candidate.' },
      { args: [[]], expected: null, reason: 'An empty list has no even number.' },
      { args: [[-3, -2]], expected: -2, reason: 'Negative even integers also qualify.' },
    ],
  },
  is_palindrome: {
    contract: 'Ignore letter case and literal space characters, then check whether the text reads the same in reverse. Empty text is a palindrome.',
    cases: [
      { args: ['nurses run'], expected: true, reason: 'A space must not change a palindrome result.' },
      { args: ['A ba'], expected: true, reason: 'Case and space normalization must work together.' },
      { args: [''], expected: true, reason: 'The empty string equals its own reverse.' },
    ],
  },
};

// Object key order is irrelevant, but argument order and expected values matter.
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const caseKey = item => canonical({ args: item.args, kwargs: item.kwargs || {}, expected: item.expected });

export function appendChallenge(cases, pack) {
  if (!Array.isArray(cases)) throw new Error('Test cases must be a JSON array.');
  const keys = new Set(cases.map(caseKey));
  const added = pack.cases.filter(item => !keys.has(caseKey(item))).map(({ args, expected }) => ({ args, expected }));
  if (cases.length + added.length > 20) throw new Error('These edge cases would exceed the 20-case limit. Remove some cases first.');
  return { cases: [...cases, ...added], added: added.length };
}

function indexed(record) {
  const occurrences = new Map();
  return record.submission.cases.map((item, i) => {
    const key = caseKey(item), occurrence = occurrences.get(key) || 0;
    occurrences.set(key, occurrence + 1);
    return { key: `${key}#${occurrence}`, item, result: record.evidence.results[i], index: i };
  });
}

export function compareRuns(before, after) {
  if (before.submission.functionName !== after.submission.functionName || (before.submission.intent || '').trim() !== (after.submission.intent || '').trim()) return { compatible: false, rows: [], fixed: 0, regressed: 0, added: 0, removed: 0, shared: 0 };
  const oldRows = indexed(before), newRows = indexed(after), oldMap = new Map(oldRows.map(r => [r.key, r]));
  const rows = newRows.map(row => {
    const previous = oldMap.get(row.key);
    oldMap.delete(row.key);
    let transition = 'added';
    if (previous) transition = previous.result.status !== 'passed' && row.result.status === 'passed' ? 'fixed' : previous.result.status === 'passed' && row.result.status !== 'passed' ? 'regressed' : row.result.status === 'passed' ? 'passing' : 'unresolved';
    return { ...row, previous: previous?.result, transition };
  });
  for (const row of oldMap.values()) rows.push({ ...row, previous: row.result, result: undefined, transition: 'removed' });
  return { compatible: true, rows, fixed: rows.filter(r => r.transition === 'fixed').length, regressed: rows.filter(r => r.transition === 'regressed').length, added: rows.filter(r => r.transition === 'added').length, removed: oldMap.size, shared: rows.filter(r => !['added', 'removed'].includes(r.transition)).length };
}

// A valid contiguous-block diff with surrounding context; no claim of minimal edits.
export function codeDiff(before, after) {
  const a = before.split('\n'), b = after.split('\n');
  let head = 0, tail = 0;
  while (head < Math.min(a.length, b.length) && a[head] === b[head]) head++;
  if (head === a.length && head === b.length) return [];
  while (tail < Math.min(a.length, b.length) - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  return [
    ...a.slice(Math.max(0, head - 2), head).map(text => ({ kind: 'context', text })),
    ...a.slice(head, a.length - tail).map(text => ({ kind: 'removed', text })),
    ...b.slice(head, b.length - tail).map(text => ({ kind: 'added', text })),
    ...b.slice(b.length - tail, b.length - tail + 2).map(text => ({ kind: 'context', text })),
  ];
}
