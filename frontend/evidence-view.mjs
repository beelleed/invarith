import { canonical, compareRuns } from './evidence-tools.mjs';

export const callLabel = (submission, item) => `${submission.functionName}(${[...(item.args || []).map(value => JSON.stringify(value)), ...Object.entries(item.kwargs || {}).map(([key, value]) => `${key}=${JSON.stringify(value)}`)].join(', ')})`;
export const outputLabel = value => value === null ? 'null' : JSON.stringify(value, null, 2) ?? 'No return value recorded';
export function sameTask(a, b) { return (a.codeLanguage||'python')===(b.codeLanguage||'python') && a.functionName === b.functionName && (a.intent || '').trim() === (b.intent || '').trim(); }
export function repairProgress(baseline, latest, current) {
  if (!latest) return 'not_run';
  if (!current || canonical(current) !== canonical(latest.submission)) return 'edited';
  if (baseline && sameTask(baseline.submission, latest.submission)) {
    const compared = compareRuns(baseline, latest);
    if (compared.added || compared.removed) return 'suite_changed';
    if (compared.fixed && !compared.regressed && latest.evidence.results.every(row => row.status === 'passed')) return 'repaired';
  }
  return latest.evidence.results.every(row => row.status === 'passed') ? 'passed' : 'failing';
}
