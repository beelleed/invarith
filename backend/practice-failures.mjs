import {createHash} from 'node:crypto';
import {AppError} from './verification.mjs';
import {assessmentReviewFingerprint} from './assessment-review.mjs';

export function savedPracticeFailure(session,body){
  if(!['examples','submit'].includes(body.action)||typeof body.code!=='string'||!body.code.trim()||body.code.length>24000||typeof body.createdAt!=='string'||!Number.isFinite(Date.parse(body.createdAt)))throw new AppError(400,'Choose a saved failing result before tracing.');
  const fingerprint=assessmentReviewFingerprint(session),reviewDay=session.assessmentReview&&body.action==='submit'?new Date(body.createdAt).toISOString().slice(0,10):null;
  const key=createHash('sha256').update(JSON.stringify([session.id,body.action,body.code,fingerprint,reviewDay])).digest('hex'),report=session.reports?.[key],cases=body.action==='submit'?session.hidden:session.examples,failure=report?.firstFailure;
  if(!report||report.createdAt!==body.createdAt||report.total!==cases.length||!failure||!Number.isInteger(failure.index)||failure.index<0||failure.index>=cases.length||!['failed','error'].includes(failure.status))throw new AppError(409,'Run this version again before using its saved failing case.');
  return {key,report,failure,item:cases[failure.index],fingerprint};
}
export function publicPracticeRegressions(session){
  const fingerprint=assessmentReviewFingerprint(session),revision=session.regressionRevision||0;
  const cases=(session.regressionCases||[]).map(({suiteKey,...item})=>({...item,compatible:suiteKey===fingerprint}));
  const last=session.regressionLastRun;return {revision,cases,lastRun:last?{id:last.id,createdAt:last.createdAt,code:last.code,revision:last.revision,passed:last.passed,total:last.total,results:last.results,compatible:last.suiteKey===fingerprint&&last.revision===revision}:null};
}
