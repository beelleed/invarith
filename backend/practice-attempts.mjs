import {randomUUID} from 'node:crypto';
import {assessmentReviewFingerprint} from './assessment-review.mjs';

export function recordPracticeAttempt(session,{code,judged,createdAt,codeLanguage='python'}){
  const previous=Array.isArray(session.attempts)?session.attempts:[],suiteKey=assessmentReviewFingerprint(session);
  const suiteId=previous.find(a=>a.suiteKey===suiteKey)?.suiteId||randomUUID();
  session.attempts=[...previous,{id:randomUUID(),suiteKey,suiteId,codeLanguage,code,createdAt,passed:judged.passed,total:judged.total,statuses:judged.results.map(r=>r.status)}].slice(-10);
}
export function publicPracticeAttempts(session){
  return (session.attempts||[]).map(a=>({codeLanguage:a.codeLanguage||'python',id:a.id,suiteId:a.suiteId,code:a.code,createdAt:a.createdAt,passed:a.passed,total:a.total,statuses:[...a.statuses]}));
}
