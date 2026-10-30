import { createHash } from 'node:crypto';
import { AppError } from './verification.mjs';

export function createFollowUpChallenge(history,agent){
  const pending=new Map();
  return async body=>{
    const record=await history.get(body.runId);
    if(!record.evidence.results?.length || record.evidence.passed!==record.evidence.total || record.evidence.results.some(item=>item.status!=='passed'))throw new AppError(409,'Resolve the current failures and complete a passing run before requesting a follow-up challenge.');
    if(record.submission.cases.length>=20)throw new AppError(409,'This suite has reached the 20-case limit. Start a smaller task to explore additional cases.');
    const key=createHash('sha256').update(JSON.stringify(['follow-up-v1',process.env.AI_CHAT_URL,process.env.AI_MODEL])).digest('hex');
    if(record.challenges?.[key])return {...agent.restorePlan(record.challenges[key]),cached:true};
    if(!process.env.AI_CHAT_URL || !process.env.AI_API_KEY || !process.env.AI_MODEL)throw new AppError(503,'Configure the model before generating a challenge. No tests were generated or executed.');
    const pendingKey=`${body.runId}:${key}`;
    if(pending.has(pendingKey))return {...await pending.get(pendingKey),cached:true};
    const generate=async()=>{
      const result=await agent.plan(record.submission,{sourceRunId:record.evidence.id,sourcePassed:record.evidence.passed,sourceTotal:record.evidence.total,sourceExecution:record.evidence.execution,observed:record.evidence.results.map(({index,status,actual})=>({index,status,actual}))});
      await history.saveChallenge(body.runId,key,result);return result;
    };
    const request=generate();pending.set(pendingKey,request);
    try{return {...await request,cached:false};}finally{pending.delete(pendingKey);}
  };
}
