import { canonical } from './evidence-tools.mjs';
export const regressionScope = submission => canonical({functionName:submission.functionName,intent:(submission.intent || '').trim(),cases:submission.cases});
export const matchesRegression = (submission,source) => regressionScope(submission) === regressionScope(source.submission);
