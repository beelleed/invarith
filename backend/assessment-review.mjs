import {createHash} from 'node:crypto';
export function assessmentReviewFingerprint(task){
  return createHash('sha256').update(JSON.stringify([task.functionName,task.contract,task.examples,task.hidden])).digest('hex');
}
export function assessmentReviewReason(question){
  const result=question.evaluation;
  if(result?.status==='not_submitted')return 'not_submitted';
  if(result?.status==='execution_failed')return 'execution_failed';
  if(result?.status==='completed'&&result.passed<result.total)return 'tests_failed';
  return question.marked?'marked_for_review':null;
}

export function assessmentReviewSchedule(practice,finishedAt,now=Date.now()){
  const passed=practice.status==='practice_passed'&&practice.comparable===true;
  const checked=Date.parse(practice.latest?.createdAt);
  const original=Date.parse(finishedAt);
  const due=passed&&Number.isFinite(checked)?checked+3*24*60*60*1000:Number.isFinite(original)?original:now;
  return {dueAt:new Date(due).toISOString(),due:due<=now,intervalDays:passed&&Number.isFinite(checked)?3:0};
}
