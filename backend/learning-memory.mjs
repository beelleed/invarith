import { canonical } from '../frontend/evidence-tools.mjs';
import { matchedPractice } from '../frontend/transfer-practice.mjs';

export function summarizeLearning(records) {
  const observations = [], excluded = records.filter(record => record.mentor?.prediction?.participation !== 'personal').length;
  for (const record of records) {
    const prediction = record.mentor?.prediction;
    if (prediction?.participation !== 'personal') continue;
    const result = record.evidence.results[prediction.caseIndex];
    if (!result) continue;
    const practice = matchedPractice(prediction.practiceId, record.submission);
    observations.push({ runId: record.evidence.id, functionName: record.submission.functionName, createdAt: record.evidence.createdAt || new Date(record.time).toISOString(), concept: practice?.concept || 'Predicting implementation behavior', practiceId: practice?.id || null, predictionMatched: result.status === 'error' ? null : canonical(prediction.value) === canonical(result.actual), executionStatus: result.status, explanationSaved: Boolean(record.mentor.answer?.trim()), reflections: Object.keys(record.mentor.feedback || {}).length });
  }
  const revisit = [...new Set(observations.filter(item => item.predictionMatched === false).map(item => item.concept))];
  return { consideredRuns: records.length, excludedRuns: excluded, personalAttempts: observations.length, matchingPredictions: observations.filter(item => item.predictionMatched === true).length, differingPredictions: observations.filter(item => item.predictionMatched === false).length, executionErrors: observations.filter(item => item.predictionMatched === null).length, explanationsSaved: observations.filter(item => item.explanationSaved).length, revisit, observations, note: 'Self-selected personal practice only. Demonstration, unclassified, and non-prediction runs are excluded. Matches describe observed execution, not code correctness or skill mastery. Review covers the latest 100 saved runs.' };
}
